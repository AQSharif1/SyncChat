import { supabase } from '@/integrations/supabase/client';
import type { MatchingProfile } from '@/types/matchingProfile';
import {
  generateGroupIdentityFromMembers,
  isGenericGroupName,
  needsIdentityMigration,
} from '@/utils/groupIdentity';

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

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'username, life_stage, primary_goals, personality_traits, activity_level, active_period, interests, genres, personality, habits'
    )
    .in('user_id', userIds);

  return (profiles ?? []).map(toMatchingProfile);
}

/**
 * Regenerates identity for a single group from member profiles when missing or generic.
 * Safe: does not remove members, reset lifecycle, or affect messages.
 */
export async function migrateGroupIdentityIfNeeded(groupId: string): Promise<boolean> {
  const { data: group, error } = await supabase
    .from('groups')
    .select(
      'id, name, group_type, description, identity_tags, identity_generated_at, vibe_label'
    )
    .eq('id', groupId)
    .single();

  if (error || !group) return false;
  if (!needsIdentityMigration(group)) return false;

  const memberProfiles = await fetchGroupMemberProfiles(groupId);
  const identity = generateGroupIdentityFromMembers(memberProfiles);

  const shouldRename = isGenericGroupName(group.name) || !group.name?.trim();

  const { data: updated, error: updateError } = await supabase.rpc(
    'update_group_identity',
    {
      p_group_id: groupId,
      ...(shouldRename ? { p_name: identity.name } : {}),
      p_group_type: identity.group_type,
      p_vibe_label: identity.vibe_label,
      p_description: identity.description,
      p_identity_tags: identity.identity_tags,
    }
  );

  return !updateError && !!updated;
}

/**
 * Migrates identity for the user's current group on app load.
 */
export async function migrateCurrentUserGroupIdentity(userId: string): Promise<void> {
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership?.group_id) return;
  await migrateGroupIdentityIfNeeded(membership.group_id);
}
