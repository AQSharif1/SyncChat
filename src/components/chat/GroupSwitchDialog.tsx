import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Crown, Users, Loader2 } from 'lucide-react';
import { useGroupSwitching } from '@/hooks/useGroupSwitching';
import { usePremium } from '@/hooks/usePremium';
import { supabase } from '@/integrations/supabase/client';

interface GroupSwitchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  onSwitchSuccess: (newGroupId: string, newGroupData: Record<string, unknown>) => void;
  onUpgrade?: () => void;
}

type SwitchScreen = 'summary' | 'confirm';

interface LeaveSummary {
  days_together: number;
  messages_sent: number;
  karma_level: string;
}

function StatPill({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex-1 text-center p-3 rounded-xl bg-muted/50 border border-border/40 space-y-0.5">
      <div className="text-base font-semibold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function SwitchLimitSection({
  remainingSwitches,
  switchLimit,
  isPremium,
  canSwitch,
  onUpgrade,
}: {
  remainingSwitches: number;
  switchLimit: number;
  isPremium: boolean;
  canSwitch: boolean;
  onUpgrade?: () => void;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Group switches this season:</span>
        <div className="flex items-center gap-2">
          <Badge variant={remainingSwitches > 0 ? 'default' : 'destructive'}>
            {isPremium ? 'Unlimited' : `${remainingSwitches} of ${switchLimit}`}
          </Badge>
          {isPremium && <Crown className="w-4 h-4 text-yellow-500" />}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {isPremium
          ? 'Premium members can switch groups anytime.'
          : 'Free members get 1 group switch per season.'}
      </p>

      {!canSwitch && !isPremium && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            <span>No switches remaining this season</span>
          </div>
          {onUpgrade && (
            <Button variant="outline" size="sm" className="w-full" onClick={onUpgrade}>
              Upgrade for unlimited switches
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export const GroupSwitchDialog = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  onSwitchSuccess,
  onUpgrade,
}: GroupSwitchDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [screen, setScreen] = useState<SwitchScreen>('summary');
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const { canSwitch, remainingSwitches, switchLimit, performGroupSwitch } = useGroupSwitching();
  const { isPremium } = usePremium();

  useEffect(() => {
    if (!isOpen) return;
    setScreen('summary');
    setSummary(null);
    setSummaryLoading(true);
    supabase
      .rpc('get_group_leave_summary', { p_group_id: groupId })
      .then(({ data }) => {
        if (data && typeof data === 'object' && !('error' in data)) {
          const payload = data as Record<string, unknown>;
          setSummary({
            days_together: Number(payload.days_together) || 0,
            messages_sent: Number(payload.messages_sent) || 0,
            karma_level: String(payload.karma_level ?? 'Newcomer 🌱'),
          });
        }
        setSummaryLoading(false);
      });
  }, [isOpen, groupId]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setScreen('summary');
      onClose();
    }
  };

  const handleConfirmSwitch = async () => {
    setIsLoading(true);
    try {
      const result = await performGroupSwitch(groupId);
      if (result.success && result.newGroupId) {
        onSwitchSuccess(result.newGroupId, result.newGroupData ?? {});
        setScreen('summary');
        onClose();
      }
    } catch (error) {
      console.error('Error during group switch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        {screen === 'summary' ? (
          <>
            <DialogHeader>
              <DialogTitle>Before you go</DialogTitle>
              <DialogDescription>
                Here&apos;s what you&apos;d be leaving behind in{' '}
                <strong>{groupName}</strong>.
              </DialogDescription>
            </DialogHeader>

            {summaryLoading ? (
              <div className="flex gap-3 my-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="flex-1 h-16 rounded-xl" />
                ))}
              </div>
            ) : summary ? (
              <div className="flex gap-3 my-2">
                <StatPill value={summary.days_together} label="days together" />
                <StatPill value={summary.messages_sent} label="messages sent" />
                <StatPill value={summary.karma_level} label="karma earned" />
              </div>
            ) : null}

            <div className="space-y-1.5 text-sm text-muted-foreground rounded-xl bg-muted/30 border border-border/30 p-3">
              <p>✓ Your messages and memories are archived</p>
              <p>✓ Your karma in this group is preserved</p>
              <p>✓ You&apos;ll be rematched based on your profile</p>
            </div>

            <SwitchLimitSection
              remainingSwitches={remainingSwitches}
              switchLimit={switchLimit}
              isPremium={isPremium}
              canSwitch={canSwitch}
              onUpgrade={onUpgrade}
            />

            <DialogFooter className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Stay in {groupName}
              </Button>
              <Button
                onClick={() => setScreen('confirm')}
                disabled={!canSwitch && !isPremium}
              >
                Continue →
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <DialogTitle>Switch groups?</DialogTitle>
              </div>
              <DialogDescription>
                You&apos;re about to leave <strong>{groupName}</strong> and get matched
                into a new group.{' '}
                {isPremium
                  ? 'This uses one of your unlimited switches.'
                  : 'This uses your 1 switch this season.'}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setScreen('summary')}
                disabled={isLoading}
              >
                ← Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmSwitch}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finding new group...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Switch Groups
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
