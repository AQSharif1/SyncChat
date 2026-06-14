export const GROUP_MAX_MEMBERS = 8;
export const COMPATIBILITY_THRESHOLD = 0.7;

export const LIFE_STAGE_OPTIONS = [
  'College Student',
  'Recent Graduate',
  'Young Professional',
  'Entrepreneur',
  'Freelancer',
  'Remote Worker',
  'Creator',
  'Parent',
  'Retired',
  'Other',
] as const;

export const PRIMARY_GOAL_OPTIONS = [
  'Make New Friends',
  'Daily Conversations',
  'Networking',
  'Accountability Partners',
  'Travel Friends',
  'Learning Together',
  'Supportive Community',
  'Professional Connections',
] as const;

export const PERSONALITY_TRAIT_OPTIONS = [
  'Introverted',
  'Extroverted',
  'Funny',
  'Deep Thinker',
  'Ambitious',
  'Supportive',
  'Adventurous',
  'Creative',
  'Relaxed',
  'Curious',
] as const;

export const ACTIVITY_LEVEL_OPTIONS = [
  'Daily',
  'Several Times Per Week',
  'Casual',
] as const;

export const ACTIVE_PERIOD_OPTIONS = [
  'Morning',
  'Afternoon',
  'Evening',
  'Late Night',
] as const;

export const INTEREST_OPTIONS = [
  'Travel',
  'Fitness',
  'Gaming',
  'Technology',
  'Photography',
  'Reading',
  'Food',
  'Business',
  'Movies',
  'Music',
  'Sports',
  'Entrepreneurship',
  'Personal Development',
] as const;

export type LifeStage = (typeof LIFE_STAGE_OPTIONS)[number];
export type PrimaryGoal = (typeof PRIMARY_GOAL_OPTIONS)[number];
export type PersonalityTrait = (typeof PERSONALITY_TRAIT_OPTIONS)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVEL_OPTIONS)[number];
export type ActivePeriod = (typeof ACTIVE_PERIOD_OPTIONS)[number];
export type Interest = (typeof INTEREST_OPTIONS)[number];

export interface MatchingProfile {
  username: string;
  life_stage: string | null;
  primary_goals: string[];
  personality_traits: string[];
  activity_level: string | null;
  active_period: string | null;
  interests: string[];
  // Legacy fields kept for migration compatibility
  genres?: string[];
  personality?: string[];
  habits?: string[];
}

export const EMPTY_MATCHING_PROFILE: MatchingProfile = {
  username: '',
  life_stage: null,
  primary_goals: [],
  personality_traits: [],
  activity_level: null,
  active_period: null,
  interests: [],
  genres: [],
  personality: [],
  habits: [],
};

export function hasV2Profile(profile: Partial<MatchingProfile>): boolean {
  return !!(
    profile.life_stage &&
    profile.primary_goals &&
    profile.primary_goals.length > 0 &&
    profile.personality_traits &&
    profile.personality_traits.length >= 3 &&
    profile.activity_level &&
    profile.active_period
  );
}

export function hasLegacyProfile(profile: {
  username?: string | null;
  genres?: string[] | null;
  personality?: string[] | null;
  habits?: string[] | null;
}): boolean {
  return !!(
    profile.username &&
    ((profile.genres?.length ?? 0) > 0 ||
      (profile.personality?.length ?? 0) > 0 ||
      (profile.habits?.length ?? 0) > 0)
  );
}

export function hasCompleteProfile(profile: Partial<MatchingProfile> & {
  username?: string | null;
  genres?: string[] | null;
  personality?: string[] | null;
  habits?: string[] | null;
}): boolean {
  return hasV2Profile(profile) || hasLegacyProfile(profile);
}
