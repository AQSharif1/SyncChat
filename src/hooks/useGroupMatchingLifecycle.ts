import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { assignUserToBestGroup, getTotalProfileCount } from '@/utils/groupAssignment';
import { getMatchingConfig, getMatchingModeLabel } from '@/utils/matchingThreshold';
import { analyticsClient } from '@/utils/analytics';
import type { MatchingProfile } from '@/types/matchingProfile';

export type MatchingLifecycleState = 'idle' | 'waiting_for_group' | 'matched';

interface MatchingLifecycleData {
  totalUserCount: number;
  matchingMode: 'flexible' | 'moderate' | 'strict';
  matchingThreshold: number;
  lifecycleState: MatchingLifecycleState;
  matchedGroupId?: string;
  loading: boolean;
}

function toMatchingProfile(row: Record<string, unknown>): MatchingProfile {
  return {
    username: (row.username as string) ?? '',
    life_stage: (row.life_stage as string) ?? null,
    primary_goals: (row.primary_goals as string[]) ?? [],
    personality_traits: (row.personality_traits as string[]) ?? [],
    activity_level: (row.activity_level as string) ?? null,
    active_period: (row.active_period as string) ?? null,
    interests: (row.interests as string[]) ?? [],
    genres: (row.genres as string[]) ?? [],
    personality: (row.personality as string[]) ?? [],
    habits: (row.habits as string[]) ?? [],
  };
}

export const useGroupMatchingLifecycle = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [lifecycleData, setLifecycleData] = useState<MatchingLifecycleData>({
    totalUserCount: 0,
    matchingMode: 'flexible',
    matchingThreshold: 0.5,
    lifecycleState: 'idle',
    loading: true,
  });

  const refreshLifecycleData = useCallback(async () => {
    if (!user) return;

    try {
      const totalUserCount = await getTotalProfileCount();
      const config = getMatchingConfig(totalUserCount);

      const { data: queueStatus } = await supabase.rpc('get_matching_queue_status', {
        p_user_id: user.id,
      });

      const inQueue = Boolean((queueStatus as { in_queue?: boolean })?.in_queue);
      const matchedGroupId = (queueStatus as { matched_group_id?: string })?.matched_group_id;

      setLifecycleData({
        totalUserCount,
        matchingMode: config.mode,
        matchingThreshold: config.threshold,
        lifecycleState: inQueue ? 'waiting_for_group' : matchedGroupId ? 'matched' : 'idle',
        matchedGroupId: matchedGroupId ?? undefined,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching matching lifecycle data:', error);
      setLifecycleData((prev) => ({ ...prev, loading: false }));
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshLifecycleData();
  }, [user, refreshLifecycleData]);

  useEffect(() => {
    if (!user || lifecycleData.lifecycleState !== 'waiting_for_group') return;

    const checkQueueWait = async () => {
      const { data } = await supabase
        .from('matching_queue')
        .select('queued_at')
        .eq('user_id', user.id)
        .eq('status', 'waiting')
        .maybeSingle();

      if (!data?.queued_at) return;
      const waitMinutes = Math.floor(
        (Date.now() - new Date(data.queued_at as string).getTime()) / (1000 * 60)
      );
      if (waitMinutes > 120) {
        analyticsClient.track('matching_queue_wait_exceeded', { wait_minutes: waitMinutes });
      }
    };

    checkQueueWait();
    const interval = setInterval(checkQueueWait, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, lifecycleData.lifecycleState]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`matching_lifecycle_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matching_queue',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as {
            status?: string;
            matched_group_id?: string;
            queued_at?: string;
            matched_at?: string;
          };
          if (next.status === 'matched' && next.matched_group_id) {
            const queuedAt = next.queued_at ? new Date(next.queued_at).getTime() : null;
            const matchedAt = next.matched_at ? new Date(next.matched_at).getTime() : Date.now();
            const waitMinutes = queuedAt
              ? Math.round((matchedAt - queuedAt) / (1000 * 60))
              : 0;

            analyticsClient.track('matching_completed_from_queue', {
              wait_time_minutes: waitMinutes,
              compatibility_score: 0,
            });

            setLifecycleData((prev) => ({
              ...prev,
              lifecycleState: 'matched',
              matchedGroupId: next.matched_group_id,
            }));
            window.dispatchEvent(
              new CustomEvent('matching:group-ready', {
                detail: { groupId: next.matched_group_id },
              })
            );
          } else if (next.status === 'waiting') {
            setLifecycleData((prev) => ({ ...prev, lifecycleState: 'waiting_for_group' }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const findAndJoinGroupWithCapacityCheck = async (
    matchingMode: 'flexible' | 'moderate' | 'strict',
    userProfile?: Record<string, unknown>
  ) => {
    if (!user || !userProfile) return null;

    try {
      const profile = toMatchingProfile(userProfile);
      const config = getMatchingConfig(await getTotalProfileCount());
      const effectiveMode = matchingMode || config.mode;

      const assignment = await assignUserToBestGroup(profile, user.id, effectiveMode);

      if (!assignment) {
        throw new Error('Failed to find or queue you for matching');
      }

      if (assignment.status === 'waiting') {
        setLifecycleData((prev) => ({
          ...prev,
          lifecycleState: 'waiting_for_group',
        }));

        return {
          status: 'waiting_for_group' as const,
          queueId: assignment.queueId,
        };
      }

      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', assignment.groupId);

      if ((count ?? 0) < 2) {
        console.warn('[Matching] Landed in solo group, re-queuing user');
        analyticsClient.track('matching_queued', {
          life_stage: profile.life_stage ?? 'unknown',
          is_priority: false,
        });
        setLifecycleData((prev) => ({
          ...prev,
          lifecycleState: 'waiting_for_group',
        }));
        return {
          status: 'waiting_for_group' as const,
        };
      }

      await supabase
        .from('profiles')
        .update({ group_id: assignment.groupId })
        .eq('user_id', user.id);

      toast({
        title: 'Group Matched!',
        description: assignment.created
          ? "We've placed you in a new curated group."
          : `Matched in ${getMatchingModeLabel(config.mode)}.`,
      });

      setLifecycleData((prev) => ({
        ...prev,
        lifecycleState: 'matched',
        matchedGroupId: assignment.groupId,
      }));

      return {
        status: 'matched' as const,
        groupId: assignment.groupId,
        groupName: profile.life_stage ?? 'New Group',
        score: assignment.score,
        created: assignment.created,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Match failed';
      toast({
        title: 'Match Failed',
        description: message,
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    lifecycleData,
    refreshLifecycleData,
    findAndJoinGroupWithCapacityCheck,
  };
};
