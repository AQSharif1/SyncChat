import { supabase } from '@/integrations/supabase/client';
import {
  GROUP_MAX_MEMBERS,
  type MatchingProfile,
} from '@/types/matchingProfile';
import {
  aggregateGroupProfile,
  calculateCompatibilityScore,
  generateGroupIdentity,
} from '@/utils/compatibilityScoring';
import { migrateGroupIdentityIfNeeded } from '@/utils/groupIdentityMigration';
import { analyticsClient } from '@/utils/analytics';
import {
  getMatchingConfig,
  INCOMPATIBLE_SCORE,
  LOOSE_JOIN_SCORE,
  SEED_GROUP_MIN_SCORE,
  MIN_VIABLE_GROUP_SIZE,
  type MatchingConfig,
} from '@/utils/matchingThreshold';

export interface ScoredGroup {
  id: string;
  name: string;
  score: number;
  current_members: number;
  max_members: number;
  is_seed_group: boolean;
}

export type AssignmentResult =
  | { status: 'matched'; groupId: string; created: boolean; score: number; groupSize: number; wasSeedGroup: boolean }
  | { status: 'waiting'; queueId: string };

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

function profileToJson(profile: MatchingProfile): Record<string, unknown> {
  return {
    life_stage: profile.life_stage,
    primary_goals: profile.primary_goals,
    personality_traits: profile.personality_traits,
    activity_level: profile.activity_level,
    active_period: profile.active_period,
    interests: profile.interests ?? [],
  };
}

async function fetchGroupMemberProfiles(groupId: string): Promise<MatchingProfile[]> {
  const { data: members, error: membersError } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId);

  if (membersError || !members?.length) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(
      'username, life_stage, primary_goals, personality_traits, activity_level, active_period, interests, genres, personality, habits'
    )
    .in('user_id', userIds);

  if (profilesError || !profiles) return [];
  return profiles.map(toMatchingProfile);
}

export async function getTotalProfileCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_total_profile_count');
  if (error) {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    return count ?? 0;
  }
  return Number(data) || 0;
}

export async function scoreAvailableGroups(
  userProfile: MatchingProfile,
  userId?: string
): Promise<ScoredGroup[]> {
  const { data: availableGroups, error } = await supabase.rpc('get_available_groups', {
    p_limit: 50,
  });

  if (error || !availableGroups?.length) return [];

  let reputationBoost = 0;
  if (userId) {
    const { data: boost } = await supabase.rpc('get_reputation_match_boost', {
      p_user_id: userId,
    });
    reputationBoost = Number(boost) || 0;
  }

  const scored: ScoredGroup[] = [];

  for (const group of availableGroups) {
    const memberProfiles = await fetchGroupMemberProfiles(group.id);
    const aggregate = aggregateGroupProfile(memberProfiles);

    if (group.current_members > 0 && aggregate.memberCount === 0) {
      continue;
    }

    const score = calculateCompatibilityScore(userProfile, aggregate, reputationBoost);

    scored.push({
      id: group.id,
      name: group.name,
      score,
      current_members: group.current_members,
      max_members: group.max_members ?? GROUP_MAX_MEMBERS,
      is_seed_group: Boolean(group.is_seed_group),
    });
  }

  return scored.sort((a, b) => {
    if (a.is_seed_group !== b.is_seed_group) return a.is_seed_group ? -1 : 1;
    if (a.current_members > 0 && b.current_members === 0) return -1;
    if (b.current_members > 0 && a.current_members === 0) return 1;
    return b.score - a.score;
  });
}

export async function joinGroupSafe(groupId: string): Promise<{
  ok: boolean;
  error?: string;
  members?: number;
}> {
  const { data, error } = await supabase.rpc('join_group_safe', {
    p_group_id: groupId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const result = data as { ok?: boolean; error?: string; members?: number };
  return {
    ok: !!result?.ok,
    error: result?.error,
    members: result?.members,
  };
}

async function tryJoinGroup(
  group: ScoredGroup
): Promise<{ groupId: string; score: number; groupSize: number; wasSeedGroup: boolean } | null> {
  const joinResult = await joinGroupSafe(group.id);
  if (!joinResult.ok) return null;
  migrateGroupIdentityIfNeeded(group.id).catch(() => {});

  if ((joinResult.members ?? group.current_members + 1) >= 2) {
    supabase.functions.invoke('generate-icebreaker', {
      body: { group_id: group.id, triggered_by: 'group_join' },
    }).catch(() => {});
  }

  return {
    groupId: group.id,
    score: group.score,
    groupSize: joinResult.members ?? group.current_members + 1,
    wasSeedGroup: group.is_seed_group,
  };
}

async function enqueueUser(
  userProfile: MatchingProfile,
  userId: string
): Promise<{ queueId: string } | null> {
  const { data, error } = await supabase.rpc('enqueue_for_matching', {
    p_user_id: userId,
    p_matching_profile: profileToJson(userProfile),
    p_life_stage: userProfile.life_stage,
  });

  if (error) return null;

  const payload = data as { ok?: boolean; queue_id?: string };
  if (!payload?.ok || !payload.queue_id) return null;

  supabase.functions.invoke('process-matching-queue').catch(() => {});

  return { queueId: payload.queue_id };
}

function partialGroups(scored: ScoredGroup[]): ScoredGroup[] {
  return scored.filter(
    (g) => g.current_members >= 2 && g.current_members <= GROUP_MAX_MEMBERS - 1
  );
}

function allPartialIncompatible(scored: ScoredGroup[]): boolean {
  const partials = partialGroups(scored);
  if (partials.length === 0) return true;
  return partials.every((g) => g.score < INCOMPATIBLE_SCORE);
}

async function resolveAssignment(
  userProfile: MatchingProfile,
  userId: string,
  config: MatchingConfig
): Promise<AssignmentResult | null> {
  const scoredGroups = await scoreAvailableGroups(userProfile, userId);

  if (config.mode === 'flexible') {
    const seedMatch = scoredGroups.find(
      (g) => g.is_seed_group && g.score >= SEED_GROUP_MIN_SCORE
    );
    if (seedMatch) {
      const joined = await tryJoinGroup(seedMatch);
      if (joined) {
        return {
          status: 'matched',
          groupId: joined.groupId,
          created: false,
          score: joined.score,
          groupSize: joined.groupSize,
          wasSeedGroup: joined.wasSeedGroup,
        };
      }
    }
  }

  const smallGroup = scoredGroups.find(
    (g) =>
      !g.is_seed_group &&
      g.current_members > 0 &&
      g.current_members < MIN_VIABLE_GROUP_SIZE &&
      g.score > LOOSE_JOIN_SCORE
  );
  if (smallGroup) {
    const joined = await tryJoinGroup(smallGroup);
    if (joined) {
      return {
        status: 'matched',
        groupId: joined.groupId,
        created: false,
        score: joined.score,
        groupSize: joined.groupSize,
        wasSeedGroup: joined.wasSeedGroup,
      };
    }
  }

  for (const group of scoredGroups) {
    if (group.score < config.threshold) break;
    const joined = await tryJoinGroup(group);
    if (joined) {
      return {
        status: 'matched',
        groupId: joined.groupId,
        created: false,
        score: joined.score,
        groupSize: joined.groupSize,
        wasSeedGroup: joined.wasSeedGroup,
      };
    }
  }

  if (config.mode === 'flexible' && !allPartialIncompatible(scoredGroups)) {
    const bestPartial = partialGroups(scoredGroups).sort((a, b) => b.score - a.score)[0];
    if (bestPartial && bestPartial.score >= INCOMPATIBLE_SCORE) {
      const joined = await tryJoinGroup(bestPartial);
      if (joined) {
        return {
          status: 'matched',
          groupId: joined.groupId,
          created: false,
          score: joined.score,
          groupSize: joined.groupSize,
          wasSeedGroup: joined.wasSeedGroup,
        };
      }
    }
  }

  const queued = await enqueueUser(userProfile, userId);
  if (queued) {
    return { status: 'waiting', queueId: queued.queueId };
  }

  return null;
}

export async function assignUserToBestGroup(
  userProfile: MatchingProfile,
  userId: string,
  matchingMode?: 'flexible' | 'moderate' | 'strict'
): Promise<AssignmentResult | null> {
  const totalProfiles = await getTotalProfileCount();
  const config = getMatchingConfig(totalProfiles);

  const analyticsMode =
    matchingMode === 'moderate' || config.mode === 'moderate'
      ? 'standard'
      : matchingMode === 'strict' || config.mode === 'strict'
        ? 'strict'
        : 'flexible';

  analyticsClient.track('matching_attempted', {
    pool_size: totalProfiles,
    mode: analyticsMode,
  });

  let result: AssignmentResult | null;

  if (matchingMode === 'flexible' && config.mode !== 'flexible') {
    result = await resolveAssignment(userProfile, userId, { ...config, threshold: 0.5, mode: 'flexible' });
  } else if (matchingMode === 'strict' && config.mode !== 'strict') {
    result = await resolveAssignment(userProfile, userId, { ...config, threshold: 0.7, mode: 'strict' });
  } else {
    result = await resolveAssignment(userProfile, userId, config);
  }

  if (result?.status === 'matched') {
    analyticsClient.track('matching_succeeded', {
      compatibility_score: result.score,
      group_size: result.groupSize,
      wait_time_seconds: 0,
      was_seed_group: result.wasSeedGroup,
    });
  } else if (result?.status === 'waiting') {
    analyticsClient.track('matching_queued', {
      life_stage: userProfile.life_stage ?? 'unknown',
      is_priority: false,
    });
  }

  return result;
}

export async function createGroupForUser(
  userProfile: MatchingProfile,
  userId: string,
  additionalUserIds: string[] = []
): Promise<{ id: string; name: string } | null> {
  if (additionalUserIds.length === 0) {
    console.warn(
      '[GroupAssignment] createGroupForUser called without co-founders. Use enqueueUser instead.'
    );
    analyticsClient.track('matching_attempted', {
      pool_size: 0,
      mode: 'flexible',
    });
    return null;
  }

  const identity = generateGroupIdentity(userProfile);

  const { data: newGroup, error } = await supabase
    .from('groups')
    .insert({
      name: identity.name,
      vibe_label: identity.vibe_label,
      group_type: identity.group_type,
      description: identity.description,
      identity_tags: identity.identity_tags,
      identity_generated_at: new Date().toISOString(),
      current_members: 0,
      max_members: GROUP_MAX_MEMBERS,
      is_private: false,
      is_seed_group: false,
      lifecycle_stage: 'active',
      created_by_user_id: userId,
    })
    .select('id, name')
    .single();

  if (error || !newGroup) return null;

  const memberRows = [userId, ...additionalUserIds].map((memberId) => ({
    group_id: newGroup.id,
    user_id: memberId,
    role: memberId === userId ? 'admin' : 'member',
  }));

  const { error: membersError } = await supabase
    .from('group_members')
    .insert(memberRows);

  if (membersError) {
    await supabase.from('groups').delete().eq('id', newGroup.id);
    return null;
  }

  return newGroup;
}
