import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { assignUserToBestGroup } from '@/utils/groupAssignment';
import { buildMatchExperience, type MatchExperienceData } from '@/utils/matchExplanation';
import type { MatchingProfile } from '@/types/matchingProfile';

export interface OnboardingGroupInfo {
  id: string;
  name: string;
  vibe_label: string;
  description?: string | null;
  group_type?: string | null;
  identity_tags?: string[] | null;
  current_members: number;
  max_members: number;
}

export interface OnboardingCompleteResult {
  success: boolean;
  error?: string;
  groupId?: string;
  profile?: MatchingProfile;
  group?: OnboardingGroupInfo;
  matchExperience?: MatchExperienceData;
  waitingForGroup?: boolean;
  queueId?: string;
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

  return (profiles ?? []).map((row) => toMatchingProfile(row as Record<string, unknown>));
}

export const useOnboardingCompletion = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const validateProfile = (profile: MatchingProfile): { isValid: boolean; error?: string } => {
    if (!profile.username?.trim()) {
      return { isValid: false, error: 'Username is required' };
    }
    if (!profile.life_stage) {
      return { isValid: false, error: 'Life stage is required' };
    }
    if (!profile.primary_goals?.length) {
      return { isValid: false, error: 'At least one primary goal is required' };
    }
    if (profile.personality_traits.length < 3 || profile.personality_traits.length > 5) {
      return { isValid: false, error: 'Select 3–5 personality traits' };
    }
    if (!profile.activity_level) {
      return { isValid: false, error: 'Activity level is required' };
    }
    if (!profile.active_period) {
      return { isValid: false, error: 'Schedule preference is required' };
    }
    return { isValid: true };
  };

  const completeOnboarding = async (
    userProfile: MatchingProfile
  ): Promise<OnboardingCompleteResult> => {
    if (!user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const validation = validateProfile(userProfile);
    if (!validation.isValid) {
      toast({
        title: 'Profile Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return { success: false, error: validation.error };
    }

    setIsProcessing(true);

    try {
      const profileData = {
        user_id: user.id,
        username: userProfile.username.trim(),
        life_stage: userProfile.life_stage,
        primary_goals: userProfile.primary_goals,
        personality_traits: userProfile.personality_traits,
        activity_level: userProfile.activity_level,
        active_period: userProfile.active_period,
        interests: userProfile.interests ?? [],
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase.from('profiles').upsert(profileData);

      if (profileError) {
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }

      const assignment = await assignUserToBestGroup(userProfile, user.id);

      if (!assignment) {
        throw new Error('Failed to assign you to a group');
      }

      if (assignment.status === 'waiting') {
        return {
          success: true,
          waitingForGroup: true,
          queueId: assignment.queueId,
          profile: userProfile,
        };
      }

      await supabase
        .from('profiles')
        .update({ group_id: assignment.groupId })
        .eq('user_id', user.id);

      const { data: groupInfo } = await supabase
        .from('groups')
        .select(
          'id, name, description, group_type, vibe_label, identity_tags, current_members, max_members'
        )
        .eq('id', assignment.groupId)
        .single();

      const memberProfiles = await fetchGroupMemberProfiles(assignment.groupId);
      const matchExperience = buildMatchExperience(
        userProfile,
        memberProfiles,
        assignment.score,
        assignment.created
      );

      const group: OnboardingGroupInfo = {
        id: assignment.groupId,
        name: groupInfo?.name ?? 'Your Community',
        vibe_label: groupInfo?.vibe_label ?? 'Friendly conversations',
        description: groupInfo?.description,
        group_type: groupInfo?.group_type,
        identity_tags: groupInfo?.identity_tags,
        current_members: groupInfo?.current_members ?? memberProfiles.length,
        max_members: groupInfo?.max_members ?? 8,
      };

      supabase
        .rpc('post_new_member_welcome', {
          p_group_id: assignment.groupId,
          p_community_name: group.name,
        })
        .catch(() => {});

      window.dispatchEvent(
        new CustomEvent('onboarding:complete', {
          detail: { groupId: assignment.groupId },
        })
      );

      localStorage.removeItem('incomplete_signup_time');
      localStorage.removeItem('onboarding_skipped');

      return {
        success: true,
        groupId: assignment.groupId,
        profile: userProfile,
        group,
        matchExperience,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        title: 'Onboarding Failed',
        description: message,
        variant: 'destructive',
      });
      return { success: false, error: message };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    completeOnboarding,
    isProcessing,
  };
};
