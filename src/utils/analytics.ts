import { supabase } from '@/integrations/supabase/client';

export type AnalyticsEvent =
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_abandoned'
  | 'matching_attempted'
  | 'matching_succeeded'
  | 'matching_queued'
  | 'matching_queue_wait_exceeded'
  | 'matching_completed_from_queue'
  | 'group_opened'
  | 'message_sent'
  | 'reaction_added'
  | 'game_started'
  | 'game_completed'
  | 'poll_created'
  | 'voice_room_joined'
  | 'voice_room_left'
  | 'daily_prompt_viewed'
  | 'daily_prompt_responded'
  | 'group_silent_threshold_hit'
  | 'season_vote_shown'
  | 'season_vote_screen_shown'
  | 'season_vote_option_selected'
  | 'season_vote_submitted'
  | 'season_vote_cast'
  | 'season_ended'
  | 'dm_opened'
  | 'dm_limit_modal_shown'
  | 'dm_limit_upgraded'
  | 'premium_upgrade_started'
  | 'premium_upgrade_completed'
  | 'premium_upsell_dismissed'
  | 'app_opened'
  | 'app_backgrounded'
  | 'notification_received'
  | 'notification_tapped'
  | 'icebreaker_shown'
  | 'icebreaker_answered'
  | 'icebreaker_dismissed'
  | 'group_arrival_screen_shown'
  | 'group_arrival_screen_completed'
  | 'voice_nudge_shown'
  | 'voice_nudge_accepted'
  | 'voice_nudge_dismissed'
  | 're_entry_card_shown'
  | 're_entry_card_started'
  | 'group_nudge_sent';

const SESSION_STORAGE_KEY = 'syncchat_analytics_session_id';
const LAST_OPEN_KEY = 'syncchat_last_app_open';
const BUFFER_KEY = 'onboarding_analytics';
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0';

interface BufferedEvent {
  event: string;
  step?: string | null;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  userId?: string | null;
}

interface IdentifyTraits {
  [key: string]: unknown;
}

class AnalyticsClient {
  private userId: string | null = null;
  private traits: IdentifyTraits = {};
  private flushed = false;
  private sessionStart = Date.now();

  identify(userId: string, traits?: IdentifyTraits): void {
    this.userId = userId;
    if (traits) {
      this.traits = { ...this.traits, ...traits };
    }
    this.upsertSession().catch(() => {});
  }

  sessionId(): string {
    try {
      let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(SESSION_STORAGE_KEY, id);
      }
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }

  track(eventName: AnalyticsEvent, properties?: Record<string, unknown>, groupId?: string): void {
    if (!this.flushed) {
      this.flushed = true;
      this.flushBufferedEvents();
    }

    const payload = {
      ...properties,
      ...this.traits,
    };

    void this.sendEvent(eventName, payload, groupId);
  }

  trackAppOpened(): void {
    const now = Date.now();
    const lastOpen = localStorage.getItem(LAST_OPEN_KEY);
    const daysSinceLastOpen = lastOpen
      ? Math.floor((now - Number(lastOpen)) / (1000 * 60 * 60 * 24))
      : 0;

    localStorage.setItem(LAST_OPEN_KEY, String(now));
    this.track('app_opened', { days_since_last_open: daysSinceLastOpen });
    this.upsertSession().catch(() => {});
  }

  trackAppBackgrounded(): void {
    const sessionDurationSeconds = Math.floor((Date.now() - this.sessionStart) / 1000);
    this.track('app_backgrounded', { session_duration_seconds: sessionDurationSeconds });
    this.updateSessionLastSeen().catch(() => {});
  }

  private async upsertSession(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

    await supabase.rpc('upsert_analytics_session', {
      p_session_id: this.sessionId(),
      p_device_type: deviceType,
      p_app_version: APP_VERSION,
    });
  }

  private async updateSessionLastSeen(): Promise<void> {
    const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
    await supabase.rpc('upsert_analytics_session', {
      p_session_id: this.sessionId(),
      p_device_type: deviceType,
      p_app_version: APP_VERSION,
    });
  }

  private flushBufferedEvents(): void {
    try {
      const raw = localStorage.getItem(BUFFER_KEY);
      if (!raw) return;

      const buffer = JSON.parse(raw) as BufferedEvent[];
      for (const item of buffer) {
        const eventName = item.event as AnalyticsEvent;
        const props: Record<string, unknown> = {
          ...(item.metadata ?? {}),
        };
        if (item.step) props.step = item.step;
        if (item.timestamp) props.buffered_at = item.timestamp;
        void this.sendEvent(eventName, props);
      }
      localStorage.removeItem(BUFFER_KEY);
    } catch {
      // fail silently
    }
  }

  private async sendEvent(
    eventName: AnalyticsEvent,
    properties: Record<string, unknown>,
    groupId?: string
  ): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      await supabase.rpc('track_event', {
        p_event_name: eventName,
        p_properties: properties,
        p_group_id: groupId ?? null,
        p_session_id: this.sessionId(),
      });
    } catch {
      try {
        await supabase.functions.invoke('track-event', {
          body: {
            event_name: eventName,
            properties,
            group_id: groupId ?? null,
            session_id: this.sessionId(),
          },
        });
      } catch {
        // fail silently
      }
    }
  }
}

export const analyticsClient = new AnalyticsClient();
