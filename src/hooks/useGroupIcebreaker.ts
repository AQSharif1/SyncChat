import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface GroupIcebreaker {
  id: string;
  group_id: string;
  prompt_text: string;
  generated_from: Record<string, unknown>;
  created_at: string;
  status: 'active' | 'dismissed' | 'expired';
  dismissed_at: string | null;
  first_reply_at: string | null;
}

const ICEBREAKER_TTL_MS = 72 * 60 * 60 * 1000;

function isExpired(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > ICEBREAKER_TTL_MS;
}

export const useGroupIcebreaker = (groupId: string) => {
  const { user } = useAuth();
  const [icebreaker, setIcebreaker] = useState<GroupIcebreaker | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIcebreaker = useCallback(async () => {
    if (!groupId || !user?.id) {
      setLoading(false);
      return;
    }

    try {
      await supabase.rpc('expire_stale_icebreakers', { p_group_id: groupId });

      const { data, error } = await supabase
        .from('group_icebreakers')
        .select('id, group_id, prompt_text, generated_from, created_at, status, dismissed_at, first_reply_at')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        setIcebreaker(null);
        return;
      }

      if (data && isExpired(data.created_at as string)) {
        setIcebreaker(null);
        return;
      }

      setIcebreaker(data as GroupIcebreaker | null);
    } finally {
      setLoading(false);
    }
  }, [groupId, user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchIcebreaker();
  }, [fetchIcebreaker]);

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group_icebreaker_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_icebreakers',
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          fetchIcebreaker();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchIcebreaker]);

  const dismissIcebreaker = useCallback(async () => {
    if (!icebreaker) return false;

    await supabase.rpc('dismiss_group_icebreaker', { p_icebreaker_id: icebreaker.id });
    setIcebreaker(null);
    return true;
  }, [icebreaker]);

  const markFirstReply = useCallback(async () => {
    if (!groupId || !icebreaker) return;
    await supabase.rpc('mark_icebreaker_first_reply', { p_group_id: groupId });
    setIcebreaker((prev) =>
      prev ? { ...prev, first_reply_at: new Date().toISOString() } : prev
    );
  }, [groupId, icebreaker]);

  const isVisible = Boolean(
    icebreaker &&
    icebreaker.status === 'active' &&
    !isExpired(icebreaker.created_at)
  );

  return {
    icebreaker,
    loading,
    isVisible,
    dismissIcebreaker,
    markFirstReply,
    refetch: fetchIcebreaker,
  };
};
