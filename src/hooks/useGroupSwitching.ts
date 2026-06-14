import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  COMPATIBILITY_THRESHOLD,
  type MatchingProfile,
} from '@/types/matchingProfile';
import {
  aggregateGroupProfile,
  calculateCompatibilityScore,
} from '@/utils/compatibilityScoring';
import { joinGroupSafe } from '@/utils/groupAssignment';

interface GroupSwitchData {
  canSwitch: boolean;
  remainingSwitches: number;
  switchLimit: number;
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

async function fetchGroupMemberProfiles(groupId: string): Promise<MatchingProfile[]> {
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  if (!members?.length) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'username, life_stage, primary_goals, personality_traits, activity_level, active_period, interests, genres, personality, habits'
    )
    .in(
      'user_id',
      members.map((m) => m.user_id)
    );

  return (profiles ?? []).map(toMatchingProfile);
}

export const useGroupSwitching = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [switchData, setSwitchData] = useState<GroupSwitchData>({
    canSwitch: false,
    remainingSwitches: 0,
    switchLimit: 1,
    loading: true,
  });

  useEffect(() => {
    if (user) {
      fetchSwitchData();
    }
  }, [user]);

  const fetchSwitchData = async () => {
    if (!user) return;

    try {
      setSwitchData((prev) => ({ ...prev, loading: true }));

      const { data: remainingData, error: remainingError } = await supabase.rpc(
        'get_remaining_switches',
        { p_user_id: user.id }
      );

      if (remainingError) throw remainingError;

      const { data: limitData, error: limitError } = await supabase.rpc(
        'get_user_switch_limit',
        { p_user_id: user.id }
      );

      if (limitError) throw limitError;

      const { data: canSwitchData, error: canSwitchError } = await supabase.rpc(
        'can_user_switch_groups',
        { p_user_id: user.id }
      );

      if (canSwitchError) throw canSwitchError;

      setSwitchData({
        canSwitch: canSwitchData,
        remainingSwitches: remainingData,
        switchLimit: limitData,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching switch data:', error);
      setSwitchData((prev) => ({ ...prev, loading: false }));
    }
  };

  const findSimilarGroup = async (currentGroupId: string) => {
    if (!user) return null;

    try {
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      const userProfile = toMatchingProfile(profileRow);

      const { data: availableGroups, error: groupsError } = await supabase.rpc(
        'get_available_groups',
        { p_limit: 50 }
      );

      if (groupsError) throw groupsError;

      const groupsWithCapacity = (availableGroups ?? []).filter(
        (group) => group.id !== currentGroupId
      );
      if (!groupsWithCapacity.length) return null;

      const scoredGroups = await Promise.all(
        groupsWithCapacity.map(async (group) => {
          const memberProfiles = await fetchGroupMemberProfiles(group.id);
          const aggregate = aggregateGroupProfile(memberProfiles);
          if (group.current_members > 0 && aggregate.memberCount === 0) {
            return { ...group, score: 0 };
          }
          const score = calculateCompatibilityScore(userProfile, aggregate);
          return { ...group, score };
        })
      );

      const qualified = scoredGroups
        .filter((g) => g.score >= COMPATIBILITY_THRESHOLD)
        .sort((a, b) => b.score - a.score);

      return qualified[0] ?? null;
    } catch (error) {
      console.error('Error finding similar group:', error);
      return null;
    }
  };

  const switchToGroup = async (newGroupId: string, currentGroupId: string) => {
    if (!user) return false;

    try {
      const { data: switchUsed, error: switchError } = await supabase.rpc('use_group_switch', {
        p_user_id: user.id,
      });

      if (switchError) throw switchError;
      if (!switchUsed) {
        toast({
          title: 'Switch Limit Reached',
          description: "You've used your group switch for this season.",
          variant: 'destructive',
        });
        return false;
      }

      const { data: removeResult, error: removeError } = await supabase.rpc(
        'remove_user_from_group',
        { p_group_id: currentGroupId, p_user_id: user.id }
      );

      if (removeError) throw removeError;
      const removePayload = removeResult as { success?: boolean; error?: string };
      if (!removePayload?.success) {
        throw new Error(removePayload?.error ?? 'Failed to leave current group');
      }

      const joinResult = await joinGroupSafe(newGroupId);
      if (!joinResult.ok) {
        throw new Error(joinResult.error ?? 'Failed to join new group');
      }

      await fetchSwitchData();

      toast({
        title: 'Successfully Switched Groups!',
        description: 'Welcome to your new group chat!',
      });

      return true;
    } catch (error) {
      console.error('Error switching groups:', error);
      toast({
        title: 'Switch Failed',
        description: 'Failed to switch groups. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const performGroupSwitch = async (currentGroupId: string) => {
    if (!switchData.canSwitch) {
      toast({
        title: 'No Switches Available',
        description: "You've used your group switch for this season.",
        variant: 'destructive',
      });
      return { success: false, newGroupId: null };
    }

    const targetGroup = await findSimilarGroup(currentGroupId);

    if (!targetGroup) {
      toast({
        title: 'No Compatible Groups',
        description: 'No groups meet the 70% compatibility threshold. Try again later.',
        variant: 'destructive',
      });
      return { success: false, newGroupId: null };
    }

    const success = await switchToGroup(targetGroup.id, currentGroupId);
    return { success, newGroupId: success ? targetGroup.id : null, newGroupData: targetGroup };
  };

  return {
    ...switchData,
    performGroupSwitch,
    refreshSwitchData: fetchSwitchData,
  };
};
