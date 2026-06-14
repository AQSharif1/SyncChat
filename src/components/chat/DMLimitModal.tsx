import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, Crown } from 'lucide-react';
import { FREE_ACTIVE_DM_LIMIT } from '@/hooks/usePremium';

interface DMLimitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpgrade: () => void;
  onViewConversations: () => void;
  onContinue?: () => void;
}

export function DMLimitModal({
  open,
  onOpenChange,
  onUpgrade,
  onViewConversations,
  onContinue,
}: DMLimitModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <DialogTitle>Active conversation limit</DialogTitle>
          </div>
          <DialogDescription className="pt-2 leading-relaxed">
            You have {FREE_ACTIVE_DM_LIMIT} active conversations — free accounts can keep up to{' '}
            {FREE_ACTIVE_DM_LIMIT} going at once. Upgrade to chat with everyone, or let an older
            conversation go quiet first.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button className="w-full gap-2" onClick={onUpgrade}>
            <Crown className="w-4 h-4" />
            Upgrade to Premium
          </Button>
          <Button variant="outline" className="w-full" onClick={onViewConversations}>
            View my conversations
          </Button>
          {onContinue && (
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={onContinue}>
              Continue anyway
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
