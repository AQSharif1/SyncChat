import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type SeasonContinuationChoice = 'stay' | 'refresh' | 'memories_only';

export interface GroupLifecycleData {
  groupId: string;
  seasonId: string | null;
  seasonNumber: number | null;
  createdAt: Date;
  nextVoteDate: Date | null;
  isExtended: boolean;
  continuationActive: boolean;
  lifecycleStage: string;
  choiceDeadline: Date | null;
  userChoice: SeasonContinuationChoice | null;
  choiceCounts: {
    stay: number;
    refresh: number;
    memories_only: number;
    total: number;
    members: number;
  } | null;
  daysRemaining: number;
}

export const useGroupLifecycle = (groupId: string | null) => {
  const { user } = useAuth();
  const [lifecycleData, setLifecycleData] = useState<GroupLifecycleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && groupId) {
      fetchLifecycleData();

      const channel = supabase
        .channel('group-lifecycle')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'groups',
          filter: `id=eq.${groupId}`,
        }, () => {
          fetchLifecycleData();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'group_season_choices',
          filter: `group_id=eq.${groupId}`,
        }, () => {
          fetchLifecycleData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, groupId]);

  const fetchLifecycleData = async () => {
    if (!user || !groupId) return;

    try {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;

      const { data: activeSeason } = await supabase
        .from('group_seasons')
        .select('id, season_number, started_at')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .maybeSingle();

      let userChoice: SeasonContinuationChoice | null = null;
      let choiceCounts = null;

      const continuationActive =
        group.vote_active || group.lifecycle_stage === 'continuation_period';

      if (continuationActive && activeSeason) {
        const { data: choice } = await supabase
          .from('group_season_choices')
          .select('choice')
          .eq('group_id', groupId)
          .eq('season_id', activeSeason.id)
          .eq('user_id', user.id)
          .maybeSingle();

        userChoice = (choice?.choice as SeasonContinuationChoice) ?? null;

        const { data: countsResult } = await supabase.rpc('get_season_choice_counts', {
          p_group_id: groupId,
          p_season_id: activeSeason.id,
        });

        const counts = countsResult as {
          ok?: boolean;
          stay?: number;
          refresh?: number;
          memories_only?: number;
          total?: number;
          members?: number;
        };

        if (counts?.ok) {
          choiceCounts = {
            stay: counts.stay ?? 0,
            refresh: counts.refresh ?? 0,
            memories_only: counts.memories_only ?? 0,
            total: counts.total ?? 0,
            members: counts.members ?? group.current_members,
          };
        }
      }

      const seasonAnchor = activeSeason?.started_at ?? group.created_at;
      const createdAt = new Date(seasonAnchor);
      const thirtyDaysFromSeason = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.max(
        0,
        Math.ceil((thirtyDaysFromSeason.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      );

      setLifecycleData({
        groupId,
        seasonId: activeSeason?.id ?? null,
        seasonNumber: activeSeason?.season_number ?? null,
        createdAt,
        nextVoteDate: group.next_vote_date ? new Date(group.next_vote_date) : null,
        isExtended: group.is_extended,
        continuationActive,
        lifecycleStage: group.lifecycle_stage,
        choiceDeadline: group.vote_deadline ? new Date(group.vote_deadline) : null,
        userChoice,
        choiceCounts,
        daysRemaining,
      });
    } catch (error) {
      console.error('Error fetching lifecycle data:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitChoice = async (choice: SeasonContinuationChoice) => {
    if (!user || !groupId || !lifecycleData?.seasonId) return false;

    try {
      const { data, error } = await supabase.rpc('submit_season_choice', {
        p_group_id: groupId,
        p_season_id: lifecycleData.seasonId,
        p_choice: choice,
      });

      if (error) throw error;

      const result = data as { ok?: boolean; error?: string };
      if (!result?.ok) {
        throw new Error(result?.error ?? 'Failed to submit choice');
      }

      await fetchLifecycleData();
      return true;
    } catch (error) {
      console.error('Error submitting season choice:', error);
      return false;
    }
  };

  return {
    lifecycleData,
    loading,
    submitChoice,
    refresh: fetchLifecycleData,
  };
};
