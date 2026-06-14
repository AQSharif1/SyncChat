import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGroupIcebreaker } from '@/hooks/useGroupIcebreaker';
import { useGroupChatContext } from './GroupChatContext';
import { analyticsClient } from '@/utils/analytics';

interface ChatIcebreakerProps {
  messageCount: number;
}

export const ChatIcebreaker = ({ messageCount }: ChatIcebreakerProps) => {
  const { groupId, focusChatInput, setActiveIcebreakerId } = useGroupChatContext();
  const { icebreaker, isVisible, dismissIcebreaker } = useGroupIcebreaker(groupId);
  const trackedShownRef = useRef(false);

  const shouldShow = isVisible && messageCount < 5;

  useEffect(() => {
    setActiveIcebreakerId(shouldShow && icebreaker ? icebreaker.id : null);
  }, [shouldShow, icebreaker, setActiveIcebreakerId]);

  useEffect(() => {
    if (shouldShow && icebreaker && !trackedShownRef.current) {
      analyticsClient.track('icebreaker_shown', {
        group_id: groupId,
        prompt_id: icebreaker.id,
      }, groupId);
      trackedShownRef.current = true;
    }
  }, [shouldShow, icebreaker, groupId]);

  if (!shouldShow || !icebreaker) return null;

  const handleAnswer = () => {
    focusChatInput();
  };

  const handleDismiss = async () => {
    analyticsClient.track('icebreaker_dismissed', {
      group_id: groupId,
      prompt_id: icebreaker.id,
    }, groupId);
    await dismissIcebreaker();
  };

  return (
    <Card className="mx-2 mb-3 border-amber-200/60 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/40 shadow-sm relative">
      <CardContent className="p-4 pt-5">
        <p className="text-xs font-medium text-amber-800/80 dark:text-amber-200/80 mb-2 uppercase tracking-wide">
          To get things started...
        </p>
        <p className="text-base sm:text-lg font-medium text-foreground leading-snug pr-6">
          {icebreaker.prompt_text}
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-4"
          onClick={handleAnswer}
        >
          Answer this
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute bottom-3 right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Dismiss icebreaker"
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
};
