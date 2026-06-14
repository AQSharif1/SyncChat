import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { analyticsClient, type AnalyticsEvent } from '@/utils/analytics';

export type OnboardingAnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_step_viewed'
  | 'onboarding_step_completed'
  | 'onboarding_preview_viewed'
  | 'onboarding_submitted'
  | 'onboarding_completed'
  | 'match_welcome_viewed'
  | 'match_explanation_viewed'
  | 'community_intro_viewed'
  | 'match_accepted'
  | 'first_chat_entered'
  | 'first_message_sent';

interface TrackOptions {
  step?: string;
  metadata?: Record<string, unknown>;
}

export function useOnboardingAnalytics() {
  const { user } = useAuth();

  const track = useCallback(
    async (event: OnboardingAnalyticsEvent, options: TrackOptions = {}) => {
      const payload = {
        event,
        step: options.step ?? null,
        metadata: options.metadata ?? {},
        timestamp: new Date().toISOString(),
        userId: user?.id ?? null,
      };

      try {
        const buffer = JSON.parse(localStorage.getItem('onboarding_analytics') ?? '[]');
        buffer.push(payload);
        localStorage.setItem('onboarding_analytics', JSON.stringify(buffer.slice(-100)));
      } catch {
        // Non-critical
      }

      const mapped = event as AnalyticsEvent;
      if (
        [
          'onboarding_started',
          'onboarding_step_completed',
        ].includes(mapped)
      ) {
        analyticsClient.track(mapped, {
          step: options.step,
          ...(options.metadata ?? {}),
        });
      }

      if (!user?.id) return;

      try {
        await supabase.from('onboarding_events').insert({
          user_id: user.id,
          event_name: event,
          step_name: options.step ?? null,
          metadata: options.metadata ?? {},
        });
      } catch {
        // Table may not exist in all environments — fail silently
      }
    },
    [user?.id]
  );

  return { track };
}
