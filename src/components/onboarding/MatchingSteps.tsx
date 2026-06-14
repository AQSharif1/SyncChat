import {
  Target,
  Users,
  Brain,
  Zap,
  Clock,
  Sparkles,
} from 'lucide-react';
import { SelectionStep } from './SelectionStep';
import {
  LIFE_STAGE_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  PERSONALITY_TRAIT_OPTIONS,
  ACTIVITY_LEVEL_OPTIONS,
  ACTIVE_PERIOD_OPTIONS,
  INTEREST_OPTIONS,
  type MatchingProfile,
} from '@/types/matchingProfile';

interface MatchingStepsProps {
  profile: MatchingProfile;
  updateProfile: (updates: Partial<MatchingProfile>) => void;
}

export const LifeStageStep = ({ profile, updateProfile }: MatchingStepsProps) => (
  <SelectionStep
    title="Life Stage"
    description="Where are you in life right now? We'll match you with people in a similar stage."
    icon={<Users className="w-4 h-4 text-primary" />}
    options={LIFE_STAGE_OPTIONS}
    mode="single"
    values={profile.life_stage ?? ''}
    onChange={(value) => updateProfile({ life_stage: value as string })}
  />
);

export const PrimaryGoalsStep = ({ profile, updateProfile }: MatchingStepsProps) => (
  <SelectionStep
    title="Primary Goals"
    description="What are you hoping to get from your group? Pick up to 2."
    icon={<Target className="w-4 h-4 text-primary" />}
    options={PRIMARY_GOAL_OPTIONS}
    mode="multi"
    values={profile.primary_goals}
    onChange={(values) => updateProfile({ primary_goals: values as string[] })}
    min={1}
    max={2}
  />
);

export const PersonalityStep = ({ profile, updateProfile }: MatchingStepsProps) => (
  <SelectionStep
    title="Personality"
    description="How would you describe yourself? Choose 3–5 traits that feel most like you."
    icon={<Brain className="w-4 h-4 text-accent" />}
    options={PERSONALITY_TRAIT_OPTIONS}
    mode="multi"
    values={profile.personality_traits}
    onChange={(values) => updateProfile({ personality_traits: values as string[] })}
    min={3}
    max={5}
  />
);

export const ActivityLevelStep = ({ profile, updateProfile }: MatchingStepsProps) => (
  <SelectionStep
    title="Activity Level"
    description="How often do you want to engage with your group?"
    icon={<Zap className="w-4 h-4 text-primary-glow" />}
    options={ACTIVITY_LEVEL_OPTIONS}
    mode="single"
    values={profile.activity_level ?? ''}
    onChange={(value) => updateProfile({ activity_level: value as string })}
  />
);

export const ScheduleStep = ({ profile, updateProfile }: MatchingStepsProps) => (
  <SelectionStep
    title="Schedule Preference"
    description="When are you usually most active and available to chat?"
    icon={<Clock className="w-4 h-4 text-primary-glow" />}
    options={ACTIVE_PERIOD_OPTIONS}
    mode="single"
    values={profile.active_period ?? ''}
    onChange={(value) => updateProfile({ active_period: value as string })}
  />
);

export const InterestsStep = ({ profile, updateProfile }: MatchingStepsProps) => (
  <SelectionStep
    title="Interests"
    description="What do you enjoy? These help start conversations but won't define your match."
    icon={<Sparkles className="w-4 h-4 text-primary" />}
    options={INTEREST_OPTIONS}
    mode="multi"
    values={profile.interests}
    onChange={(values) => updateProfile({ interests: values as string[] })}
    max={10}
  />
);
