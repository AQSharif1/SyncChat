import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface DMAllowanceStats {
  activeConversationCount: number;
  totalConversationCount: number;
  accountAgeDays: number;
  loading: boolean;
}

export const useDMAllowance = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DMAllowanceStats>({
    activeConversationCount: 0,
    totalConversationCount: 0,
    accountAgeDays: 0,
    loading: true,
  });

  const refreshStats = useCallback(async () => {
    if (!user) {
      setStats({
        activeConversationCount: 0,
        totalConversationCount: 0,
        accountAgeDays: 0,
        loading: false,
      });
      return;
    }

    try {
      const [activeRes, totalRes, ageRes] = await Promise.all([
        supabase.rpc('count_active_dm_conversations', { p_user_id: user.id }),
        supabase.rpc('count_total_dm_conversations', { p_user_id: user.id }),
        supabase.rpc('get_user_account_age_days', { p_user_id: user.id }),
      ]);

      setStats({
        activeConversationCount: Number(activeRes.data) || 0,
        totalConversationCount: Number(totalRes.data) || 0,
        accountAgeDays: Number(ageRes.data) || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading DM allowance stats:', error);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  }, [user]);

  const hasExistingDMWith = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      if (!user) return false;

      const { data, error } = await supabase.rpc('has_existing_dm_with', {
        p_user_id: user.id,
        p_target_user_id: targetUserId,
      });

      if (error) return false;
      return Boolean(data);
    },
    [user]
  );

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return {
    ...stats,
    refreshStats,
    hasExistingDMWith,
  };
};
