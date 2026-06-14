import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const arrivalKey = (groupId: string, userId: string) =>
  `arrival_seen_${groupId}_${userId}`;

export const useGroupArrival = (groupId: string | undefined) => {
  const { user } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkArrival = useCallback(async () => {
    if (!groupId || !user?.id) {
      setShouldShow(false);
      setLoading(false);
      return;
    }

    if (localStorage.getItem(arrivalKey(groupId, user.id)) === 'true') {
      setShouldShow(false);
      setLoading(false);
      return;
    }

    try {
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', groupId);

      if ((count ?? 0) > 0) {
        localStorage.setItem(arrivalKey(groupId, user.id), 'true');
        setShouldShow(false);
      } else {
        setShouldShow(true);
      }
    } catch {
      setShouldShow(false);
    } finally {
      setLoading(false);
    }
  }, [groupId, user?.id]);

  useEffect(() => {
    checkArrival();
  }, [checkArrival]);

  const markSeen = useCallback(() => {
    if (groupId && user?.id) {
      localStorage.setItem(arrivalKey(groupId, user.id), 'true');
    }
    setShouldShow(false);
  }, [groupId, user?.id]);

  return { shouldShow, loading, markSeen };
};
