import React, { createContext, useContext, useRef, useState, useCallback, useMemo } from 'react';
import { WebRTCVoiceChat } from '@/utils/WebRTCVoiceChat';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useEngagement } from '@/hooks/useEngagement';
import { useEnhancedKarma } from '@/hooks/useEnhancedKarma';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Types and interfaces
interface VoiceParticipant {
  userId: string;
  name: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  handRaised: boolean;
  joinedAt: string;
  hasMicrophone: boolean;
}

interface VoiceRoomState {
  isConnected: boolean;
  isConnecting: boolean;
  participants: VoiceParticipant[];
  participantCount: number;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  handRaised: boolean;
  isCollapsed: boolean;
  isMinimized: boolean;
}

interface VoiceRoomActions {
  joinVoiceRoom: (groupId: string, groupName: string, enableMicrophone?: boolean) => Promise<void>;
  leaveVoiceRoom: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleHandRaise: () => void;
  toggleCollapse: () => void;
  toggleMinimize: () => void;
  getConnectionStatus: () => { isConnected: boolean; participantCount: number };
  watchVoicePresence: (groupId: string) => void;
  unwatchVoicePresence: () => void;
}

interface VoiceRoomContextType extends VoiceRoomState, VoiceRoomActions {}

const VoiceRoomContext = createContext<VoiceRoomContextType | undefined>(undefined);

// Provider component
interface VoiceRoomProviderProps {
  children: React.ReactNode;
}

export const VoiceRoomProvider: React.FC<VoiceRoomProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { trackActivity } = useEngagement();
  const { trackKarmaActivity } = useEnhancedKarma();

  // State
  const [state, setState] = useState<VoiceRoomState>({
    isConnected: false,
    isConnecting: false,
    participants: [],
    participantCount: 0,
    isMuted: false,
    isDeafened: false,
    isSpeaking: false,
    handRaised: false,
    isCollapsed: true,
    isMinimized: false,
  });

  // Refs for stable references
  const voiceChatRef = useRef<WebRTCVoiceChat | null>(null);
  const currentGroupId = useRef<string | null>(null);
  const currentGroupName = useRef<string | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const isConnectedRef = useRef(false);

  const parsePassiveParticipants = (
    presenceState: Record<string, unknown[]>,
    excludeUserId: string
  ): VoiceParticipant[] => {
    const participants: VoiceParticipant[] = [];
    Object.values(presenceState).forEach((presences) => {
      presences.forEach((presence) => {
        const record = presence as Record<string, unknown>;
        const userId = record.user_id as string | undefined;
        if (!userId || userId === excludeUserId) return;
        participants.push({
          userId,
          name: (record.name as string) || 'Unknown User',
          isMuted: Boolean(record.isMuted),
          isDeafened: Boolean(record.isDeafened),
          isSpeaking: Boolean(record.isSpeaking),
          handRaised: Boolean(record.handRaised),
          joinedAt: (record.joinedAt as string) || new Date().toISOString(),
          hasMicrophone: record.hasMicrophone !== false,
        });
      });
    });
    return participants;
  };

  const stopPassivePresence = useCallback(() => {
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
  }, []);

  const watchVoicePresence = useCallback((groupId: string) => {
    if (!user || isConnectedRef.current) return;
    stopPassivePresence();

    const channel = supabase.channel(`voice-${groupId}`);
    channel.on('presence', { event: 'sync' }, () => {
      if (isConnectedRef.current) return;
      const remoteParticipants = parsePassiveParticipants(
        channel.presenceState(),
        user.id
      );
      setState((prev) => ({
        ...prev,
        participants: remoteParticipants,
        participantCount: remoteParticipants.length,
      }));
    });

    channel.subscribe();
    presenceChannelRef.current = channel;
  }, [user, stopPassivePresence]);

  const unwatchVoicePresence = useCallback(() => {
    stopPassivePresence();
    if (!isConnectedRef.current) {
      setState((prev) => ({
        ...prev,
        participants: [],
        participantCount: 0,
      }));
    }
  }, [stopPassivePresence]);

  // Connection management
  const joinVoiceRoom = useCallback(async (groupId: string, groupName: string, enableMicrophone: boolean = false) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to join the voice room",
        variant: "destructive",
      });
      return;
    }

    if (state.isConnecting || state.isConnected) {
      toast({
        title: "Already Connected",
        description: "You are already in a voice room",
      });
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true }));
    stopPassivePresence();

    try {
      const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

      // Initialize WebRTC voice chat
      voiceChatRef.current = new WebRTCVoiceChat(
        groupId,
        user.id,
        userName,
        {
          onParticipantJoined: (participant) => {
            setState(prev => {
              const exists = prev.participants.some((p) => p.userId === participant.userId);
              if (exists) {
                return {
                  ...prev,
                  participants: prev.participants.map((p) =>
                    p.userId === participant.userId ? participant : p
                  ),
                };
              }
              return {
                ...prev,
                participants: [...prev.participants, participant],
                participantCount: prev.participantCount + 1,
              };
            });
          },
          onParticipantLeft: (userId) => {
            setState(prev => ({
              ...prev,
              participants: prev.participants.filter(p => p.userId !== userId),
              participantCount: Math.max(0, prev.participantCount - 1),
            }));
          },
          onParticipantUpdated: (participant) => {
            setState(prev => ({
              ...prev,
              participants: prev.participants.map(p => 
                p.userId === participant.userId ? participant : p
              ),
            }));
          },
          onConnectionStateChange: (connected) => {
            if (!connected) {
              toast({
                title: "Voice Connection Lost",
                description: "Lost connection to voice room. Trying to reconnect...",
                variant: "destructive",
              });
            }
          },
          onError: (error) => {
            const lowerError = error.toLowerCase();
            if (
              lowerError.includes('permission denied') ||
              lowerError.includes('notallowederror')
            ) {
              toast({
                title: 'Microphone blocked',
                description:
                  'Allow microphone access in your browser settings to use voice.',
                variant: 'destructive',
              });
            } else if (
              lowerError.includes('connection failed') ||
              lowerError.includes('failed to connect')
            ) {
              toast({
                title: 'Voice connection failed',
                description:
                  'Your network may be blocking voice. Try a different network or contact support.',
                variant: 'destructive',
              });
            } else {
              toast({
                title: 'Voice Room Error',
                description: error,
                variant: 'destructive',
              });
            }
          },
        }
      );

      await voiceChatRef.current.connect(enableMicrophone);

      currentGroupId.current = groupId;
      currentGroupName.current = groupName;

      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        isCollapsed: false,
        participants: voiceChatRef.current?.getParticipants() || [],
        participantCount: voiceChatRef.current?.getParticipantCount() || 0,
      }));
      isConnectedRef.current = true;

      // Track engagement
      trackActivity('voice_participation');
      trackKarmaActivity('voice_participation', 3, 'Joined voice room', 1.0, groupId);

      toast({
        title: "Voice Room Connected",
        description: `Connected to ${groupName} voice room${enableMicrophone ? '' : ' (listening only)'}`,
      });

    } catch (error) {
      console.error('Voice room connection error:', error);
      setState(prev => ({ ...prev, isConnecting: false }));

      const message = error instanceof Error ? error.message : String(error);
      const lowerMessage = message.toLowerCase();

      if (
        (enableMicrophone &&
          error instanceof Error &&
          error.name === 'NotAllowedError') ||
        lowerMessage.includes('permission denied') ||
        lowerMessage.includes('notallowederror')
      ) {
        toast({
          title: 'Microphone blocked',
          description:
            'Allow microphone access in your browser settings to use voice.',
          variant: 'destructive',
        });
      } else if (
        lowerMessage.includes('connection failed') ||
        lowerMessage.includes('failed to connect')
      ) {
        toast({
          title: 'Voice connection failed',
          description:
            'Your network may be blocking voice. Try a different network or contact support.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description:
            'Failed to join voice room. Please check your internet connection and try again.',
          variant: 'destructive',
        });
      }
    }
  }, [user, state.isConnecting, state.isConnected, trackActivity, trackKarmaActivity, toast]);

  const leaveVoiceRoom = useCallback(async () => {
    try {
      // Cleanup WebRTC connection
      if (voiceChatRef.current) {
        await voiceChatRef.current.disconnect();
        voiceChatRef.current = null;
      }

      currentGroupId.current = null;
      currentGroupName.current = null;

      setState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        participants: [],
        participantCount: 0,
        isSpeaking: false,
        isCollapsed: true
      }));
      isConnectedRef.current = false;

      toast({
        title: "Voice Room Disconnected",
        description: "Left the voice room",
      });

    } catch (error) {
      console.error('Error leaving voice room:', error);
      toast({
        title: "Error",
        description: "Failed to leave voice room properly",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Audio controls using WebRTC
  const toggleMute = useCallback(() => {
    if (voiceChatRef.current) {
      voiceChatRef.current.toggleMute();
      setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, []);

  const toggleDeafen = useCallback(() => {
    if (voiceChatRef.current) {
      voiceChatRef.current.toggleDeafen();
      setState(prev => ({ ...prev, isDeafened: !prev.isDeafened }));
    }
  }, []);

  const toggleHandRaise = useCallback(() => {
    if (voiceChatRef.current) {
      voiceChatRef.current.toggleHandRaise();
      setState(prev => ({ ...prev, handRaised: !prev.handRaised }));
    }
  }, []);

  // UI controls
  const toggleCollapse = useCallback(() => {
    setState(prev => ({ ...prev, isCollapsed: !prev.isCollapsed }));
  }, []);

  const toggleMinimize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  // Utility functions
  const getConnectionStatus = useCallback(() => {
    return {
      isConnected: state.isConnected,
      participantCount: state.participantCount,
    };
  }, [state.isConnected, state.participantCount]);

  // Context value
  const value = useMemo(() => ({
    ...state,
    joinVoiceRoom,
    leaveVoiceRoom,
    toggleMute,
    toggleDeafen,
    toggleHandRaise,
    toggleCollapse,
    toggleMinimize,
    getConnectionStatus,
    watchVoicePresence,
    unwatchVoicePresence,
  }), [
    state,
    joinVoiceRoom,
    leaveVoiceRoom,
    toggleMute,
    toggleDeafen,
    toggleHandRaise,
    toggleCollapse,
    toggleMinimize,
    getConnectionStatus,
    watchVoicePresence,
    unwatchVoicePresence,
  ]);

  return (
    <VoiceRoomContext.Provider value={value}>
      {children}
    </VoiceRoomContext.Provider>
  );
};

// Hook to use voice room context
export const useVoiceRoom = (): VoiceRoomContextType => {
  const context = useContext(VoiceRoomContext);
  if (context === undefined) {
    throw new Error('useVoiceRoom must be used within a VoiceRoomProvider');
  }
  return context;
};