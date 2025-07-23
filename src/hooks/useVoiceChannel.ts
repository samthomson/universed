import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import { useToast } from './useToast';

// Custom event kind for voice channel state
const VOICE_CHANNEL_STATE_KIND = 30316;

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

/**
 * Hook to manage voice channel state and WebRTC connections
 * This is a simplified implementation that tracks who's in voice channels
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

  // WebRTC refs (simplified - in a real implementation you'd use a proper WebRTC library)
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

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

        if (action === 'join') {
          memberMap.set(event.pubkey, {
            pubkey: event.pubkey,
            muted: mutedTag === 'true',
            deafened: deafenedTag === 'true',
            speaking: false,
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

      // Request microphone permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        // Publish join event
        await publishEvent({
          kind: VOICE_CHANNEL_STATE_KIND,
          content: '',
          tags: [
            ['d', channelId],
            ['action', 'join'],
            ['muted', isMuted.toString()],
            ['deafened', isDeafened.toString()],
          ],
        });

        setIsConnected(true);

        toast({
          title: 'Joined voice channel',
          description: 'You are now connected to the voice channel',
        });
      } catch {
        throw new Error('Failed to access microphone');
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

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      // Close peer connections
      peerConnectionsRef.current.forEach(pc => pc.close());
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

      // Publish state update
      await publishEvent({
        kind: VOICE_CHANNEL_STATE_KIND,
        content: '',
        tags: [
          ['d', channelId],
          ['action', 'update'],
          ['muted', newMutedState.toString()],
          ['deafened', isDeafened.toString()],
        ],
      });

      setIsMuted(newMutedState);
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

      // Update local stream
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !newMutedState;
        });
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
        ],
      });

      setIsDeafened(newDeafenedState);
      if (newDeafenedState) {
        setIsMuted(true);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-channel', channelId] });
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      const peerConnections = peerConnectionsRef.current;
      peerConnections.forEach(pc => pc.close());
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