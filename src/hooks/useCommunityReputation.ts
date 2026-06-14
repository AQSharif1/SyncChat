import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { CommunityReputationData, ReputationAchievement, ReputationTier } from '@/types/communityReputation';

const EMPTY: CommunityReputationData = {
  score: 0,
  tier: 'new_member',
  tier_label: 'New Member',
  positive: 0,
  negative: 0,
  achievements: [],
  loading: true,
};

export const useCommunityReputation = (targetUserId?: string) => {
  const { user } = useAuth();
  const userId = targetUserId ?? user?.id;
  const [data, setData] = useState<CommunityReputationData>(EMPTY);

  const loadReputation = useCallback(async () => {
    if (!userId) {
      setData({ ...EMPTY, loading: false });
      return;
    }

    setData((prev) => ({ ...prev, loading: true }));

    try {
      const { data: result, error } = await supabase.rpc('get_user_reputation', {
        p_user_id: userId,
      });

      if (error) throw error;

      const payload = result as {
        score?: number;
        tier?: ReputationTier;
        tier_label?: string;
        positive?: number;
        negative?: number;
        achievements?: ReputationAchievement[];
        error?: string;
      };

      if (payload.error) throw new Error(payload.error);

      setData({
        score: payload.score ?? 0,
        tier: payload.tier ?? 'new_member',
        tier_label: payload.tier_label ?? 'New Member',
        positive: payload.positive ?? 0,
        negative: payload.negative ?? 0,
        achievements: payload.achievements ?? [],
        loading: false,
      });
    } catch (error) {
      console.error('Error loading community reputation:', error);
      setData({ ...EMPTY, loading: false });
    }
  }, [userId]);

  useEffect(() => {
    loadReputation();
  }, [loadReputation]);

  return { ...data, refresh: loadReputation };
};
