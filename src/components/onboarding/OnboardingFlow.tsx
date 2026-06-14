import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Moon, Sun, ChevronRight, ChevronLeft, MessageCircle, LogOut, Loader2 } from 'lucide-react';
import { UsernameStep } from './UsernameStep';
import { LegalConsentStep } from './LegalConsentStep';
import { MatchPreviewStep } from './MatchPreviewStep';
import {
  CommunityWelcomeFlow,
  type CommunityWelcomeGroup,
} from './CommunityWelcomeFlow';
import {
  LifeStageStep,
  PrimaryGoalsStep,
  PersonalityStep,
  ActivityLevelStep,
  ScheduleStep,
  InterestsStep,
} from './MatchingSteps';
import { WelcomingLanding } from '@/components/landing/WelcomingLanding';
import { useAuth } from '@/hooks/useAuth';
import {
  useOnboardingCompletion,
  type OnboardingCompleteResult,
} from '@/hooks/useOnboardingCompletion';
import { useOnboardingAnalytics } from '@/hooks/useOnboardingAnalytics';
import { analyticsClient } from '@/utils/analytics';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import type { MatchExperienceData } from '@/utils/matchExplanation';
import {
  EMPTY_MATCHING_PROFILE,
  type MatchingProfile,
} from '@/types/matchingProfile';

type OnboardingPhase = 'steps' | 'matching' | 'welcome';

interface OnboardingFlowProps {
  onComplete?: (result: OnboardingCompleteResult) => void;
}

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const { user, loading, signOut } = useAuth();
  const { completeOnboarding, isProcessing } = useOnboardingCompletion();
  const { track } = useOnboardingAnalytics();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [phase, setPhase] = useState<OnboardingPhase>('steps');
  const [currentStep, setCurrentStep] = useState(0);
  const [userProfile, setUserProfile] = useState<MatchingProfile>(EMPTY_MATCHING_PROFILE);
  const [legalConsentGiven, setLegalConsentGiven] = useState(false);
  const [welcomeGroup, setWelcomeGroup] = useState<CommunityWelcomeGroup | null>(null);
  const [matchExperience, setMatchExperience] = useState<MatchExperienceData | null>(null);
  const [completionResult, setCompletionResult] = useState<OnboardingCompleteResult | null>(null);
  const completedRef = useRef(false);
  const lastStepRef = useRef('Legal Requirements');

  useEffect(() => {
    if (user) {
      track('onboarding_started');
      analyticsClient.track('onboarding_started');
    }
  }, [user, track]);

  useEffect(() => {
    return () => {
      if (user && !completedRef.current && phase === 'steps') {
        analyticsClient.track('onboarding_abandoned', { last_step: lastStepRef.current });
      }
    };
  }, [user, phase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <WelcomingLanding />;
  }

  if (phase === 'matching') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-6" />
        <h2 className="text-xl font-semibold mb-2">Finding your community</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          SyncChat is matching you with people who share your life stage, goals, and personality.
        </p>
      </div>
    );
  }

  if (phase === 'welcome' && welcomeGroup && matchExperience) {
    return (
      <CommunityWelcomeFlow
        group={welcomeGroup}
        matchExperience={matchExperience}
        onEnterChat={() => {
          if (completionResult && welcomeGroup) {
            sessionStorage.setItem('syncchat_first_session', welcomeGroup.id);
            onComplete?.(completionResult);
          }
        }}
      />
    );
  }

  const handleNext = async () => {
    if (currentStep === 0 && !legalConsentGiven) {
      toast({
        title: 'Legal Consent Required',
        description: 'Please confirm your age and accept our terms to continue.',
        variant: 'destructive',
      });
      return;
    }

    const stepMeta = steps[currentStep];
    if (currentStep < steps.length - 1) {
      track('onboarding_step_completed', { step: stepMeta.title });
      analyticsClient.track('onboarding_step_completed', { step: stepMeta.title });
      lastStepRef.current = steps[currentStep + 1].title;
      setCurrentStep(currentStep + 1);
      track('onboarding_step_viewed', { step: steps[currentStep + 1].title });
      return;
    }

    setPhase('matching');
    track('onboarding_submitted');
    track('onboarding_preview_viewed');

    try {
      const result = await completeOnboarding(userProfile);

      if (result.success && result.waitingForGroup) {
        track('onboarding_queued');
        onComplete?.(result);
        return;
      }

      if (result.success && result.group && result.matchExperience) {
        completedRef.current = true;
        track('onboarding_completed', { metadata: { groupId: result.groupId } });
        track('match_welcome_viewed', { metadata: { groupId: result.groupId } });
        setCompletionResult(result);
        setWelcomeGroup(result.group);
        setMatchExperience(result.matchExperience);
        setPhase('welcome');
      } else {
        setPhase('steps');
        toast({
          title: 'Onboarding Failed',
          description: result.error || 'Failed to complete onboarding. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      setPhase('steps');
      toast({
        title: 'Onboarding Failed',
        description: 'Failed to complete onboarding. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateProfile = (updates: Partial<MatchingProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...updates }));
  };

  const steps = [
    {
      title: 'Legal Requirements',
      subtitle: 'Please confirm your age and review our policies',
      component: (
        <LegalConsentStep
          onConsentChange={setLegalConsentGiven}
          isConsentGiven={legalConsentGiven}
        />
      ),
      canProceed: legalConsentGiven,
    },
    {
      title: 'Life Stage',
      subtitle: 'Help us find people at a similar point in life',
      component: <LifeStageStep profile={userProfile} updateProfile={updateProfile} />,
      canProceed: !!userProfile.life_stage,
    },
    {
      title: 'Your Goals',
      subtitle: 'What do you want from your group?',
      component: <PrimaryGoalsStep profile={userProfile} updateProfile={updateProfile} />,
      canProceed: userProfile.primary_goals.length >= 1,
    },
    {
      title: 'Personality',
      subtitle: 'Pick traits that describe you best',
      component: <PersonalityStep profile={userProfile} updateProfile={updateProfile} />,
      canProceed:
        userProfile.personality_traits.length >= 3 &&
        userProfile.personality_traits.length <= 5,
    },
    {
      title: 'Activity Level',
      subtitle: 'How often do you want to connect?',
      component: <ActivityLevelStep profile={userProfile} updateProfile={updateProfile} />,
      canProceed: !!userProfile.activity_level,
    },
    {
      title: 'Schedule',
      subtitle: 'When are you usually available?',
      component: <ScheduleStep profile={userProfile} updateProfile={updateProfile} />,
      canProceed: !!userProfile.active_period,
    },
    {
      title: 'Interests',
      subtitle: 'Optional — great for conversation starters',
      component: <InterestsStep profile={userProfile} updateProfile={updateProfile} />,
      canProceed: true,
    },
    {
      title: 'Your identity',
      subtitle: "We'll assign you a fun username",
      component: <UsernameStep profile={userProfile} updateProfile={updateProfile} />,
      canProceed: userProfile.username.length > 0,
    },
    {
      title: 'Your match preview',
      subtitle: 'See the kind of community SyncChat will find for you',
      component: <MatchPreviewStep profile={userProfile} />,
      canProceed: true,
    },
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/60 safe-area-inset-top">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">SyncChat</span>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full h-9 w-9" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-xs text-muted-foreground">
              {Math.round(((currentStep + 1) / steps.length) * 100)}%
            </span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
        <div className="flex-1 animate-fade-in">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight mb-1">{currentStepData.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{currentStepData.subtitle}</p>
          </div>

          <div className="min-h-[280px]">{currentStepData.component}</div>
        </div>

        <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border/60 -mx-4 px-4 py-4 safe-area-inset-bottom mt-6">
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0 || isProcessing}
              className="gap-1.5 h-12"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={!currentStepData.canProceed || isProcessing}
              className="gap-1.5 h-12 px-6 flex-1 max-w-[200px]"
            >
              {isProcessing ? 'Matching...' : isLastStep ? 'Find My Community' : 'Continue'}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try { await signOut(); } catch { /* ignore */ }
              window.location.href = '/';
            }}
            className="w-full mt-2 text-xs text-muted-foreground h-8"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Exit onboarding
          </Button>
        </div>
      </div>
    </div>
  );
};
