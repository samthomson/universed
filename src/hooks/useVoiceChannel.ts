import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useToast } from './useToast';

// Custom event kinds for voice channel functionality
const VOICE_CHANNEL_STATE_KIND = 30316;
const VOICE_SIGNALING_KIND = 30317; // For WebRTC signaling

export interface VoiceChannelMember {
  pubkey: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  joinedAt: number;
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

  // WebRTC refs for actual audio streaming
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const voiceDetectionRef = useRef<number | null>(null);

  // WebRTC configuration with public STUN servers
  const rtcConfig = useMemo<RTCConfiguration>(() => ({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
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

  // WebRTC signaling through Nostr
  const sendSignalingMessage = useCallback(async (message: Omit<SignalingMessage, 'from' | 'channelId'>) => {
    if (!user?.pubkey || !channelId) return;

    await publishEvent({
      kind: VOICE_SIGNALING_KIND,
      content: JSON.stringify({
        ...message,
        from: user.pubkey,
        channelId,
      }),
      tags: [
        ['d', `${channelId}:${message.to}:${Date.now()}`],
        ['p', message.to], // Target recipient
        ['channel', channelId],
        ['signal_type', message.type],
      ],
    });
  }, [user?.pubkey, channelId, publishEvent]);

  // Create peer connection for a specific user
  const createPeerConnection = useCallback(async (remotePubkey: string): Promise<PeerConnection> => {
    const pc = new RTCPeerConnection(rtcConfig);
    const remoteAudio = new Audio();
    remoteAudio.autoplay = true;
    remoteAudio.setAttribute('data-voice-channel', channelId || '');
    remoteAudio.setAttribute('data-user-pubkey', remotePubkey);

    const peerConnection: PeerConnection = {
      connection: pc,
      remoteAudio,
      isConnected: false,
    };

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      remoteAudio.srcObject = remoteStream;
      peerConnection.isConnected = true;
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({
          type: 'ice-candidate',
          data: event.candidate,
          to: remotePubkey,
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        peerConnection.isConnected = false;
        remoteAudio.srcObject = null;
      }
    };

    return peerConnection;
  }, [sendSignalingMessage, rtcConfig]);

  // Handle incoming signaling messages
  useEffect(() => {
    if (!channelId || !user?.pubkey || !isConnected) return;

    const handleSignaling = async () => {
      try {
        const events = await nostr.query([{
          kinds: [VOICE_SIGNALING_KIND],
          '#p': [user.pubkey],
          '#channel': [channelId],
          since: Math.floor(Date.now() / 1000) - 60, // Last minute
        }], { signal: AbortSignal.timeout(3000) });

        for (const event of events) {
          try {
            const message: SignalingMessage = JSON.parse(event.content);

            if (message.to !== user.pubkey || message.channelId !== channelId) continue;

            const remotePubkey = message.from;
            let peerConnection = peerConnectionsRef.current.get(remotePubkey);

            if (!peerConnection) {
              peerConnection = await createPeerConnection(remotePubkey);
              peerConnectionsRef.current.set(remotePubkey, peerConnection);
            }

            const pc = peerConnection.connection;

            switch (message.type) {
              case 'offer': {
                await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await sendSignalingMessage({
                  type: 'answer',
                  data: answer,
                  to: remotePubkey,
                });
                break;
              }

              case 'answer': {
                await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));
                break;
              }

              case 'ice-candidate': {
                await pc.addIceCandidate(new RTCIceCandidate(message.data as RTCIceCandidate));
                break;
              }
            }
          } catch (error) {
            console.error('Error processing signaling message:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching signaling messages:', error);
      }
    };

    // Poll for signaling messages
    const interval = setInterval(handleSignaling, 2000);
    handleSignaling(); // Initial fetch

    return () => clearInterval(interval);
  }, [channelId, user?.pubkey, isConnected, nostr, createPeerConnection, sendSignalingMessage]);

  // Initiate connections to existing members when joining
  const initiateConnections = useCallback(async (members: VoiceChannelMember[]) => {
    if (!user?.pubkey || !localStreamRef.current) return;

    for (const member of members) {
      if (member.pubkey === user.pubkey) continue;

      try {
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
      } catch (error) {
        console.error(`Failed to initiate connection to ${member.pubkey}:`, error);
      }
    }
  }, [user?.pubkey, createPeerConnection, sendSignalingMessage]);

  // Query voice channel members
  const { data: voiceState } = useQuery({
    queryKey: ['voice-channel', channelId],
    queryFn: async (c) => {
      if (!channelId) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);

      // Get voice channel state events
      const events = await nostr.query([{
        kinds: [VOICE_CHANNEL_STATE_KIND],
        '#d': [channelId],
        limit: 50,
        since: Math.floor(Date.now() / 1000) - (60 * 60), // Last hour
      }], { signal });

      // Process events to build current state
      const memberMap = new Map<string, VoiceChannelMember>();

      events.forEach(event => {
        const action = event.tags.find(([name]) => name === 'action')?.[1];
        const mutedTag = event.tags.find(([name]) => name === 'muted')?.[1];
        const deafenedTag = event.tags.find(([name]) => name === 'deafened')?.[1];
        const speakingTag = event.tags.find(([name]) => name === 'speaking')?.[1];

        if (action === 'join') {
          memberMap.set(event.pubkey, {
            pubkey: event.pubkey,
            muted: mutedTag === 'true',
            deafened: deafenedTag === 'true',
            speaking: speakingTag === 'true',
            joinedAt: event.created_at * 1000,
          });
        } else if (action === 'leave') {
          memberMap.delete(event.pubkey);
        } else if (action === 'update') {
          const existing = memberMap.get(event.pubkey);
          if (existing) {
            memberMap.set(event.pubkey, {
              ...existing,
              muted: mutedTag === 'true',
              deafened: deafenedTag === 'true',
              speaking: speakingTag === 'true',
            });
          }
        }
      });

      return {
        channelId,
        members: Array.from(memberMap.values()),
        lastUpdated: Date.now(),
      };
    },
    enabled: !!channelId,
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Join voice channel
  const joinVoiceChannel = useMutation({
    mutationFn: async () => {
      if (!channelId || !user?.pubkey) {
        throw new Error('Channel ID and user required');
      }

      try {
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

        // Set up audio context for voice detection
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        } else {
          throw new Error('AudioContext not supported');
        }

        // Start voice activity detection
        startVoiceDetection();

        // Get current members to initiate connections
        const currentMembers = voiceState?.members || [];

        // Publish join event
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

        // Initiate WebRTC connections to existing members
        await initiateConnections(currentMembers);

        toast({
          title: 'Joined voice channel',
          description: 'You are now connected to the voice channel',
        });
      } catch (error: unknown) {
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
        console.error('Failed to publish speaking status:', error);
      }
    };

    // Debounce speaking status updates
    const timeoutId = setTimeout(publishSpeakingStatus, 500);
    return () => clearTimeout(timeoutId);
  }, [isSpeaking, isMuted, isDeafened, isConnected, channelId, user?.pubkey, publishEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop voice detection
      if (voiceDetectionRef.current) {
        cancelAnimationFrame(voiceDetectionRef.current);
      }

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Close peer connections and stop remote audio
      // Copy the ref value to avoid stale closure issues
      const peerConnections = peerConnectionsRef.current;
      peerConnections.forEach(({ connection, remoteAudio }) => {
        connection.close();
        remoteAudio.srcObject = null;
        remoteAudio.pause();
      });
    };
  }, []);

  // Check if current user is in the voice channel
  const isUserInChannel = voiceState?.members.some(member => member.pubkey === user?.pubkey) || false;

  return {
    // State
    voiceState,
    isConnected: isConnected && isUserInChannel,
    isMuted,
    isDeafened,
    isSpeaking,

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