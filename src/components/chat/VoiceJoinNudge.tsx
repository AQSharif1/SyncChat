import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { analyticsClient } from '@/utils/analytics';
import { cn } from '@/lib/utils';

interface VoiceJoinNudgeProps {
  groupId: string;
  participantCount: number;
  firstParticipantName: string;
  onJoin: () => void;
  onDismiss: () => void;
}

export const VoiceJoinNudge = ({
  groupId,
  participantCount,
  firstParticipantName,
  onJoin,
  onDismiss,
}: VoiceJoinNudgeProps) => {
  const [visible, setVisible] = useState(false);
  const onDismissRef = useRef(onDismiss);
  const onJoinRef = useRef(onJoin);

  onDismissRef.current = onDismiss;
  onJoinRef.current = onJoin;

  useEffect(() => {
    analyticsClient.track('voice_nudge_shown', { group_id: groupId }, groupId);
    const showTimer = requestAnimationFrame(() => setVisible(true));

    const dismissTimer = setTimeout(() => {
      analyticsClient.track('voice_nudge_dismissed', { group_id: groupId }, groupId);
      onDismissRef.current();
    }, 8000);

    return () => {
      cancelAnimationFrame(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [groupId]);

  const handleDismiss = () => {
    analyticsClient.track('voice_nudge_dismissed', { group_id: groupId }, groupId);
    onDismiss();
  };

  const handleJoin = () => {
    analyticsClient.track('voice_nudge_accepted', { group_id: groupId }, groupId);
    onJoinRef.current();
  };

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-40 mx-auto max-w-6xl px-3 sm:px-4 transition-transform duration-300 ease-out',
        'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="flex h-11 items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 shadow-sm">
        <p className="truncate text-sm text-foreground">
          {firstParticipantName} started a voice room
          {participantCount > 1 ? ` · ${participantCount} in voice` : ''} · Join them?
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" className="h-7 px-3 text-xs" onClick={handleJoin}>
            Join
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
