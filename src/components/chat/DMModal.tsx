import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  Search,
  Users,
  X,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePremium } from '@/hooks/usePremium';
import { useDMAllowance } from '@/hooks/useDMAllowance';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DMLimitModal } from './DMLimitModal';

interface DMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onUpgrade?: () => void;
}

export const DMModal = ({ open, onOpenChange, groupId, onUpgrade }: DMModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupMembers, setGroupMembers] = useState<Array<{ id: string; username: string; user_id: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [pendingMember, setPendingMember] = useState<{ userId: string; username: string } | null>(null);

  const { user } = useAuth();
  const { isPremium, canSendDM, shouldShowDMUpsell } = usePremium();
  const {
    activeConversationCount,
    totalConversationCount,
    accountAgeDays,
    refreshStats,
    hasExistingDMWith,
  } = useDMAllowance();
  const { toast } = useToast();

  useEffect(() => {
    if (open && user && groupId) {
      loadGroupMembers();
      refreshStats();
    }
  }, [open, user, groupId]);

  const loadGroupMembers = async () => {
    if (!user || !groupId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: members, error: dbError } = await supabase
        .from('group_members')
        .select(`
          id,
          user_id,
          profiles!inner(username)
        `)
        .eq('group_id', groupId)
        .eq('status', 'active')
        .neq('user_id', user.id);

      if (dbError) {
        setError(`Database error: ${dbError.message}`);
        return;
      }

      if (members) {
        setGroupMembers(
          members.map((m) => ({
            id: m.id,
            user_id: m.user_id,
            username: m.profiles.username,
          }))
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to load group members: ${message}`);
      toast({
        title: 'Error',
        description: 'Failed to load group members.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const sendDMRequest = async (memberId: string, username: string) => {
    try {
      const { error: dmError } = await supabase.from('reconnection_requests').insert({
        requester_id: user?.id,
        target_user_id: memberId,
        group_id: groupId,
      });

      if (dmError) throw dmError;

      await supabase.rpc('update_user_engagement', {
        p_user_id: user?.id,
        p_activity_type: 'reconnect',
      });

      await refreshStats();

      toast({
        title: 'DM Request Sent!',
        description: `Request sent to ${username}. You'll be notified if they accept.`,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Error starting DM:', err);
      toast({
        title: 'Error',
        description: 'Failed to send DM request.',
        variant: 'destructive',
      });
    }
  };

  const handleStartDM = async (memberId: string, username: string) => {
    if (!user) return;

    const isNewConversation = !(await hasExistingDMWith(memberId));
    const context = {
      activeConversationCount,
      totalConversationCount,
      accountAgeDays,
      isNewConversation,
    };

    if (shouldShowDMUpsell(context)) {
      setPendingMember({ userId: memberId, username });
      setShowLimitModal(true);
      return;
    }

    if (!canSendDM(context)) {
      setPendingMember({ userId: memberId, username });
      setShowLimitModal(true);
      return;
    }

    await sendDMRequest(memberId, username);
  };

  const filteredMembers = groupMembers.filter((member) =>
    member.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error Loading DMs</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button className="w-full" onClick={() => { setError(null); loadGroupMembers(); }}>
              Retry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <MessageCircle className="h-6 w-6 text-primary" />
                <DialogTitle className="text-xl">Direct Messages</DialogTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {!isPremium && (
              <p className="text-xs text-muted-foreground pt-1">
                Free: up to 3 active conversations · Premium: unlimited
              </p>
            )}
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search group members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Loading group members...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No group members found</p>
              </div>
            ) : (
              filteredMembers.map((member) => (
                <Card key={member.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{member.username}</h4>
                      <p className="text-sm text-muted-foreground">Group member</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartDM(member.user_id, member.username)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Send DM
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DMLimitModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        onUpgrade={() => {
          setShowLimitModal(false);
          onUpgrade?.();
        }}
        onViewConversations={() => {
          setShowLimitModal(false);
          onOpenChange(false);
        }}
        onContinue={
          pendingMember
            ? () => {
                setShowLimitModal(false);
                if (pendingMember) {
                  sendDMRequest(pendingMember.userId, pendingMember.username);
                  setPendingMember(null);
                }
              }
            : undefined
        }
      />
    </>
  );
};
