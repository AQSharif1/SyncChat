import type { MatchingProfile } from '@/types/matchingProfile';
import {
  FALLBACK_IDENTITY,
  type GroupIdentity,
  type GroupType,
} from '@/types/groupIdentity';
import { aggregateGroupProfile, type GroupAggregateProfile } from '@/utils/compatibilityScoring';

interface IdentitySignals {
  lifeStages: string[];
  goals: string[];
  traits: string[];
  interests: string[];
  activityLevel: string | null;
  activePeriod: string | null;
}

const IDENTITY_TEMPLATES: Record<
  GroupType,
  { names: string[]; vibe: string; description: string; tags: string[] }
> = {
  entrepreneurship: {
    names: ['Ambitious Builders', 'Startup Circle', 'Growth Founders'],
    vibe: 'Goal-driven conversations',
    description:
      'A community of ambitious people building careers, businesses, and meaningful connections.',
    tags: ['Entrepreneurship', 'Networking', 'Growth', 'Business'],
  },
  travel: {
    names: ['Weekend Explorers', 'Adventure Seekers', 'Wanderlust Crew'],
    vibe: 'Adventure-minded conversations',
    description:
      'A group for travelers, explorers, and people who enjoy discovering new experiences.',
    tags: ['Travel', 'Adventure', 'Friendship', 'Exploration'],
  },
  students: {
    names: ['College Connections', 'Campus Circle', 'Study Buddies'],
    vibe: 'Social and supportive',
    description:
      'A community where students can build friendships and share experiences.',
    tags: ['Students', 'Friendship', 'Campus Life', 'Social'],
  },
  creators: {
    names: ['Creative Circle', 'Makers Guild', 'Creative Minds'],
    vibe: 'Inspired and expressive',
    description:
      'A space for creators, artists, and makers to share ideas and support each other.',
    tags: ['Creativity', 'Art', 'Projects', 'Expression'],
  },
  fitness: {
    names: ['Fit Squad', 'Active Achievers', 'Wellness Warriors'],
    vibe: 'Motivated and energetic',
    description:
      'A group of active people supporting each other toward health and fitness goals.',
    tags: ['Fitness', 'Wellness', 'Accountability', 'Health'],
  },
  night_owls: {
    names: ['Night Owls', 'Late Night Crew', 'Moonlight Chat'],
    vibe: 'Late-night deep talks',
    description:
      'A community of night owls who connect when the day winds down.',
    tags: ['Late Night', 'Deep Talks', 'Night Owls', 'Social'],
  },
  networking: {
    names: ['Professional Network', 'Connection Hub', 'Career Circle'],
    vibe: 'Professional and purposeful',
    description:
      'A group focused on building professional relationships and career connections.',
    tags: ['Networking', 'Career', 'Professional', 'Growth'],
  },
  personal_growth: {
    names: ['Growth Seekers', 'Better Together', 'Mindful Momentum'],
    vibe: 'Reflective and uplifting',
    description:
      'A community dedicated to learning, self-improvement, and personal development.',
    tags: ['Growth', 'Learning', 'Self-Improvement', 'Mindfulness'],
  },
  professionals: {
    names: ['Young Professionals', 'Career Connect', 'Work Life Circle'],
    vibe: 'Balanced and ambitious',
    description:
      'A group of working professionals navigating careers, life, and meaningful connections.',
    tags: ['Professional', 'Career', 'Work-Life', 'Community'],
  },
  friendship: {
    names: ['New Friends Circle', 'Good Vibes Crew', 'Social Circle'],
    vibe: 'Warm and welcoming',
    description:
      'A friendly group focused on building genuine friendships and daily connection.',
    tags: ['Friendship', 'Social', 'Community', 'Connection'],
  },
  general: {
    names: ['New Connections'],
    vibe: 'Friendly conversations',
    description:
      'A group focused on meeting new people and building genuine connections.',
    tags: ['Friendship', 'Community', 'Connection'],
  },
};

function normalize(values: string[]): string[] {
  return values.map((v) => v.toLowerCase());
}

function includesAny(haystack: string[], needles: string[]): boolean {
  return needles.some((n) => haystack.some((h) => h.includes(n)));
}

function signalsFromProfile(profile: MatchingProfile): IdentitySignals {
  return {
    lifeStages: profile.life_stage ? [profile.life_stage] : [],
    goals: profile.primary_goals ?? [],
    traits: profile.personality_traits ?? [],
    interests: profile.interests ?? [],
    activityLevel: profile.activity_level,
    activePeriod: profile.active_period,
  };
}

function signalsFromAggregate(aggregate: GroupAggregateProfile): IdentitySignals {
  return {
    lifeStages: aggregate.life_stage ? [aggregate.life_stage] : [],
    goals: aggregate.primary_goals,
    traits: aggregate.personality_traits,
    interests: aggregate.interests,
    activityLevel: aggregate.activity_level,
    activePeriod: aggregate.active_period,
  };
}

function scoreGroupTypes(signals: IdentitySignals): Record<GroupType, number> {
  const stages = normalize(signals.lifeStages);
  const goals = normalize(signals.goals);
  const traits = normalize(signals.traits);
  const interests = normalize(signals.interests);
  const period = signals.activePeriod?.toLowerCase() ?? '';

  const scores: Record<GroupType, number> = {
    entrepreneurship: 0,
    networking: 0,
    friendship: 0,
    travel: 0,
    students: 0,
    creators: 0,
    fitness: 0,
    personal_growth: 0,
    professionals: 0,
    night_owls: 0,
    general: 0,
  };

  if (includesAny(stages, ['entrepreneur'])) scores.entrepreneurship += 4;
  if (includesAny(goals, ['networking', 'business'])) scores.entrepreneurship += 3;
  if (includesAny(interests, ['entrepreneurship', 'business', 'technology'])) {
    scores.entrepreneurship += 2;
  }
  if (includesAny(traits, ['ambitious', 'driven', 'leader'])) scores.entrepreneurship += 1;

  if (includesAny(stages, ['college student', 'recent graduate'])) scores.students += 4;
  if (includesAny(goals, ['make new friends']) && scores.students > 0) scores.students += 2;

  if (includesAny(interests, ['travel', 'adventure', 'exploration'])) scores.travel += 4;
  if (includesAny(goals, ['travel', 'adventure'])) scores.travel += 2;

  if (includesAny(stages, ['creator'])) scores.creators += 4;
  if (includesAny(interests, ['art', 'design', 'music', 'writing', 'photography'])) {
    scores.creators += 3;
  }
  if (includesAny(traits, ['creative', 'artistic'])) scores.creators += 2;

  if (includesAny(interests, ['fitness', 'sports', 'wellness'])) scores.fitness += 4;
  if (includesAny(goals, ['accountability', 'fitness'])) scores.fitness += 3;

  if (period.includes('late night')) scores.night_owls += 5;

  if (includesAny(goals, ['networking'])) scores.networking += 4;
  if (includesAny(goals, ['career'])) scores.networking += 2;

  if (includesAny(goals, ['learn', 'self-improvement', 'personal growth', 'growth'])) {
    scores.personal_growth += 4;
  }
  if (includesAny(interests, ['books', 'learning', 'mindfulness'])) {
    scores.personal_growth += 2;
  }

  if (
    includesAny(stages, [
      'young professional',
      'remote worker',
      'freelancer',
      'professional',
    ])
  ) {
    scores.professionals += 4;
  }

  if (includesAny(goals, ['make new friends', 'daily conversations', 'friendship'])) {
    scores.friendship += 3;
  }
  if (includesAny(traits, ['friendly', 'social', 'outgoing', 'extroverted'])) {
    scores.friendship += 1;
  }

  return scores;
}

function pickGroupType(scores: Record<GroupType, number>): GroupType {
  let best: GroupType = 'general';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores) as [GroupType, number][]) {
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : 'general';
}

function pickName(type: GroupType, signals: IdentitySignals): string {
  const template = IDENTITY_TEMPLATES[type];
  const hash =
    signals.goals.join('').length +
    signals.interests.join('').length +
    signals.traits.join('').length;
  const index = hash % template.names.length;
  return template.names[index];
}

function buildTags(type: GroupType, signals: IdentitySignals): string[] {
  const base = [...IDENTITY_TEMPLATES[type].tags];
  const extras = [...signals.goals, ...signals.interests]
    .filter(Boolean)
    .slice(0, 2)
    .map((t) => t.replace(/\b\w/g, (c) => c.toUpperCase()));

  const merged = [...new Set([...base, ...extras])];
  return merged.slice(0, 5);
}

function buildIdentity(signals: IdentitySignals): GroupIdentity {
  const scores = scoreGroupTypes(signals);
  const group_type = pickGroupType(scores);
  const template = IDENTITY_TEMPLATES[group_type];

  return {
    name: pickName(group_type, signals),
    group_type,
    vibe_label: template.vibe,
    description: template.description,
    identity_tags: buildTags(group_type, signals),
  };
}

export function generateGroupIdentity(profile: MatchingProfile): GroupIdentity {
  const signals = signalsFromProfile(profile);
  const hasSignals =
    signals.lifeStages.length > 0 ||
    signals.goals.length > 0 ||
    signals.traits.length > 0 ||
    signals.interests.length > 0;

  if (!hasSignals) return { ...FALLBACK_IDENTITY };
  return buildIdentity(signals);
}

export function generateGroupIdentityFromMembers(
  members: MatchingProfile[]
): GroupIdentity {
  if (members.length === 0) return { ...FALLBACK_IDENTITY };

  const aggregate = aggregateGroupProfile(members);
  const signals: IdentitySignals = {
    lifeStages: members.map((m) => m.life_stage).filter(Boolean) as string[],
    goals: aggregate.primary_goals,
    traits: aggregate.personality_traits,
    interests: aggregate.interests,
    activityLevel: aggregate.activity_level,
    activePeriod: aggregate.active_period,
  };

  const hasSignals =
    signals.lifeStages.length > 0 ||
    signals.goals.length > 0 ||
    signals.traits.length > 0 ||
    signals.interests.length > 0;

  if (!hasSignals) return { ...FALLBACK_IDENTITY };
  return buildIdentity(signals);
}

export function generateGroupIdentityFromAggregate(
  aggregate: GroupAggregateProfile
): GroupIdentity {
  const signals = signalsFromAggregate(aggregate);
  const hasSignals =
    signals.lifeStages.length > 0 ||
    signals.goals.length > 0 ||
    signals.traits.length > 0 ||
    signals.interests.length > 0;

  if (!hasSignals) return { ...FALLBACK_IDENTITY };
  return buildIdentity(signals);
}

const GENERIC_NAME_PATTERNS = [
  /^Group[\s-]?\d+$/i,
  /^Group-\d{10,}$/i,
  /^Group-\d+$/,
  /^[A-Za-z]+(?:-[A-Za-z]+)+-\d{13,}$/,
];

export function isGenericGroupName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** SQL backfill identity — still eligible for profile-based regeneration. */
export function isSqlFallbackIdentity(group: {
  name: string;
  group_type?: string | null;
}): boolean {
  return (
    group.group_type === 'general' &&
    group.name.trim() === FALLBACK_IDENTITY.name
  );
}

export function needsIdentityMigration(group: {
  name: string;
  group_type?: string | null;
  description?: string | null;
  identity_tags?: string[] | null;
  identity_generated_at?: string | null;
}): boolean {
  if (!group.identity_generated_at) return true;
  if (isGenericGroupName(group.name)) return true;
  if (isSqlFallbackIdentity(group)) return true;
  if (!group.group_type || group.group_type === 'general') {
    if (isGenericGroupName(group.name)) return true;
  }
  if (!group.description) return true;
  if (!group.identity_tags?.length) return true;
  return false;
}
