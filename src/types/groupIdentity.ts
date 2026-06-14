export type GroupType =
  | 'entrepreneurship'
  | 'networking'
  | 'friendship'
  | 'travel'
  | 'students'
  | 'creators'
  | 'fitness'
  | 'personal_growth'
  | 'professionals'
  | 'night_owls'
  | 'general';

export interface GroupIdentity {
  name: string;
  group_type: GroupType;
  vibe_label: string;
  description: string;
  identity_tags: string[];
}

export interface GroupIdentityFields extends GroupIdentity {
  identity_generated_at?: string;
}

export const FALLBACK_IDENTITY: GroupIdentity = {
  name: 'New Connections',
  group_type: 'general',
  vibe_label: 'Friendly conversations',
  description:
    'A group focused on meeting new people and building genuine connections.',
  identity_tags: ['Friendship', 'Community', 'Connection'],
};

export const GROUP_MAX_MEMBERS_DISPLAY = 8;
