import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { MessageCircle, Search, Users, X, Plus, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePremium } from '@/hooks/usePremium';
import { useDMAllowance } from '@/hooks/useDMAllowance';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DMLimitModal } from './DMLimitModal';
import { analyticsClient } from '@/utils/analytics';

interface GroupMemberRow {
  id: string;
  username: string;
  user_id: string;
}

interface ChatDMPanelProps {
  groupId: string;
  onBack: () => void;
  onUpgrade?: () => void;
}

export const ChatDMPanel = ({ groupId, onBack, onUpgrade }: ChatDMPanelProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [groupMembers, setGroupMembers] = useState<GroupMemberRow[]>([]);
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
    if (user && groupId) {
      loadGroupMembers();
      refreshStats();
    }
  }, [user, groupId]);

  const loadGroupMembers = async () => {
    if (!user || !groupId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: members, error: dbError } = await supabase
        .from('group_members')
        .select('id, user_id, profiles!inner(username)')
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
            username: (m.profiles as { username: string }).username,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const sendDMRequest = async (memberId: string, username: string, isFirst: boolean) => {
    try {
      const { error: dmError } = await supabase.from('reconnection_requests').insert({
        requester_id: user?.id,
        target_user_id: memberId,
        group_id: groupId,
      });
      if (dmError) throw dmError;

      analyticsClient.track('dm_opened', { is_first_dm_with_person: isFirst });

      await supabase.rpc('update_user_engagement', {
        p_user_id: user?.id,
        p_activity_type: 'reconnect',
      });
      await refreshStats();

      toast({
        title: 'DM Request Sent!',
        description: `Request sent to ${username}. You'll be notified if they accept.`,
      });
      onBack();
    } catch {
      toast({ title: 'Error', description: 'Failed to send DM request.', variant: 'destructive' });
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

    if (shouldShowDMUpsell(context) || !canSendDM(context)) {
      analyticsClient.track('dm_limit_modal_shown', {
        active_conversation_count: activeConversationCount,
      });
      setPendingMember({ userId: memberId, username });
      setShowLimitModal(true);
      return;
    }

    await sendDMRequest(memberId, username, isNewConversation);
  };

  const filteredMembers = groupMembers.filter((m) =>
    m.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-6xl mx-auto bg-background">
      <div className="flex items-center gap-3 px-4 py-3 border-b sticky top-0 z-10 bg-background/95 backdrop-blur-md">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-9 w-9 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <MessageCircle className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-base">Direct Messages</h2>
      </div>

      {!isPremium && (
        <p className="text-xs text-muted-foreground px-4 py-2 border-b">
          Free: up to 3 active conversations · Premium: unlimited
        </p>
      )}

      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search group members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {error && (
          <div className="text-center text-destructive text-sm">
            <p>{error}</p>
            <Button className="mt-2" onClick={() => { setError(null); loadGroupMembers(); }}>Retry</Button>
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading group members...</p>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No group members found</p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <Card key={member.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{member.username}</h4>
                  <p className="text-sm text-muted-foreground">Group member</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleStartDM(member.user_id, member.username)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Send DM
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <DMLimitModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        onUpgrade={() => {
          setShowLimitModal(false);
          analyticsClient.track('dm_limit_upgraded', {
            active_conversation_count: activeConversationCount,
          });
          onUpgrade?.();
        }}
        onViewConversations={onBack}
        onContinue={
          pendingMember
            ? () => {
                setShowLimitModal(false);
                if (pendingMember) {
                  sendDMRequest(pendingMember.userId, pendingMember.username, true);
                  setPendingMember(null);
                }
              }
            : undefined
        }
      />
    </div>
  );
};

/** Modal wrapper for backward compatibility */
interface ChatDMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  onUpgrade?: () => void;
}

export const ChatDMModal = ({ open, onOpenChange, groupId, onUpgrade }: ChatDMModalProps) => {
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden p-0">
        <ChatDMPanel groupId={groupId} onBack={() => onOpenChange(false)} onUpgrade={onUpgrade} />
      </DialogContent>
    </Dialog>
  );
};
