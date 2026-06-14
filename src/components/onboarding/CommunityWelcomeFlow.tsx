import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, CheckCircle2, MessageCircle } from 'lucide-react';
import { GroupIdentityDisplay } from '@/components/group/GroupIdentityDisplay';
import type { MatchExperienceData } from '@/utils/matchExplanation';
import { GROUP_MAX_MEMBERS_DISPLAY } from '@/types/groupIdentity';
import { useOnboardingAnalytics } from '@/hooks/useOnboardingAnalytics';
import { analyticsClient } from '@/utils/analytics';

export interface CommunityWelcomeGroup {
  id: string;
  name: string;
  vibe_label: string;
  description?: string | null;
  group_type?: string | null;
  identity_tags?: string[] | null;
  current_members: number;
  max_members?: number;
}

interface CommunityWelcomeFlowProps {
  group: CommunityWelcomeGroup;
  matchExperience: MatchExperienceData;
  onEnterChat: () => void;
}

type WelcomePhase = 'welcome' | 'match_insight' | 'ready';

const PHASES: WelcomePhase[] = ['welcome', 'match_insight', 'ready'];

export const CommunityWelcomeFlow = ({
  group,
  matchExperience,
  onEnterChat,
}: CommunityWelcomeFlowProps) => {
  const [phase, setPhase] = useState<WelcomePhase>('welcome');
  const { track } = useOnboardingAnalytics();
  const flowStartRef = useRef(Date.now());
  const phaseRef = useRef<WelcomePhase>(phase);
  phaseRef.current = phase;
  const phaseIndex = PHASES.indexOf(phase);

  const isReturningUser = (() => {
    try {
      const seen: string[] = JSON.parse(
        localStorage.getItem('syncchat_seen_groups') ?? '[]'
      );
      return seen.length > 0;
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    return () => {
      const current = phaseRef.current;
      if (current === 'welcome' || current === 'match_insight') {
        analyticsClient.track('onboarding_abandoned', {
          last_step: `welcome_flow_${current}`,
        });
      }
    };
  }, []);

  const advance = () => {
    const next = PHASES[phaseIndex + 1];
    if (!next) {
      track('match_accepted', {
        metadata: { groupId: group.id },
      });
      analyticsClient.track(
        'group_arrival_screen_completed',
        {
          group_id: group.id,
          time_spent_seconds: Math.floor(
            (Date.now() - flowStartRef.current) / 1000
          ),
        },
        group.id
      );
      try {
        const seen: string[] = JSON.parse(
          localStorage.getItem('syncchat_seen_groups') ?? '[]'
        );
        localStorage.setItem(
          'syncchat_seen_groups',
          JSON.stringify([...new Set([...seen, group.id])])
        );
      } catch {
        // ignore localStorage errors
      }
      onEnterChat();
      return;
    }
    if (next === 'match_insight') track('match_explanation_viewed');
    if (next === 'ready') {
      track('community_intro_viewed');
      track('first_chat_entered', { metadata: { groupId: group.id } });
    }
    setPhase(next);
  };

  const formatGroupType = (type?: string | null) => {
    if (!type) return 'Community';
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/60">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold">SyncChat</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {matchExperience.fitLabel}
          </Badge>
        </div>
        <div className="max-w-lg mx-auto px-4 pb-3 flex gap-1.5">
          {PHASES.map((p, i) => (
            <div
              key={p}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= phaseIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
        {isReturningUser && (
          <div className="max-w-lg mx-auto px-4 pb-2 flex justify-end">
            <button
              type="button"
              onClick={onEnterChat}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Skip introduction →
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
        {phase === 'welcome' && (
          <div className="flex-1 flex flex-col animate-fade-in">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight mb-1">
                Welcome to {group.name}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                SyncChat matched you intentionally — here&apos;s your new community.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5 flex-1">
              <GroupIdentityDisplay
                name={group.name}
                vibeLabel={group.vibe_label}
                description={group.description}
                memberCount={group.current_members}
                maxMembers={group.max_members ?? GROUP_MAX_MEMBERS_DISPLAY}
                identityTags={group.identity_tags}
              />
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Group Type
                </p>
                <p className="text-sm font-medium">{formatGroupType(group.group_type)}</p>
              </div>
            </div>
          </div>
        )}

        {phase === 'match_insight' && (
          <div className="flex-1 flex flex-col animate-fade-in space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight mb-1">
                Why we matched you
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                What aligned — no scores, no private data.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-[15px] leading-relaxed text-foreground">
                {matchExperience.explanation}
              </p>
            </div>

            {matchExperience.matchingFactors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {matchExperience.matchingFactors.map((factor) => (
                  <div
                    key={factor}
                    className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-full bg-primary/10 border border-primary/20 text-primary"
                  >
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                    {factor}
                  </div>
                ))}
              </div>
            )}

            {matchExperience.communityHighlights.length > 0 && (
              <div className="pt-3 border-t border-border/40 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Most members are
                </p>
                <div className="flex flex-wrap gap-2">
                  {matchExperience.communityHighlights.slice(0, 4).map((item) => (
                    <span
                      key={item}
                      className="text-sm py-1.5 px-3 rounded-full bg-muted/60 border border-border/40"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'ready' && (
          <div className="flex-1 flex flex-col animate-fade-in space-y-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight mb-1">You&apos;re ready</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Here&apos;s how to make a great first impression.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
              <h3 className="font-semibold">Try one of these:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="py-2.5 px-3.5 rounded-lg bg-muted/40 border border-border/40">
                  Introduce yourself to the group
                </li>
                <li className="py-2.5 px-3.5 rounded-lg bg-muted/40 border border-border/40">
                  Share what brought you here
                </li>
                <li className="py-2.5 px-3.5 rounded-lg bg-muted/40 border border-border/40">
                  Tell the group something interesting about yourself
                </li>
              </ul>
            </div>

            <p className="text-xs text-center text-muted-foreground leading-relaxed">
              Quick actions will appear in chat to help you get started. No pressure to perform.
            </p>
          </div>
        )}

        <div className="pt-6 mt-auto">
          <Button onClick={advance} className="w-full h-12 text-base gap-2" size="lg">
            {phase === 'ready' ? 'Enter Community Chat' : 'Continue'}
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
