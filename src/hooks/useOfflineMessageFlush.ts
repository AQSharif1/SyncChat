import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getQueueForGroup, dequeue } from '@/utils/offlineMessageQueue';
import { useToast } from './use-toast';

export function useOfflineMessageFlush(
  groupId: string,
  onMessageFlushed: (id: string) => void
): void {
  const { toast } = useToast();

  useEffect(() => {
    const flush = async () => {
      const pending = getQueueForGroup(groupId);
      if (pending.length === 0) return;

      toast({
        title: 'Sending queued messages...',
        duration: 2000,
      });

      let sent = 0;
      for (const msg of pending) {
        const { error } = await supabase.from('chat_messages').insert({
          id: msg.id,
          content: msg.content,
          message_type: msg.messageType,
          gif_url: msg.gifUrl,
          user_id: msg.userId,
          group_id: msg.groupId,
        });
        if (!error) {
          dequeue(msg.id);
          onMessageFlushed(msg.id);
          sent++;
        }
      }
      if (sent > 0) {
        toast({
          title: `${sent} message${sent > 1 ? 's' : ''} sent`,
          duration: 2000,
        });
      }
    };

    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [groupId, toast, onMessageFlushed]);
}
