import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Users, RotateCcw, Archive, Clock } from 'lucide-react';
import { useGroupLifecycle, type SeasonContinuationChoice } from '@/hooks/useGroupLifecycle';
import { useToast } from '@/hooks/use-toast';
import { analyticsClient } from '@/utils/analytics';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export type SeasonVoteOption = 'stay_together' | 'fresh_start' | 'keep_memories';

interface SeasonSummary {
  message_count: number;
  games_played: number;
  days_together: number;
  member_count: number;
}

interface SeasonVoteScreenProps {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VOTE_OPTIONS: Array<{
  id: SeasonVoteOption;
  icon: typeof Users;
  headline: string;
  sub: string;
}> = [
  {
    id: 'stay_together',
    icon: Users,
    headline: 'Stay together',
    sub: 'Keep going into another season with the same group',
  },
  {
    id: 'fresh_start',
    icon: RotateCcw,
    headline: 'Fresh start',
    sub: 'Get rematched into a new group while keeping your memories here',
  },
  {
    id: 'keep_memories',
    icon: Archive,
    headline: 'Keep the memories',
    sub: "Archive this season and move on when you're ready",
  },
];

const OPTION_TO_CHOICE: Record<SeasonVoteOption, SeasonContinuationChoice> = {
  stay_together: 'stay',
  fresh_start: 'refresh',
  keep_memories: 'memories_only',
};

const sessionKey = (groupId: string) => `season_vote_shown_${groupId}`;

const formatTimeRemaining = (deadline: Date): string => {
  const diff = deadline.getTime() - Date.now();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
};

export const SeasonVoteScreen = ({
  groupId,
  groupName,
  open,
  onOpenChange,
}: SeasonVoteScreenProps) => {
  const { lifecycleData, loading, submitChoice } = useGroupLifecycle(groupId);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [selectedOption, setSelectedOption] = useState<SeasonVoteOption | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [seasonSummary, setSeasonSummary] = useState<SeasonSummary | null>(null);
  const [trackedShown, setTrackedShown] = useState(false);

  const fetchSeasonSummary = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_season_summary', {
      p_group_id: groupId,
      p_season_number: lifecycleData?.seasonNumber ?? 1,
    });
    if (!error && data && typeof data === 'object' && data !== null) {
      const summary = data as Record<string, unknown>;
      setSeasonSummary({
        message_count: Number(summary.message_count) || 0,
        games_played: Number(summary.games_played) || 0,
        days_together: Number(summary.days_together) || 0,
        member_count: Number(summary.member_count) || 0,
      });
    }
  }, [groupId, lifecycleData?.seasonNumber]);

  useEffect(() => {
    if (open) {
      sessionStorage.setItem(sessionKey(groupId), 'true');
      fetchSeasonSummary();
    }
  }, [open, groupId, fetchSeasonSummary]);

  useEffect(() => {
    if (
      open &&
      !trackedShown &&
      lifecycleData?.continuationActive &&
      lifecycleData.choiceDeadline
    ) {
      analyticsClient.track(
        'season_vote_screen_shown',
        {
          group_id: groupId,
          season_number: lifecycleData.seasonNumber ?? 0,
          days_remaining: lifecycleData.daysRemaining,
          members_voted_count: lifecycleData.choiceCounts?.total ?? 0,
        },
        groupId
      );
      setTrackedShown(true);
    }
  }, [open, trackedShown, lifecycleData, groupId]);

  const handleSelectOption = (option: SeasonVoteOption) => {
    setSelectedOption(option);
    analyticsClient.track(
      'season_vote_option_selected',
      { group_id: groupId, choice: option },
      groupId
    );
  };

  const handleSubmit = async () => {
    if (!selectedOption || !lifecycleData) return;

    setSubmitting(true);
    const choice = OPTION_TO_CHOICE[selectedOption];
    const success = await submitChoice(choice);
    setSubmitting(false);
    setConfirmOpen(false);

    if (success) {
      analyticsClient.track(
        'season_vote_submitted',
        {
          group_id: groupId,
          choice: selectedOption,
          season_number: lifecycleData.seasonNumber ?? 0,
        },
        groupId
      );
      onOpenChange(false);
      toast({
        title: 'Your vote is in',
        description:
          "We'll share the outcome when everyone has decided.",
      });
    } else {
      toast({
        title: "Couldn't submit vote",
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDecideLater = () => {
    onOpenChange(false);
  };

  if (loading || !lifecycleData) return null;

  const { choiceDeadline, choiceCounts, seasonNumber } = lifecycleData;
  const memberCount = choiceCounts?.members ?? seasonSummary?.member_count ?? 0;
  const hoursUntilDeadline = choiceDeadline
    ? (choiceDeadline.getTime() - Date.now()) / (1000 * 60 * 60)
    : 0;
  const showDecideLater = hoursUntilDeadline > 12;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'flex flex-col gap-0 p-0 overflow-hidden',
            isMobile
              ? 'fixed inset-0 left-0 top-0 z-50 h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0'
              : 'max-w-lg max-h-[90vh]'
          )}
        >
          <div className="flex-1 overflow-y-auto p-6 safe-area-inset-bottom space-y-6">
            <DialogHeader className="space-y-3 text-center sm:text-center">
              <DialogTitle className="text-xl font-semibold">
                Season {seasonNumber ?? 1} is wrapping up
              </DialogTitle>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {seasonSummary?.message_count ?? 0} messages
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {seasonSummary?.games_played ?? 0} games
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                  {seasonSummary?.days_together ?? 0} days together
                </span>
              </div>
              <DialogDescription className="text-sm">
                Here&apos;s what you built this season.
              </DialogDescription>
            </DialogHeader>

            <h2 className="text-center text-2xl font-bold tracking-tight px-2">
              What happens next with {groupName}?
            </h2>

            <div className="space-y-3">
              {VOTE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedOption === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelectOption(option.id)}
                    className={cn(
                      'w-full rounded-xl border-2 p-4 text-left transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={cn(
                          'h-5 w-5 mt-0.5 shrink-0',
                          isSelected ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                      <div>
                        <p className="font-semibold">{option.headline}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {option.sub}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {choiceDeadline && (
              <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>
                    Voting closes in {formatTimeRemaining(choiceDeadline)}
                  </span>
                </div>
                <span>
                  {choiceCounts?.total ?? 0} of {memberCount} members voted
                </span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Button
                className="w-full"
                disabled={!selectedOption || submitting}
                onClick={() => setConfirmOpen(true)}
              >
                Submit my vote
              </Button>

              {showDecideLater ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={handleDecideLater}
                >
                  I&apos;ll decide later
                </Button>
              ) : (
                <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                  Voting closes soon — please vote now.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Your vote can&apos;t be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const shouldAutoOpenSeasonVote = (groupId: string): boolean => {
  return sessionStorage.getItem(sessionKey(groupId)) !== 'true';
};
