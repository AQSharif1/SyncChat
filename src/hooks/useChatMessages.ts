import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useModeration } from './useModeration';
import { useNetworkResilience } from './useNetworkResilience';
import { enqueue, type QueuedMessage } from '@/utils/offlineMessageQueue';
import { toast } from 'sonner';

export const AI_HOST_USER_ID = '00000000-0000-4000-8000-000000000001';
export const MESSAGE_FETCH_LIMIT = 200;

export interface ChatMessage {
  id: string;
  content?: string;
  messageType: 'text' | 'gif' | 'voice' | 'ai_host';
  gifUrl?: string;
  voiceAudioUrl?: string;
  voiceTranscription?: string;
  username: string;
  timestamp: Date;
  userId: string;
  reactions?: { emoji: string; count: number; userIds: string[] }[];
  isPending?: boolean;
}

export const useChatMessages = (groupId: string) => {
  const { user } = useAuth();
  const { checkCanSendMessage, getBlockedUserIds, getMutedUserIds } = useModeration();
  const { isOnline } = useNetworkResilience();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const hiddenUserIdsRef = useRef<Set<string>>(new Set());
  
  // Message cache for performance optimization
  const messageCache = useRef<Map<string, { data: ChatMessage[]; timestamp: number }>>(new Map());
  const CACHE_DURATION = 30000; // 30 seconds

  const fetchMessages = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Check cache first (unless force refresh)
      const cacheKey = `${groupId}-${user?.id}-${MESSAGE_FETCH_LIMIT}`;
      const now = Date.now();
      
      if (!forceRefresh && messageCache.current.has(cacheKey)) {
        const cached = messageCache.current.get(cacheKey);
        if (cached && (now - cached.timestamp) < CACHE_DURATION) {
          console.log('Using cached messages for group:', groupId);
          setMessages(cached.data);
          setLoading(false);
          return cached.data;
        }
      }
      
      console.log('Fetching messages for group:', groupId);
      
      // Fetch messages with proper JOIN to profiles table
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          message_type,
          gif_url,
          voice_audio_url,
          voice_transcription,
          created_at,
          user_id,
          profiles!inner(
            user_id,
            username,
            mood_emoji
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(MESSAGE_FETCH_LIMIT);

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        throw messagesError;
      }

      // Fetch message reactions separately
      const messageIds = messagesData?.map(msg => msg.id) || [];
      const { data: reactionsData, error: reactionsError } = await supabase
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', messageIds);

      if (reactionsError) {
        console.warn('Error fetching reactions:', reactionsError);
      }

      console.log('Messages fetched:', messagesData?.length || 0);

      // Transform to ChatMessage format with proper profile data
      const transformedMessages: ChatMessage[] = messagesData?.map(msg => {
        // Group reactions by emoji for this message
        const messageReactions = reactionsData?.filter(r => r.message_id === msg.id) || [];
        const reactionGroups = messageReactions.reduce((acc: any[], reaction) => {
          const existing = acc.find(r => r.emoji === reaction.emoji);
          if (existing) {
            existing.count += 1;
            existing.userIds.push(reaction.user_id);
          } else {
            acc.push({
              emoji: reaction.emoji,
              count: 1,
              userIds: [reaction.user_id]
            });
          }
          return acc;
        }, []);

        // Use profile data from the JOIN
        const profile = msg.profiles;
        const displayName = profile?.username || 'Unknown User';

        return {
          id: msg.id,
          content: msg.content,
          messageType: msg.message_type as ChatMessage['messageType'],
          gifUrl: msg.gif_url,
          voiceAudioUrl: msg.voice_audio_url,
          voiceTranscription: msg.voice_transcription,
          username: displayName,
          timestamp: new Date(msg.created_at),
          userId: msg.user_id,
          reactions: reactionGroups
        };
      }) || [];

      const [blocked, muted] = await Promise.all([getBlockedUserIds(), getMutedUserIds()]);
      const hidden = new Set([...blocked, ...muted]);
      hiddenUserIdsRef.current = hidden;

      const visibleMessages = transformedMessages.filter((m) => !hidden.has(m.userId));

      console.log('Transformed messages:', visibleMessages.length);
      setMessages(visibleMessages);
      
      // Cache the results
      messageCache.current.set(cacheKey, {
        data: transformedMessages,
        timestamp: now
      });
      
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [groupId, user?.id]);

  const setupRealtimeSubscription = useCallback(() => {
    console.log('Setting up real-time subscription for group:', groupId);
    
    const channelName = `chat-${groupId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${groupId}`
        },
        async (payload) => {
          console.log('🆕 NEW MESSAGE RECEIVED:', payload.new);
          
          // Get profile data for the new message
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('user_id, username, mood_emoji')
              .eq('user_id', payload.new.user_id)
              .single();

            const isAiHost =
              payload.new.user_id === AI_HOST_USER_ID ||
              payload.new.message_type === 'ai_host';

            if (profileData || isAiHost) {
              const profile = profileData;
              const displayName = isAiHost
                ? 'Group Host'
                : profile?.username || 'Unknown User';
              
              const newMessage: ChatMessage = {
                id: payload.new.id,
                content: payload.new.content,
                messageType: payload.new.message_type as ChatMessage['messageType'],
                gifUrl: payload.new.gif_url,
                voiceAudioUrl: payload.new.voice_audio_url,
                voiceTranscription: payload.new.voice_transcription,
                username: displayName,
                timestamp: new Date(payload.new.created_at),
                userId: payload.new.user_id,
                reactions: []
              };

              if (!hiddenUserIdsRef.current.has(newMessage.userId)) {
                setMessages((prev) => {
                  const withoutDuplicate = prev.filter((m) => m.id !== newMessage.id);
                  const updated = [...withoutDuplicate, newMessage];
                  return updated.length > MESSAGE_FETCH_LIMIT
                    ? updated.slice(updated.length - MESSAGE_FETCH_LIMIT)
                    : updated;
                });
              }
            } else {
              // Fallback to refetch if profile not found
              setTimeout(() => fetchMessages(), 100);
            }
          } catch (error) {
            console.error('Error fetching profile for new message:', error);
            // Fallback to refetch
            setTimeout(() => fetchMessages(), 100);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          console.log('👍 NEW REACTION:', payload.new);
          setTimeout(() => fetchMessages(), 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          console.log('👎 REACTION REMOVED:', payload.old);
          setTimeout(() => fetchMessages(), 100);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return () => {
      console.log('🧹 Cleaning up subscription:', channelName);
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchMessages]);

  useEffect(() => {
    if (groupId) {
      console.log('🚀 Setting up chat for group:', groupId);
      fetchMessages();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [groupId, fetchMessages, setupRealtimeSubscription]);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const addMessage = async (messageData: {
    content?: string;
    messageType: 'text' | 'gif' | 'voice';
    gifUrl?: string;
    voiceAudioUrl?: string;
    voiceTranscription?: string;
  }): Promise<boolean> => {
    if (!user) {
      console.error('No user found when trying to send message');
      return false;
    }

    const canQueue =
      messageData.messageType === 'text' || messageData.messageType === 'gif';

    if (!isOnline && canQueue) {
      const queued: QueuedMessage = {
        id: crypto.randomUUID(),
        groupId,
        content: messageData.content,
        messageType: messageData.messageType as 'text' | 'gif',
        gifUrl: messageData.gifUrl,
        userId: user.id,
        queuedAt: Date.now(),
      };
      enqueue(queued);
      setMessages((prev) => {
        const optimistic: ChatMessage = {
          id: queued.id,
          content: queued.content,
          messageType: queued.messageType,
          gifUrl: queued.gifUrl,
          username: 'You',
          timestamp: new Date(),
          userId: user.id,
          reactions: [],
          isPending: true,
        };
        const updated = [...prev, optimistic];
        return updated.length > MESSAGE_FETCH_LIMIT
          ? updated.slice(updated.length - MESSAGE_FETCH_LIMIT)
          : updated;
      });
      toast.info('Queued — will send when back online');
      return true;
    }

    try {
      const rateCheck = await checkCanSendMessage();
      if (!rateCheck.allowed) {
        const retrySec = rateCheck.retry_after_seconds;
        toast.error(
          rateCheck.reason === 'account_restricted'
            ? 'Your account has a temporary restriction.'
            : retrySec
              ? `Please wait ${retrySec}s before sending another message.`
              : 'Message rate limit reached. Please slow down.'
        );
        return false;
      }

      console.log('📤 SENDING MESSAGE:', messageData);

      const messageToInsert = {
        content: messageData.content,
        message_type: messageData.messageType,
        gif_url: messageData.gifUrl,
        voice_audio_url: messageData.voiceAudioUrl,
        voice_transcription: messageData.voiceTranscription,
        user_id: user.id,
        group_id: groupId
      };

      console.log('💾 Inserting into database:', messageToInsert);

      const { data, error } = await supabase
        .from('chat_messages')
        .insert(messageToInsert)
        .select();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Message inserted successfully:', data);
      
      // Track karma activity for the message (only if groupId is valid)
      if (groupId && groupId.trim() !== '') {
        try {
          await supabase.rpc('track_karma_activity', {
            p_user_id: user.id,
            p_group_id: groupId,
            p_activity_type: 'message',
            p_points: 1,
            p_description: 'Sent a message',
            p_multiplier: 1.0
          });
        } catch (karmaError) {
          console.warn('Failed to track karma for message:', karmaError);
        }
      } else {
        console.warn('Cannot track karma for message: invalid groupId', { groupId });
      }
      
      supabase.rpc('compute_user_reputation', { p_user_id: user.id }).catch(() => {});

      return true;
      
    } catch (error) {
      console.error('💥 Error adding message:', error);
      toast.error('Failed to send message');
      return false;
    }
  };

  const addReaction = async (messageId: string, emoji: string): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('Adding reaction:', { messageId, emoji, userId: user.id });
      
      // Get the message to find the group_id for karma tracking
      const { data: messageData } = await supabase
        .from('chat_messages')
        .select('group_id, message_type, user_id')
        .eq('id', messageId)
        .single();

      const isAiHostMessage =
        messageData?.message_type === 'ai_host' ||
        messageData?.user_id === AI_HOST_USER_ID;
      
      // Check if user already reacted with this emoji
      const { data: existingReaction } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existingReaction) {
        // Remove existing reaction
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;
        console.log('Reaction removed');
      } else {
        // Add new reaction
        const { error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji
          });

        if (error) throw error;
        console.log('Reaction added');
        
        // Track karma activity for the reaction (skip AI host messages)
        if (
          !isAiHostMessage &&
          messageData?.group_id &&
          messageData.group_id.trim() !== ''
        ) {
          try {
            await supabase.rpc('track_karma_activity', {
              p_user_id: user.id,
              p_group_id: messageData.group_id,
              p_activity_type: 'reaction',
              p_points: 1,
              p_description: 'Gave a reaction',
              p_multiplier: 1.0
            });
          } catch (karmaError) {
            console.warn('Failed to track karma for reaction:', karmaError);
          }
        } else {
          console.warn('Cannot track karma for reaction: invalid group_id', { group_id: messageData?.group_id });
        }
      }

      return true;
    } catch (error) {
      console.error('Error handling reaction:', error);
      toast.error('Failed to add reaction');
      return false;
    }
  };

  return {
    messages,
    loading,
    addMessage,
    addReaction,
    removeMessage,
    refetch: fetchMessages,
  };
};