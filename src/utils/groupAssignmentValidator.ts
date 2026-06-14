import type { MatchingProfile } from '@/types/matchingProfile';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class GroupAssignmentValidator {
  static validateUserProfile(profile: MatchingProfile): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!profile.username?.trim()) {
      errors.push('Username is required');
    }

    if (!profile.life_stage) {
      errors.push('Life stage is required');
    }

    if (!profile.primary_goals?.length) {
      errors.push('At least one primary goal is required');
    }

    if (profile.personality_traits.length < 3 || profile.personality_traits.length > 5) {
      errors.push('Select 3–5 personality traits');
    }

    if (!profile.activity_level) {
      errors.push('Activity level is required');
    }

    if (!profile.active_period) {
      errors.push('Schedule preference is required');
    }

    if (!profile.interests?.length) {
      warnings.push('No interests selected — matching will rely on life stage and goals');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateArrayData(data: unknown): string[] {
    if (!Array.isArray(data)) return [];
    return data
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }

  static sanitizeUserProfile(profile: MatchingProfile): MatchingProfile {
    return {
      username: profile.username?.trim() ?? '',
      life_stage: profile.life_stage ?? null,
      primary_goals: this.validateArrayData(profile.primary_goals),
      personality_traits: this.validateArrayData(profile.personality_traits),
      activity_level: profile.activity_level ?? null,
      active_period: profile.active_period ?? null,
      interests: this.validateArrayData(profile.interests),
      genres: this.validateArrayData(profile.genres),
      personality: this.validateArrayData(profile.personality),
      habits: this.validateArrayData(profile.habits),
    };
  }

  static calculateProfileCompleteness(profile: MatchingProfile): number {
    let score = 0;

    if (profile.username?.trim().length >= 3) score += 20;
    if (profile.life_stage) score += 20;
    if (profile.primary_goals?.length) score += 15;
    if (profile.personality_traits.length >= 3) score += 20;
    if (profile.activity_level) score += 10;
    if (profile.active_period) score += 10;
    if (profile.interests?.length) score += 5;

    return Math.min(100, score);
  }

  static isSuitableForStrictMatching(profile: MatchingProfile): boolean {
    return this.calculateProfileCompleteness(profile) >= 70;
  }
}

export const safeArrayFilter = <T>(
  sourceArray: T[] | null | undefined,
  targetArray: T[] | null | undefined,
  filterFn: (source: T, target: T) => boolean = (a, b) => a === b
): T[] => {
  const safeSource = Array.isArray(sourceArray) ? sourceArray : [];
  const safeTarget = Array.isArray(targetArray) ? targetArray : [];

  return safeSource.filter((sourceItem) =>
    safeTarget.some((targetItem) => filterFn(sourceItem, targetItem))
  );
};

export const calculatePreferenceOverlap = (
  userPreferences: string[] | null | undefined,
  profilePreferences: string[] | null | undefined
): number => {
  const userArray = Array.isArray(userPreferences) ? userPreferences : [];
  const profileArray = Array.isArray(profilePreferences) ? profilePreferences : [];

  return userArray.filter((pref) => profileArray.includes(pref)).length;
};
