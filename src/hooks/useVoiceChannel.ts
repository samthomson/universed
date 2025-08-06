import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useToast } from './useToast';
import { logger } from '@/lib/logger';

// Custom event kinds for voice channel functionality
const VOICE_CHANNEL_STATE_KIND = 30316;
const VOICE_SIGNALING_KIND = 30317; // For WebRTC signaling

export interface VoiceChannelMember {
  pubkey: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}

export interface VoiceChannelState {
  channelId: string;
  members: VoiceChannelMember[];
  lastUpdated: number;
}

interface PeerConnection {
  connection: RTCPeerConnection;
  remoteAudio: HTMLAudioElement;
  isConnected: boolean;
  lastIceState: RTCIceConnectionState;
  reconnectAttempts: number;
  lastConnectedTime: number;
  queuedCandidates?: RTCIceCandidate[];
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: RTCSessionDescriptionInit | RTCIceCandidate;
  from: string;
  to: string;
  channelId: string;
}

/**
 * Hook to manage voice channel state and WebRTC connections
 * Implements full peer-to-peer audio streaming with voice activity detection
 */
export function useVoiceChannel(channelId?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local audio state
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [actualConnectionCount, setActualConnectionCount] = useState(0);

  // WebRTC refs for actual audio streaming
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const voiceDetectionRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const reconnectTimeoutsRef = useRef<Map<string, number>>(new Map());
  const lastSeenMembersRef = useRef<Set<string>>(new Set());
  const performFullReconnectionRef = useRef<((remotePubkey: string) => Promise<void>) | null>(null);

  // Enhanced WebRTC configuration with multiple STUN/TURN servers for better connectivity
  const rtcConfig = useMemo<RTCConfiguration>(() => ({
    iceServers: [
      // Google STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Additional public STUN servers for redundancy
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.nextcloud.com:443' },
      // Public TURN servers (these may have usage limits)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
    ],
    // Enhanced ICE configuration for better connectivity
    iceCandidatePoolSize: 10, // Pre-gather more ICE candidates
    iceTransportPolicy: 'all', // Use both STUN and TURN
    bundlePolicy: 'max-bundle', // Bundle all media on single transport
    rtcpMuxPolicy: 'require', // Multiplex RTP and RTCP
  }), []);

  // Voice activity detection
  const startVoiceDetection = useCallback(() => {
    if (!localStreamRef.current || !audioContextRef.current) return;

    const audioContext = audioContextRef.current;
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(localStreamRef.current);
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const detectVoice = () => {
      if (!analyserRef.current || isMuted || isDeafened) {
        setIsSpeaking(false);
        voiceDetectionRef.current = requestAnimationFrame(detectVoice);
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

      // Voice activity threshold (adjust as needed)
      const threshold = 20;
      const speaking = average > threshold;

      setIsSpeaking(speaking);
      voiceDetectionRef.current = requestAnimationFrame(detectVoice);
    };

    detectVoice();
  }, [isMuted, isDeafened]);

  const stopVoiceDetection = useCallback(() => {
    if (voiceDetectionRef.current) {
      cancelAnimationFrame(voiceDetectionRef.current);
      voiceDetectionRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // WebRTC signaling through Nostr with retry logic
  const sendSignalingMessage = useCallback(async (message: Omit<SignalingMessage, 'from' | 'channelId'>, retries = 3) => {
    if (!user?.pubkey || !channelId) return;

    const signalData = {
      ...message,
      from: user.pubkey,
      channelId,
    };

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await publishEvent({
          kind: VOICE_SIGNALING_KIND,
          content: JSON.stringify(signalData),
          tags: [
            ['d', `${channelId}:${message.to}:${Date.now()}`],
            ['p', message.to], // Target recipient
            ['channel', channelId],
            ['signal_type', message.type],
            ['attempt', attempt.toString()],
          ],
        });

        // Success - log and return
        if (attempt > 0) {
          logger.log(`Signaling message sent to ${message.to} on attempt ${attempt + 1}`);
        }
        return;
      } catch (error) {
        logger.error(`Failed to send signaling (${message.type}) to ${message.to} (attempt ${attempt + 1}):`, error);

        if (attempt < retries - 1) {
          // Wait before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    logger.error(`Failed to send signaling (${message.type}) to ${message.to} after ${retries} attempts`);
  }, [user?.pubkey, channelId, publishEvent]);

  // Heartbeat mechanism to maintain presence
  const sendHeartbeat = useCallback(async () => {
    if (!channelId || !user?.pubkey || !isConnected) return;

    try {
      await publishEvent({
        kind: VOICE_CHANNEL_STATE_KIND,
        content: '',
        tags: [
          ['d', channelId],
          ['action', 'heartbeat'],
          ['muted', isMuted.toString()],
          ['deafened', isDeafened.toString()],
          ['speaking', (isSpeaking && !isMuted).toString()],
        ],
      });
    } catch (error) {
      logger.error('Failed to send heartbeat:', error);
    }
  }, [channelId, user?.pubkey, isConnected, isMuted, isDeafened, isSpeaking, publishEvent]);

  // Start heartbeat when connected
  useEffect(() => {
    if (!isConnected) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    // Send heartbeat every 20 seconds for better presence detection
    heartbeatRef.current = window.setInterval(sendHeartbeat, 20000);

    // Send initial heartbeat immediately
    sendHeartbeat();

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isConnected, sendHeartbeat]);

  // Connection health monitoring
  useEffect(() => {
    if (!isConnected) return;

    const monitorConnections = () => {
      const now = Date.now();
      const staleConnectionThreshold = 60000; // 1 minute

      peerConnectionsRef.current.forEach((peerConn, pubkey) => {
        const { connection, lastConnectedTime, isConnected: peerConnected } = peerConn;

        // Check for stale connections
        if (peerConnected && lastConnectedTime > 0 && (now - lastConnectedTime) > staleConnectionThreshold) {
          logger.log(`Connection to ${pubkey} appears stale, checking health`);

          // Check actual connection state
          if (connection.connectionState === 'disconnected' || connection.connectionState === 'failed') {
            logger.log(`Triggering recovery for stale connection to ${pubkey}`);
            if (performFullReconnectionRef.current) {
              performFullReconnectionRef.current(pubkey);
            }
          }
        }

        // Monitor ICE gathering state
        if (connection.iceGatheringState === 'complete' && connection.iceConnectionState === 'checking') {
          // ICE is stuck in checking state, might need restart
          const checkingTime = now - (peerConn.lastConnectedTime || now);
          if (checkingTime > 15000) { // 15 seconds in checking state
            logger.log(`ICE checking timeout for ${pubkey}, restarting ICE`);
            connection.restartIce();
          }
        }
      });
    };

    // Monitor every 30 seconds
    const monitorInterval = setInterval(monitorConnections, 30000);

    return () => clearInterval(monitorInterval);
  }, [isConnected]);

  // Create peer connection for a specific user with improved reliability
  const createPeerConnection = useCallback(async (remotePubkey: string): Promise<PeerConnection> => {
    logger.log(`Creating peer connection to ${remotePubkey}`);

    const pc = new RTCPeerConnection(rtcConfig);
    const remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    remoteAudio.setAttribute('data-voice-channel', channelId || '');
    remoteAudio.setAttribute('data-user-pubkey', remotePubkey);

    const peerConnection: PeerConnection = {
      connection: pc,
      remoteAudio,
      isConnected: false,
      lastIceState: 'new',
      reconnectAttempts: 0,
      lastConnectedTime: 0,
    };

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      logger.log(`Received remote stream from ${remotePubkey}`);
      const [remoteStream] = event.streams;
      remoteAudio.srcObject = remoteStream;
      peerConnection.isConnected = true;
    };

    // Handle ICE candidates with retry logic and queuing
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        logger.log(`Sending ICE candidate to ${remotePubkey}:`, event.candidate.candidate);
        sendSignalingMessage({
          type: 'ice-candidate',
          data: event.candidate,
          to: remotePubkey,
        }).catch(error => {
          logger.error(`Failed to send ICE candidate to ${remotePubkey}:`, error);
        });
      } else {
        logger.log(`ICE gathering complete for ${remotePubkey}`);
      }
    };

    // Handle connection state changes with reconnection logic
    pc.onconnectionstatechange = () => {
      logger.log(`Connection state with ${remotePubkey}: ${pc.connectionState}`);

      if (pc.connectionState === 'connected') {
        peerConnection.isConnected = true;
        peerConnection.lastConnectedTime = Date.now();
        peerConnection.reconnectAttempts = 0;

        // Update actual connection count
        setActualConnectionCount(() => {
          const connectedCount = Array.from(peerConnectionsRef.current.values())
            .filter(conn => conn.isConnected).length;
          return connectedCount;
        });

        // Clear any pending reconnection timeout
        const timeoutId = reconnectTimeoutsRef.current.get(remotePubkey);
        if (timeoutId) {
          clearTimeout(timeoutId);
          reconnectTimeoutsRef.current.delete(remotePubkey);
        }

        logger.log(`Peer connection established with ${remotePubkey}`);
      } else if (pc.connectionState === 'disconnected') {
        logger.log(`Peer connection disconnected with ${remotePubkey}, monitoring for recovery`);
        // Don't immediately mark as disconnected - wait for ICE to attempt recovery
        // The ICE connection state handler will manage reconnection logic
      } else if (pc.connectionState === 'failed') {
        logger.log(`Peer connection failed with ${remotePubkey}`);
        peerConnection.isConnected = false;
        remoteAudio.srcObject = null;

        // Update actual connection count
        setActualConnectionCount(() => {
          const connectedCount = Array.from(peerConnectionsRef.current.values())
            .filter(conn => conn.isConnected).length;
          return connectedCount;
        });

        // Let ICE connection state handler manage reconnection
      } else if (pc.connectionState === 'closed') {
        logger.log(`Peer connection closed with ${remotePubkey}`);
        peerConnection.isConnected = false;
        remoteAudio.srcObject = null;

        // Update actual connection count
        setActualConnectionCount(() => {
          const connectedCount = Array.from(peerConnectionsRef.current.values())
            .filter(conn => conn.isConnected).length;
          return connectedCount;
        });
      }
    };

    // Handle ICE connection state changes with detailed monitoring
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      logger.log(`ICE connection state with ${remotePubkey}: ${peerConnection.lastIceState} → ${iceState}`);

      peerConnection.lastIceState = iceState;

      switch (iceState) {
        case 'connected':
        case 'completed':
          peerConnection.lastConnectedTime = Date.now();
          peerConnection.reconnectAttempts = 0;
          logger.log(`ICE connection established with ${remotePubkey}`);
          break;

        case 'disconnected':
          logger.log(`ICE connection lost with ${remotePubkey}, attempting ICE restart`);
          // Try ICE restart first before full reconnection
          if (peerConnection.reconnectAttempts < 2) {
            setTimeout(() => {
              if (pc.connectionState !== 'closed' && isConnected) {
                logger.log(`Attempting ICE restart with ${remotePubkey}`);
                pc.restartIce();
                peerConnection.reconnectAttempts++;
              }
            }, 2000);
          }
          break;

        case 'failed':
          logger.log(`ICE connection failed with ${remotePubkey}`);
          peerConnection.isConnected = false;
          remoteAudio.srcObject = null;

          // Update connection count
          setActualConnectionCount(() => {
            const connectedCount = Array.from(peerConnectionsRef.current.values())
              .filter(conn => conn.isConnected).length;
            return connectedCount;
          });

          // Schedule full reconnection if ICE restart attempts failed
          if (isConnected && peerConnection.reconnectAttempts >= 2) {
            const timeoutId = reconnectTimeoutsRef.current.get(remotePubkey);
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            const delay = Math.min(10000, 3000 * Math.pow(2, peerConnection.reconnectAttempts - 2)); // Exponential backoff
            const newTimeoutId = window.setTimeout(async () => {
              logger.log(`Full reconnection attempt to ${remotePubkey} (attempt ${peerConnection.reconnectAttempts})`);
              if (performFullReconnectionRef.current) {
                await performFullReconnectionRef.current(remotePubkey);
              }
            }, delay);

            reconnectTimeoutsRef.current.set(remotePubkey, newTimeoutId);
          }
          break;

        case 'closed':
          logger.log(`ICE connection closed with ${remotePubkey}`);
          peerConnection.isConnected = false;
          break;
      }
    };

    return peerConnection;
  }, [sendSignalingMessage, rtcConfig, channelId, isConnected, user?.pubkey]);

  // Full reconnection function for failed connections
  const performFullReconnection = useCallback(async (remotePubkey: string) => {
    if (!isConnected || !user?.pubkey) return;

    try {
      logger.log(`Performing full reconnection to ${remotePubkey}`);

      // Remove old connection
      const oldConnection = peerConnectionsRef.current.get(remotePubkey);
      if (oldConnection) {
        oldConnection.connection.close();
        oldConnection.remoteAudio.srcObject = null;
        oldConnection.remoteAudio.pause();
        peerConnectionsRef.current.delete(remotePubkey);
      }

      // Clear any pending timeout
      const timeoutId = reconnectTimeoutsRef.current.get(remotePubkey);
      if (timeoutId) {
        clearTimeout(timeoutId);
        reconnectTimeoutsRef.current.delete(remotePubkey);
      }

      // Wait a moment before creating new connection
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create new connection
      const newConnection = await createPeerConnection(remotePubkey);
      peerConnectionsRef.current.set(remotePubkey, newConnection);

      // Initiate new offer with ICE restart
      const offer = await newConnection.connection.createOffer({ iceRestart: true });
      await newConnection.connection.setLocalDescription(offer);

      await sendSignalingMessage({
        type: 'offer',
        data: offer,
        to: remotePubkey,
      });

      logger.log(`Full reconnection initiated to ${remotePubkey}`);
    } catch (error) {
      logger.error(`Failed to perform full reconnection to ${remotePubkey}:`, error);

      // Schedule another attempt with longer delay
      const connection = peerConnectionsRef.current.get(remotePubkey);
      if (connection && connection.reconnectAttempts < 5) {
        const delay = Math.min(30000, 5000 * Math.pow(2, connection.reconnectAttempts));
        const timeoutId = window.setTimeout(() => {
          if (performFullReconnectionRef.current) {
            performFullReconnectionRef.current(remotePubkey);
          }
        }, delay);
        reconnectTimeoutsRef.current.set(remotePubkey, timeoutId);
      }
    }
  }, [isConnected, createPeerConnection, sendSignalingMessage]);

  // Assign the function to the ref for forward reference
  performFullReconnectionRef.current = performFullReconnection;



  // Handle incoming signaling messages with improved reliability
  useEffect(() => {
    if (!channelId || !user?.pubkey || !isConnected) return;

    let lastProcessedTimestamp = Math.floor(Date.now() / 1000) - 30; // Start from 30 seconds ago

    const handleSignaling = async () => {
      try {
        const events = await nostr.query([{
          kinds: [VOICE_SIGNALING_KIND],
          '#p': [user.pubkey],
          '#channel': [channelId],
          since: lastProcessedTimestamp,
          limit: 50,
        }], { signal: AbortSignal.timeout(5000) });

        // Sort events by timestamp to process in order
        const sortedEvents = events.sort((a, b) => a.created_at - b.created_at);

        for (const event of sortedEvents) {
          try {
            const message: SignalingMessage = JSON.parse(event.content);

            if (message.to !== user.pubkey || message.channelId !== channelId) continue;

            const remotePubkey = message.from;

            // Skip messages from ourselves
            if (remotePubkey === user.pubkey) continue;

            let peerConnection = peerConnectionsRef.current.get(remotePubkey);

            if (!peerConnection) {
              logger.log(`Creating new peer connection for ${remotePubkey}`);
              peerConnection = await createPeerConnection(remotePubkey);
              peerConnectionsRef.current.set(remotePubkey, peerConnection);
            }

            const pc = peerConnection.connection;

            // Skip if connection is in a bad state
            if (pc.connectionState === 'closed') {
              logger.log(`Skipping message for closed connection to ${remotePubkey}`);
              continue;
            }

            switch (message.type) {
              case 'offer': {
                logger.log(`Processing offer from ${remotePubkey}`);
                if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
                  await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));

                  // Process any queued ICE candidates
                  if (peerConnection.queuedCandidates) {
                    logger.log(`Processing ${peerConnection.queuedCandidates.length} queued candidates for ${remotePubkey}`);
                    for (const candidate of peerConnection.queuedCandidates) {
                      try {
                        await pc.addIceCandidate(candidate);
                      } catch (error) {
                        logger.error(`Failed to add queued candidate from ${remotePubkey}:`, error);
                      }
                    }
                    peerConnection.queuedCandidates = [];
                  }

                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  await sendSignalingMessage({
                    type: 'answer',
                    data: answer,
                    to: remotePubkey,
                  });
                  logger.log(`Sent answer to ${remotePubkey}`);
                }
                break;
              }

              case 'answer': {
                logger.log(`Processing answer from ${remotePubkey}`);
                if (pc.signalingState === 'have-local-offer') {
                  await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));

                  // Process any queued ICE candidates
                  if (peerConnection.queuedCandidates) {
                    logger.log(`Processing ${peerConnection.queuedCandidates.length} queued candidates for ${remotePubkey}`);
                    for (const candidate of peerConnection.queuedCandidates) {
                      try {
                        await pc.addIceCandidate(candidate);
                      } catch (error) {
                        logger.error(`Failed to add queued candidate from ${remotePubkey}:`, error);
                      }
                    }
                    peerConnection.queuedCandidates = [];
                  }

                  logger.log(`Set remote description from ${remotePubkey}`);
                }
                break;
              }

              case 'ice-candidate': {
                const candidate = new RTCIceCandidate(message.data as RTCIceCandidate);
                logger.log(`Received ICE candidate from ${remotePubkey}:`, candidate.candidate);

                if (pc.remoteDescription && pc.signalingState !== 'closed') {
                  try {
                    await pc.addIceCandidate(candidate);
                    logger.log(`Added ICE candidate from ${remotePubkey}`);
                  } catch (error) {
                    logger.error(`Failed to add ICE candidate from ${remotePubkey}:`, error);
                  }
                } else {
                  logger.log(`Queueing ICE candidate from ${remotePubkey} (no remote description yet)`);
                  // Store candidate for later - we'll add it after remote description is set
                  if (!peerConnection.queuedCandidates) {
                    peerConnection.queuedCandidates = [];
                  }
                  peerConnection.queuedCandidates.push(candidate);
                }
                break;
              }
            }

            // Update last processed timestamp
            lastProcessedTimestamp = Math.max(lastProcessedTimestamp, event.created_at);
          } catch (error) {
            logger.error('Error processing signaling message:', error);
          }
        }
      } catch (error) {
        logger.error('Error fetching signaling messages:', error);
      }
    };

    // Poll for signaling messages with better timing
    const interval = setInterval(handleSignaling, 2000); // Slightly less aggressive
    handleSignaling(); // Initial fetch

    return () => clearInterval(interval);
  }, [channelId, user?.pubkey, isConnected, nostr, createPeerConnection, sendSignalingMessage]);

  // Initiate connections to existing members when joining
  const initiateConnections = useCallback(async (members: VoiceChannelMember[]) => {
    if (!user?.pubkey || !localStreamRef.current) return;

    logger.log(`Initiating connections to ${members.length} members`);

    for (const member of members) {
      if (member.pubkey === user.pubkey) continue;

      try {
        // Check if we already have a connection
        const existingConnection = peerConnectionsRef.current.get(member.pubkey);
        if (existingConnection && existingConnection.connection.connectionState === 'connected') {
          logger.log(`Already connected to ${member.pubkey}`);
          continue;
        }

        // Clean up any existing failed connection
        if (existingConnection) {
          existingConnection.connection.close();
          existingConnection.remoteAudio.srcObject = null;
          existingConnection.remoteAudio.pause();
        }

        const peerConnection = await createPeerConnection(member.pubkey);
        peerConnectionsRef.current.set(member.pubkey, peerConnection);

        const pc = peerConnection.connection;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await sendSignalingMessage({
          type: 'offer',
          data: offer,
          to: member.pubkey,
        });

        logger.log(`Sent offer to ${member.pubkey}`);
      } catch (error) {
        logger.error(`Failed to initiate connection to ${member.pubkey}:`, error);
      }
    }
  }, [user?.pubkey, createPeerConnection, sendSignalingMessage]);

  // Query voice channel members with improved reliability
  const { data: voiceState } = useQuery({
    queryKey: ['voice-channel', channelId],
    queryFn: async (c) => {
      if (!channelId) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);

      // Get voice channel state events with longer time window
      const events = await nostr.query([{
        kinds: [VOICE_CHANNEL_STATE_KIND],
        '#d': [channelId],
        limit: 100,
        since: Math.floor(Date.now() / 1000) - (60 * 60 * 2), // Last 2 hours
      }], { signal });

      // Sort events by timestamp to process in order
      const sortedEvents = events.sort((a, b) => a.created_at - b.created_at);

      // Process events to build current state
      const memberMap = new Map<string, VoiceChannelMember>();
      const memberLastSeen = new Map<string, number>();

      sortedEvents.forEach(event => {
        const { pubkey, created_at, tags } = event;
        const action = tags.find(([name]) => name === 'action')?.[1];
        const muted = !!tags.find(([name]) => name === 'muted')?.[1];
        const deafened = !!tags.find(([name]) => name === 'deafened')?.[1];
        const speaking = !!tags.find(([name]) => name === 'speaking')?.[1];

        // Track when we last saw activity from this member
        memberLastSeen.set(pubkey, created_at * 1000);

        // either the user is still around (joining, updating, or idle) or they left
        switch (action) {
          case 'join':
          case 'heartbeat':
          case 'update':
            memberMap.set(pubkey, {
              pubkey,
              muted,
              deafened,
              speaking,
            });
            break;
          case 'leave':
            memberMap.delete(pubkey);
            memberLastSeen.delete(pubkey);
            break;
        }
      });

      // Remove members who haven't been seen in the last 3 minutes (likely disconnected)
      const now = Date.now();
      const staleThreshold = 3 * 60 * 1000; // 3 minutes

      for (const [pubkey, lastSeen] of memberLastSeen.entries()) {
        if (now - lastSeen > staleThreshold) {
          memberMap.delete(pubkey);
        }
      }

      const currentMembers = Array.from(memberMap.values());

      // Track member changes for connection management
      const currentMemberPubkeys = new Set(currentMembers.map(m => m.pubkey));
      const previousMembers = lastSeenMembersRef.current;

      // Find new members to connect to
      const newMembers = [...currentMemberPubkeys].filter(pubkey => !previousMembers.has(pubkey));
      const leftMembers = [...previousMembers].filter(pubkey => !currentMemberPubkeys.has(pubkey));

      lastSeenMembersRef.current = currentMemberPubkeys;

      return {
        channelId,
        members: currentMembers,
        lastUpdated: now,
        newMembers,
        leftMembers,
      };
    },
    enabled: !!channelId,
    refetchInterval: 5000, // Refetch every 5 seconds to reduce conflicts
    staleTime: 2000, // Consider data stale after 2 seconds
  });

  // Validate and clean up stale connections
  const validateConnections = useCallback(() => {
    if (!voiceState || !isConnected) return;

    const currentMemberPubkeys = new Set(voiceState.members.map(m => m.pubkey));
    const connectedPubkeys = Array.from(peerConnectionsRef.current.keys());

    // Clean up connections to members who are no longer in the channel
    connectedPubkeys.forEach(pubkey => {
      if (!currentMemberPubkeys.has(pubkey)) {
        logger.log(`Cleaning up stale connection to ${pubkey}`);
        const connection = peerConnectionsRef.current.get(pubkey);
        if (connection) {
          connection.connection.close();
          connection.remoteAudio.srcObject = null;
          connection.remoteAudio.pause();
          peerConnectionsRef.current.delete(pubkey);
        }

        // Clear any pending reconnection timeout
        const timeoutId = reconnectTimeoutsRef.current.get(pubkey);
        if (timeoutId) {
          clearTimeout(timeoutId);
          reconnectTimeoutsRef.current.delete(pubkey);
        }
      }
    });

    // Update connection count
    setActualConnectionCount(Array.from(peerConnectionsRef.current.values())
      .filter(conn => conn.isConnected).length);
  }, [voiceState, isConnected]);

  // Handle member changes (new joins, leaves) with debouncing
  useEffect(() => {
    if (!voiceState || !isConnected || !user?.pubkey) return;

    // Debounce member changes to avoid rapid connection attempts
    const timeoutId = setTimeout(() => {
      const { newMembers, leftMembers } = voiceState;

      // Clean up connections for members who left
      if (leftMembers && leftMembers.length > 0) {
        logger.log(`Cleaning up connections for ${leftMembers.length} members who left`);
        leftMembers.forEach(pubkey => {
          const connection = peerConnectionsRef.current.get(pubkey);
          if (connection) {
            connection.connection.close();
            connection.remoteAudio.srcObject = null;
            connection.remoteAudio.pause();
            peerConnectionsRef.current.delete(pubkey);
          }

          // Clear any pending reconnection timeout
          const timeoutId = reconnectTimeoutsRef.current.get(pubkey);
          if (timeoutId) {
            clearTimeout(timeoutId);
            reconnectTimeoutsRef.current.delete(pubkey);
          }
        });
      }

      // Initiate connections to new members (with validation)
      if (newMembers && newMembers.length > 0) {
        logger.log(`Connecting to ${newMembers.length} new members`);
        const newMemberObjects = voiceState.members.filter(m =>
          newMembers.includes(m.pubkey) && m.pubkey !== user.pubkey
        );
        if (newMemberObjects.length > 0) {
          initiateConnections(newMemberObjects);
        }
      }

      // Validate all connections
      validateConnections();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [voiceState, isConnected, user?.pubkey, initiateConnections, validateConnections]);

  // Join voice channel with improved reliability
  const joinVoiceChannel = useMutation({
    mutationFn: async () => {
      if (!channelId || !user?.pubkey) {
        throw new Error('Channel ID and user required');
      }

      setConnectionStatus('connecting');

      try {
        logger.log('Requesting microphone access...');

        // Request microphone permission with audio processing
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          }
        });

        localStreamRef.current = stream;
        logger.log('Microphone access granted');

        // Set up audio context for voice detection
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        } else {
          throw new Error('AudioContext not supported');
        }

        // Start voice activity detection
        startVoiceDetection();

        // Publish join event first
        logger.log('Publishing join event...');
        await publishEvent({
          kind: VOICE_CHANNEL_STATE_KIND,
          content: '',
          tags: [
            ['d', channelId],
            ['action', 'join'],
            ['muted', isMuted.toString()],
            ['deafened', isDeafened.toString()],
            ['speaking', 'false'],
          ],
        });

        setIsConnected(true);
        setConnectionStatus('connected');

        // Wait for the join event to propagate
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Force refresh the voice state to get updated member list
        await queryClient.invalidateQueries({ queryKey: ['voice-channel', channelId] });

        // Wait for the query to complete and retry if user not found
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Check if we're now in the member list
          const currentState = queryClient.getQueryData(['voice-channel', channelId]) as VoiceChannelState | null;
          const userInChannel = currentState?.members?.some((m: VoiceChannelMember) => m.pubkey === user.pubkey);

          if (userInChannel) {
            logger.log('User successfully added to voice channel member list');
            break;
          }

          retries++;
          logger.log(`User not yet in member list, retry ${retries}/${maxRetries}`);

          if (retries < maxRetries) {
            // Send another join event if not found
            await publishEvent({
              kind: VOICE_CHANNEL_STATE_KIND,
              content: '',
              tags: [
                ['d', channelId],
                ['action', 'join'],
                ['muted', isMuted.toString()],
                ['deafened', isDeafened.toString()],
                ['speaking', 'false'],
              ],
            });
            await queryClient.invalidateQueries({ queryKey: ['voice-channel', channelId] });
          }
        }

        // Get current members and initiate connections
        const currentMembers = voiceState?.members?.filter(m => m.pubkey !== user.pubkey) || [];
        logger.log(`Found ${currentMembers.length} existing members to connect to`);

        if (currentMembers.length > 0) {
          await initiateConnections(currentMembers);
        }

        toast({
          title: 'Joined voice channel',
          description: `Connected to voice channel with ${currentMembers.length} other members`,
        });
      } catch (error: unknown) {
        setConnectionStatus('disconnected');
        setIsConnected(false);

        // Clean up on error
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
        }

        const err = error as { name?: string };
        if (err.name === 'NotAllowedError') {
          throw new Error('Microphone permission denied');
        } else if (err.name === 'NotFoundError') {
          throw new Error('No microphone found');
        } else {
          throw new Error('Failed to access microphone');
        }
      }
    },
    onError: (error) => {
      setConnectionStatus('disconnected');
      toast({
        title: 'Failed to join voice channel',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-channel', channelId] });
    },
  });

  // Leave voice channel
  const leaveVoiceChannel = useMutation({
    mutationFn: async () => {
      if (!channelId || !user?.pubkey) {
        throw new Error('Channel ID and user required');
      }

      // Stop voice detection
      stopVoiceDetection();

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Close all peer connections and stop remote audio
      peerConnectionsRef.current.forEach(({ connection, remoteAudio }) => {
        connection.close();
        remoteAudio.srcObject = null;
        remoteAudio.pause();
      });
      peerConnectionsRef.current.clear();

      // Publish leave event
      await publishEvent({
        kind: VOICE_CHANNEL_STATE_KIND,
        content: '',
        tags: [
          ['d', channelId],
          ['action', 'leave'],
        ],
      });

      setIsConnected(false);
      setIsSpeaking(false);

      toast({
        title: 'Left voice channel',
        description: 'You have disconnected from the voice channel',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-channel', channelId] });
    },
  });

  // Toggle mute
  const toggleMute = useMutation({
    mutationFn: async () => {
      if (!channelId || !user?.pubkey || !isConnected) return;

      const newMutedState = !isMuted;

      // Mute/unmute local stream
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !newMutedState;
        });
      }

      setIsMuted(newMutedState);

      // Publish state update with speaking status
      await publishEvent({
        kind: VOICE_CHANNEL_STATE_KIND,
        content: '',
        tags: [
          ['d', channelId],
          ['action', 'update'],
          ['muted', newMutedState.toString()],
          ['deafened', isDeafened.toString()],
          ['speaking', (isSpeaking && !newMutedState).toString()],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-channel', channelId] });
    },
  });

  // Toggle deafen
  const toggleDeafen = useMutation({
    mutationFn: async () => {
      if (!channelId || !user?.pubkey || !isConnected) return;

      const newDeafenedState = !isDeafened;

      // If deafening, also mute
      const newMutedState = newDeafenedState ? true : isMuted;

      // Update local stream (mute microphone when deafened)
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !newMutedState;
        });
      }

      // Mute/unmute all remote audio streams
      peerConnectionsRef.current.forEach(({ remoteAudio }) => {
        remoteAudio.muted = newDeafenedState;
      });

      setIsDeafened(newDeafenedState);
      if (newDeafenedState) {
        setIsMuted(true);
      }

      // Publish state update
      await publishEvent({
        kind: VOICE_CHANNEL_STATE_KIND,
        content: '',
        tags: [
          ['d', channelId],
          ['action', 'update'],
          ['muted', newMutedState.toString()],
          ['deafened', newDeafenedState.toString()],
          ['speaking', (isSpeaking && !newMutedState).toString()],
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-channel', channelId] });
    },
  });

  // Publish speaking status updates
  useEffect(() => {
    if (!isConnected || !channelId || !user?.pubkey) return;

    const publishSpeakingStatus = async () => {
      try {
        await publishEvent({
          kind: VOICE_CHANNEL_STATE_KIND,
          content: '',
          tags: [
            ['d', channelId],
            ['action', 'update'],
            ['muted', isMuted.toString()],
            ['deafened', isDeafened.toString()],
            ['speaking', (isSpeaking && !isMuted).toString()],
          ],
        });
      } catch (error) {
        logger.error('Failed to publish speaking status:', error);
      }
    };

    // Debounce speaking status updates
    const timeoutId = setTimeout(publishSpeakingStatus, 500);
    return () => clearTimeout(timeoutId);
  }, [isSpeaking, isMuted, isDeafened, isConnected, channelId, user?.pubkey, publishEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logger.log('Cleaning up voice channel hook');

      // Stop voice detection
      if (voiceDetectionRef.current) {
        cancelAnimationFrame(voiceDetectionRef.current);
      }

      // Stop heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }

      // Clear all reconnection timeouts - copy ref to avoid stale closure
      const reconnectTimeouts = reconnectTimeoutsRef.current;
      reconnectTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      reconnectTimeouts.clear();

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Close peer connections and stop remote audio - copy ref to avoid stale closure
      const peerConnections = peerConnectionsRef.current;
      peerConnections.forEach(({ connection, remoteAudio }) => {
        connection.close();
        remoteAudio.srcObject = null;
        remoteAudio.pause();
      });
      peerConnections.clear();
    };
  }, []);

  // Check if current user is in the voice channel
  const isUserInChannel = voiceState?.members.some(member => member.pubkey === user?.pubkey) || false;

  // More robust connection state - user must be in channel AND have local stream
  const isActuallyConnected = isConnected && isUserInChannel && !!localStreamRef.current;

  return {
    // State
    voiceState,
    isConnected: isActuallyConnected,
    connectionStatus: isActuallyConnected ? 'connected' : connectionStatus,
    isMuted,
    isDeafened,
    isSpeaking,
    actualConnectionCount, // Expose actual peer connection count for debugging

    // Actions
    joinVoiceChannel: joinVoiceChannel.mutateAsync,
    leaveVoiceChannel: leaveVoiceChannel.mutateAsync,
    toggleMute: toggleMute.mutateAsync,
    toggleDeafen: toggleDeafen.mutateAsync,

    // Loading states
    isJoining: joinVoiceChannel.isPending,
    isLeaving: leaveVoiceChannel.isPending,
  };
}