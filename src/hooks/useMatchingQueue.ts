import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { MatchingProfile } from '@/types/matchingProfile';

export interface MatchingQueueStatus {
  inQueue: boolean;
  queueId?: string;
  status?: string;
  lifeStage?: string | null;
  matchingProfile?: Partial<MatchingProfile>;
  notifyWhenReady: boolean;
  isPriority: boolean;
  isPremium: boolean;
  waitingSameStage: number;
  waitingTotal: number;
  matchedGroupId?: string | null;
}

interface QueueStatusPayload {
  in_queue?: boolean;
  queue_id?: string;
  status?: string;
  life_stage?: string | null;
  matching_profile?: Partial<MatchingProfile>;
  notify_when_ready?: boolean;
  is_priority?: boolean;
  is_premium?: boolean;
  waiting_same_stage?: number;
  waiting_total?: number;
  matched_group_id?: string | null;
}

function parseQueueStatus(data: QueueStatusPayload): MatchingQueueStatus {
  return {
    inQueue: Boolean(data.in_queue),
    queueId: data.queue_id,
    status: data.status,
    lifeStage: data.life_stage,
    matchingProfile: data.matching_profile,
    notifyWhenReady: Boolean(data.notify_when_ready),
    isPriority: Boolean(data.is_priority),
    isPremium: Boolean(data.is_premium),
    waitingSameStage: data.waiting_same_stage ?? 0,
    waitingTotal: data.waiting_total ?? 0,
    matchedGroupId: data.matched_group_id,
  };
}

export const useMatchingQueue = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<MatchingQueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('get_matching_queue_status', {
        p_user_id: user.id,
      });

      if (error) throw error;

      const parsed = parseQueueStatus((data ?? {}) as QueueStatusPayload);
      setStatus(parsed);
      return parsed;
    } catch (error) {
      console.error('Error fetching matching queue status:', error);
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const setNotifyWhenReady = useCallback(
    async (notify: boolean) => {
      if (!user) return false;

      const { data, error } = await supabase.rpc('set_matching_queue_notify', {
        p_user_id: user.id,
        p_notify: notify,
      });

      if (error) return false;

      setStatus((prev) => (prev ? { ...prev, notifyWhenReady: notify } : prev));
      return Boolean(data);
    },
    [user]
  );

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`matching_queue_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matching_queue',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshStatus]);

  return {
    status,
    loading,
    refreshStatus,
    setNotifyWhenReady,
    isWaiting: Boolean(status?.inQueue),
  };
};
