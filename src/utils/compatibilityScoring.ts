import type { MatchingProfile } from '@/types/matchingProfile';

export interface GroupAggregateProfile {
  life_stage: string | null;
  primary_goals: string[];
  personality_traits: string[];
  activity_level: string | null;
  active_period: string | null;
  interests: string[];
  memberCount: number;
}

const WEIGHTS = {
  lifeStage: 0.4,
  primaryGoals: 0.25,
  personality: 0.2,
  activityLevel: 0.1,
  activePeriod: 0.05,
  interestsBonusMax: 0.1,
} as const;

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function exactMatchScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  return a === b ? 1 : 0;
}

function modeValue(values: (string | null)[]): string | null {
  const filtered = values.filter((v): v is string => !!v);
  if (filtered.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of filtered) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function topTraitsFromMembers(profiles: MatchingProfile[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const profile of profiles) {
    for (const trait of profile.personality_traits ?? []) {
      counts.set(trait, (counts.get(trait) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([trait]) => trait);
}

export function aggregateGroupProfile(members: MatchingProfile[]): GroupAggregateProfile {
  if (members.length === 0) {
    return {
      life_stage: null,
      primary_goals: [],
      personality_traits: [],
      activity_level: null,
      active_period: null,
      interests: [],
      memberCount: 0,
    };
  }

  const allGoals = [...new Set(members.flatMap((m) => m.primary_goals ?? []))];
  const allInterests = [...new Set(members.flatMap((m) => m.interests ?? []))];

  return {
    life_stage: modeValue(members.map((m) => m.life_stage)),
    primary_goals: allGoals,
    personality_traits: topTraitsFromMembers(members),
    activity_level: modeValue(members.map((m) => m.activity_level)),
    active_period: modeValue(members.map((m) => m.active_period)),
    interests: allInterests,
    memberCount: members.length,
  };
}

export function calculateCompatibilityScore(
  user: MatchingProfile,
  group: GroupAggregateProfile,
  reputationBoost = 0
): number {
  // Empty groups have no aggregate profile to match against — not a curated fit.
  if (group.memberCount === 0) return 0;

  const lifeStageScore = exactMatchScore(user.life_stage, group.life_stage);
  const goalsScore = jaccardSimilarity(user.primary_goals ?? [], group.primary_goals);
  const personalityScore = jaccardSimilarity(
    user.personality_traits ?? [],
    group.personality_traits
  );
  const activityScore = exactMatchScore(user.activity_level, group.activity_level);
  const scheduleScore = exactMatchScore(user.active_period, group.active_period);

  const weightedScore =
    lifeStageScore * WEIGHTS.lifeStage +
    goalsScore * WEIGHTS.primaryGoals +
    personalityScore * WEIGHTS.personality +
    activityScore * WEIGHTS.activityLevel +
    scheduleScore * WEIGHTS.activePeriod;

  const interestOverlap = jaccardSimilarity(user.interests ?? [], group.interests);
  const interestBonus = interestOverlap * WEIGHTS.interestsBonusMax;

  return Math.min(1, weightedScore + interestBonus + Math.min(0.05, reputationBoost));
}

export { generateGroupIdentity } from '@/utils/groupIdentity';
