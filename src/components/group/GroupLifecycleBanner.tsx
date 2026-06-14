import { Badge } from '@/components/ui/badge';
import { Clock, Calendar } from 'lucide-react';
import { useGroupLifecycle } from '@/hooks/useGroupLifecycle';

interface GroupLifecycleBannerProps {
  groupId: string;
  onOpenVoteScreen?: () => void;
}

export const GroupLifecycleBanner = ({
  groupId,
  onOpenVoteScreen,
}: GroupLifecycleBannerProps) => {
  const { lifecycleData, loading } = useGroupLifecycle(groupId);

  if (loading || !lifecycleData) {
    return null;
  }

  const {
    continuationActive,
    userChoice,
    choiceCounts,
    daysRemaining,
    isExtended,
    lifecycleStage,
    seasonNumber,
  } = lifecycleData;

  const memberCount = choiceCounts?.members ?? 0;

  if (continuationActive && !userChoice) {
    return (
      <button
        type="button"
        onClick={onOpenVoteScreen}
        className="mx-3 sm:mx-4 my-2 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 px-4 py-2.5 text-left text-sm text-amber-900 dark:text-amber-100 transition-colors hover:bg-amber-100/80 dark:hover:bg-amber-950/60"
      >
        Season vote is open · {choiceCounts?.total ?? 0} of {memberCount} voted
      </button>
    );
  }

  if (continuationActive && userChoice) {
    return (
      <div className="mx-3 sm:mx-4 my-2 rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground">
        You voted · waiting for others ({choiceCounts?.total ?? 0}/{memberCount})
      </div>
    );
  }

  if (isExtended) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-primary/10 rounded-lg mx-3 sm:mx-4 my-2">
        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          Season {seasonNumber ?? '—'} ✨
        </Badge>
        <span className="text-sm text-muted-foreground">
          Your community continues together
        </span>
        <div className="ml-auto flex items-center space-x-1 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{daysRemaining} days remaining</span>
        </div>
      </div>
    );
  }

  if (lifecycleStage === 'active' && daysRemaining > 0 && daysRemaining <= 7) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg mx-3 sm:mx-4 my-2">
        <Clock className="h-4 w-4 text-blue-600" />
        <span className="text-sm">
          Season {seasonNumber ?? ''} wraps up in {daysRemaining} day
          {daysRemaining !== 1 ? 's' : ''}
        </span>
      </div>
    );
  }

  return null;
};
