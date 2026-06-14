import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useGroupChatContext } from './GroupChatContext';
import { supabase } from '@/integrations/supabase/client';
import { analyticsClient } from '@/utils/analytics';

function getReEntryPrompt(): string {
  const day = new Date().getDay();
  if (day === 1 || day === 4) return 'Drop a GIF. No explanation needed.';
  if (day === 2 || day === 5) return "One word — how's your week going?";
  if (day === 3 || day === 6) return 'React to the last message below 👇';
  return "What's everyone up to today?";
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function nudgeStorageKey(groupId: string, userId: string): string {
  return `last_nudge_${groupId}_${userId}`;
}

export const GroupReEntryCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { groupId, messages, focusChatInput } = useGroupChatContext();
  const trackedShownRef = useRef(false);

  const { isGroupDormant, hoursSinceLast, userSentToday } = useMemo(() => {
    if (messages.length === 0) {
      return { isGroupDormant: false, hoursSinceLast: 999, userSentToday: false };
    }

    const lastMessage = messages[messages.length - 1];
    const hoursSince = (Date.now() - lastMessage.timestamp.getTime()) / (1000 * 60 * 60);
    const sentToday = user?.id
      ? messages.some((m) => m.userId === user.id && isToday(m.timestamp))
      : false;

    return {
      isGroupDormant: hoursSince > 48,
      hoursSinceLast: hoursSince,
      userSentToday: sentToday,
    };
  }, [messages, user?.id]);

  const shouldShow =
    messages.length > 0 && isGroupDormant && !userSentToday;

  useEffect(() => {
    if (!shouldShow || trackedShownRef.current) return;
    trackedShownRef.current = true;
    analyticsClient.track(
      're_entry_card_shown',
      {
        group_id: groupId,
        hours_since_last_message: Math.floor(hoursSinceLast),
      },
      groupId
    );
  }, [shouldShow, groupId, hoursSinceLast]);

  if (!shouldShow) return null;

  const handleStartSomething = () => {
    analyticsClient.track('re_entry_card_started', { group_id: groupId }, groupId);
    focusChatInput();
  };

  const handleNudgeGroup = async () => {
    if (!user?.id) return;

    const storageKey = nudgeStorageKey(groupId, user.id);
    const lastNudge = localStorage.getItem(storageKey);
    if (lastNudge) {
      const elapsed = Date.now() - Number(lastNudge);
      if (elapsed < 24 * 60 * 60 * 1000) {
        toast({
          title: 'Already nudged',
          description: 'You already nudged them recently — give it another day',
        });
        return;
      }
    }

    const { data, error } = await supabase.rpc('nudge_group_members', {
      p_group_id: groupId,
    });

    if (error) {
      toast({
        title: 'Nudge failed',
        description: 'Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    const result = data as { ok?: boolean; error?: string };
    if (!result?.ok) {
      toast({
        title: 'Nudge failed',
        description: result?.error ?? 'Could not nudge the group.',
        variant: 'destructive',
      });
      return;
    }

    localStorage.setItem(storageKey, String(Date.now()));
    analyticsClient.track('group_nudge_sent', { group_id: groupId }, groupId);
    toast({
      title: 'Group nudged',
      description: 'Your group has been nudged — someone might pop in soon',
    });
  };

  return (
    <Card className="mx-3 sm:mx-4 my-3 border-border/60 bg-muted/30">
      <CardContent className="p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          It&apos;s been quiet in here
        </p>
        <p className="text-sm text-foreground">{getReEntryPrompt()}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleStartSomething}>
            Start something
          </Button>
          <Button size="sm" variant="outline" onClick={handleNudgeGroup}>
            Nudge the group
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
