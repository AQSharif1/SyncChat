import type { MatchingProfile } from '@/types/matchingProfile';
import {
  aggregateGroupProfile,
  type GroupAggregateProfile,
} from '@/utils/compatibilityScoring';
import { generateGroupIdentity } from '@/utils/groupIdentity';

export interface MatchExperienceData {
  previewLines: string[];
  explanation: string;
  matchingFactors: string[];
  communityHighlights: string[];
  fitLabel: 'Strong Community Match' | 'Great Community Match';
  isNewCommunity: boolean;
}

function pluralLifeStage(stage: string): string {
  if (stage === 'Other') return 'Diverse Life Stages';
  if (stage.endsWith('s')) return stage;
  return stage;
}

function goalCommunityLabel(goal: string): string {
  const map: Record<string, string> = {
    'Make New Friends': 'Friendship-Focused Communities',
    'Daily Conversations': 'Daily Conversation Groups',
    Networking: 'Networking Circles',
    'Accountability Partners': 'Accountability Communities',
    'Travel Friends': 'Travel-Minded Groups',
    'Learning Together': 'Learning Communities',
    'Supportive Community': 'Supportive Communities',
    'Professional Connections': 'Professional Communities',
  };
  return map[goal] ?? `${goal} Communities`;
}

function activityPeriodLabel(period: string): string {
  return `${period} Active Members`;
}

function traitCommunityLabel(trait: string): string {
  const map: Record<string, string> = {
    Ambitious: 'Ambitious Builders',
    Supportive: 'Supportive Personalities',
    Creative: 'Creative Minds',
    Adventurous: 'Adventurous Spirits',
    'Deep Thinker': 'Thoughtful Conversations',
    Funny: 'Lighthearted Groups',
    Relaxed: 'Easygoing Communities',
    Curious: 'Curious Minds',
    Introverted: 'Thoughtful Introverts',
    Extroverted: 'Outgoing Communities',
  };
  return map[trait] ?? `${trait} Personalities`;
}

export function generateMatchPreview(profile: MatchingProfile): string[] {
  const lines: string[] = [];
  const identity = generateGroupIdentity(profile);

  lines.push(identity.name);

  if (profile.life_stage) {
    lines.push(pluralLifeStage(profile.life_stage));
  }

  for (const goal of profile.primary_goals.slice(0, 2)) {
    lines.push(goalCommunityLabel(goal));
  }

  for (const trait of profile.personality_traits.slice(0, 2)) {
    lines.push(traitCommunityLabel(trait));
  }

  if (profile.active_period) {
    lines.push(activityPeriodLabel(profile.active_period));
  }

  return [...new Set(lines)].slice(0, 5);
}

function sharedGoals(user: MatchingProfile, group: GroupAggregateProfile): string[] {
  const userGoals = new Set(user.primary_goals ?? []);
  return (group.primary_goals ?? []).filter((g) => userGoals.has(g));
}

function sharedTraits(user: MatchingProfile, group: GroupAggregateProfile): string[] {
  const userTraits = new Set(user.personality_traits ?? []);
  return (group.personality_traits ?? []).filter((t) => userTraits.has(t));
}

export function generateMatchingFactors(
  user: MatchingProfile,
  group: GroupAggregateProfile
): string[] {
  const factors: string[] = [];

  if (user.life_stage && group.life_stage === user.life_stage) {
    factors.push('Shared Life Stage');
  }

  const goals = sharedGoals(user, group);
  if (goals.some((g) => g.includes('Friend') || g.includes('Community'))) {
    factors.push('Friendship-Focused Goals');
  }
  if (goals.some((g) => g.includes('Network') || g.includes('Professional'))) {
    factors.push('Growth-Oriented Members');
  }
  if (goals.some((g) => g.includes('Learning') || g.includes('Accountability'))) {
    factors.push('Learning & Growth Goals');
  }
  if (goals.length > 0 && factors.length < 3) {
    factors.push('Aligned Primary Goals');
  }

  const traits = sharedTraits(user, group);
  if (traits.some((t) => t === 'Supportive' || t === 'Empathetic')) {
    factors.push('Supportive Personalities');
  } else if (traits.some((t) => t === 'Ambitious')) {
    factors.push('Ambitious Personalities');
  } else if (traits.length > 0) {
    factors.push('Compatible Personality Traits');
  }

  if (user.active_period && group.active_period === user.active_period) {
    factors.push(`${user.active_period} Activity Preference`);
  }

  if (user.activity_level && group.activity_level === user.activity_level) {
    factors.push(`${user.activity_level} Engagement Level`);
  }

  return [...new Set(factors)].slice(0, 5);
}

export function generateMatchExplanation(
  user: MatchingProfile,
  group: GroupAggregateProfile,
  isNewCommunity: boolean
): string {
  if (isNewCommunity || group.memberCount <= 1) {
    return 'We created this community around your life stage, goals, and personality so you can build genuine connections with people on a similar path.';
  }

  const factors = generateMatchingFactors(user, group);

  if (factors.includes('Shared Life Stage') && factors.includes('Friendship-Focused Goals')) {
    return 'You were matched here because many members share a similar life stage and are looking for genuine friendships and meaningful conversations.';
  }

  if (factors.includes('Growth-Oriented Members')) {
    return 'You were matched here because many members share similar goals around growth, meaningful conversations, and long-term connections.';
  }

  if (factors.includes('Compatible Personality Traits') || factors.includes('Supportive Personalities')) {
    return 'Your personality traits and activity preferences align closely with this community.';
  }

  if (factors.includes('Shared Life Stage')) {
    return 'This group contains members in a similar life stage who are looking for genuine connections.';
  }

  return 'You were matched here because your profile aligns with the shared goals, personality, and activity patterns of this community.';
}

export function generateCommunityHighlights(group: GroupAggregateProfile): string[] {
  const highlights: string[] = [];

  if (group.life_stage) {
    highlights.push(pluralLifeStage(group.life_stage));
  }

  const growthGoals = (group.primary_goals ?? []).filter(
    (g) =>
      g.includes('Friend') ||
      g.includes('Learning') ||
      g.includes('Growth') ||
      g.includes('Support') ||
      g.includes('Network')
  );
  if (growthGoals.length > 0) {
    highlights.push('Growth Focused');
  } else if (group.primary_goals.length > 0) {
    highlights.push(`${group.primary_goals[0]}-Focused`);
  }

  if (group.active_period) {
    highlights.push(`Active During ${group.active_period}s`);
  }

  if (group.personality_traits.some((t) => t === 'Supportive' || t === 'Ambitious')) {
    highlights.push('Building Long-Term Connections');
  } else if (group.personality_traits.length > 0) {
    highlights.push(`${group.personality_traits.slice(0, 2).join(' & ')} Members`);
  }

  return [...new Set(highlights)].slice(0, 4);
}

export function getCommunityFitLabel(
  score: number,
  isNewCommunity: boolean
): 'Strong Community Match' | 'Great Community Match' {
  if (isNewCommunity || score >= 0.85) return 'Strong Community Match';
  return 'Great Community Match';
}

export function buildMatchExperience(
  user: MatchingProfile,
  members: MatchingProfile[],
  score: number,
  isNewCommunity: boolean
): MatchExperienceData {
  const group = aggregateGroupProfile(members);

  return {
    previewLines: generateMatchPreview(user),
    explanation: generateMatchExplanation(user, group, isNewCommunity),
    matchingFactors: generateMatchingFactors(user, group),
    communityHighlights: generateCommunityHighlights(group),
    fitLabel: getCommunityFitLabel(score, isNewCommunity),
    isNewCommunity,
  };
}
