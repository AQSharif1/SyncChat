export type MatchingMode = 'flexible' | 'moderate' | 'strict';

export interface MatchingConfig {
  threshold: number;
  mode: MatchingMode;
  totalProfiles: number;
}

export const LOOSE_JOIN_SCORE = 0.4;
export const MIN_VIABLE_GROUP_SIZE = 4;
export const SEED_GROUP_MIN_SCORE = 0.3;
export const INCOMPATIBLE_SCORE = 0.4;
export const MIN_BATCH_GROUP_SIZE = 2;
export const TARGET_GROUP_SIZE_MIN = 4;
export const TARGET_GROUP_SIZE_MAX = 6;

export function getMatchingConfig(totalProfiles: number): MatchingConfig {
  if (totalProfiles < 100) {
    return { threshold: 0.5, mode: 'flexible', totalProfiles };
  }
  if (totalProfiles <= 500) {
    return { threshold: 0.6, mode: 'moderate', totalProfiles };
  }
  return { threshold: 0.7, mode: 'strict', totalProfiles };
}

export function getMatchingModeLabel(mode: MatchingMode): string {
  switch (mode) {
    case 'flexible':
      return 'flexible mode';
    case 'moderate':
      return 'balanced mode';
    case 'strict':
      return 'strict mode';
  }
}
