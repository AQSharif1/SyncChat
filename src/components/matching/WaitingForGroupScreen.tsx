import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { SectionCard } from '@/components/design-system/SectionCard';
import { Sparkles, Users, Target, Clock, Crown } from 'lucide-react';
import type { MatchingQueueStatus } from '@/hooks/useMatchingQueue';
import type { MatchingProfile } from '@/types/matchingProfile';

interface WaitingForGroupScreenProps {
  status: MatchingQueueStatus;
  profile?: MatchingProfile | null;
  onNotifyChange: (enabled: boolean) => Promise<boolean>;
}

function getWaitMessage(waitingSameStage: number, waitingTotal: number): string {
  if (waitingSameStage >= 2) {
    return "A few people are close — shouldn't be long.";
  }
  if (waitingTotal >= 1) {
    return 'Usually under 24 hours as more members join.';
  }
  return 'Usually under 24 hours — we match in small curated groups.';
}

export function WaitingForGroupScreen({
  status,
  profile,
  onNotifyChange,
}: WaitingForGroupScreenProps) {
  const [notifyEnabled, setNotifyEnabled] = useState(status.notifyWhenReady);
  const [savingNotify, setSavingNotify] = useState(false);

  const displayProfile = profile ?? status.matchingProfile;
  const interests = displayProfile?.interests ?? [];
  const goals = displayProfile?.primary_goals ?? [];
  const lifeStage = displayProfile?.life_stage ?? status.lifeStage;

  const handleNotifyToggle = async (checked: boolean) => {
    setSavingNotify(true);
    const ok = await onNotifyChange(checked);
    if (ok) setNotifyEnabled(checked);
    setSavingNotify(false);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-background px-4 py-8 pb-24">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            We&apos;re finding your people
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            You&apos;re in the queue for a curated group that fits your vibe. Good matches take a moment — yours is on the way.
          </p>
          {status.isPriority && (
            <Badge className="gap-1">
              <Crown className="w-3 h-3" />
              Priority Match
            </Badge>
          )}
        </div>

        <SectionCard padding="md" className="space-y-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {status.waitingSameStage > 0
                  ? `${status.waitingSameStage} other${status.waitingSameStage === 1 ? '' : 's'} nearby in your stage`
                  : 'You&apos;re first in your stage — others are joining soon'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status.waitingTotal > 0
                  ? `${status.waitingTotal} people waiting across SyncChat`
                  : 'Building your compatible group'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {getWaitMessage(status.waitingSameStage, status.waitingTotal)}
            </p>
          </div>
        </SectionCard>

        {(lifeStage || interests.length > 0 || goals.length > 0) && (
          <SectionCard padding="md" className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium">Your future group preview</p>
            </div>
            {lifeStage && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Life stage</p>
                <Badge variant="secondary">{lifeStage}</Badge>
              </div>
            )}
            {goals.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Goals</p>
                <div className="flex flex-wrap gap-1.5">
                  {goals.slice(0, 4).map((goal) => (
                    <Badge key={goal} variant="outline" className="text-xs font-normal">
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {interests.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {interests.slice(0, 6).map((interest) => (
                    <Badge key={interest} variant="outline" className="text-xs font-normal">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        )}

        <SectionCard padding="md" className="flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium">Notify me when my group is ready</p>
            <p className="text-xs text-muted-foreground">
              Get a push or email the moment you&apos;re matched
            </p>
          </div>
          <Switch
            checked={notifyEnabled}
            onCheckedChange={handleNotifyToggle}
            disabled={savingNotify}
            aria-label="Notify when group is ready"
          />
        </SectionCard>

        <p className="text-center text-xs text-muted-foreground px-4">
          Stay close — we&apos;ll bring you into chat as soon as your group forms. No action needed.
        </p>
      </div>
    </div>
  );
}
