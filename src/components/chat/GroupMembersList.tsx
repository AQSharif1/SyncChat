import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { KARMA_LEVELS } from '@/hooks/useEnhancedKarma';

interface GroupMember {
  user_id: string;
  username: string;
  joined_at: string;
  karmaPoints: number;
}

interface KarmaTierDisplay {
  label: string;
  icon: string;
  color: string;
}

function getKarmaTier(points: number): KarmaTierDisplay {
  let tier = KARMA_LEVELS[0];
  for (let i = KARMA_LEVELS.length - 1; i >= 0; i--) {
    if (points >= KARMA_LEVELS[i].minPoints) {
      tier = KARMA_LEVELS[i];
      break;
    }
  }

  const colorMap: Record<string, string> = {
    Newcomer: 'text-gray-500',
    Explorer: 'text-blue-500',
    Rising: 'text-teal-500',
    Champion: 'text-purple-500',
    Expert: 'text-indigo-500',
    Legend: 'text-amber-500',
    Mythical: 'text-pink-500',
  };

  return {
    label: tier.level,
    icon: tier.icon,
    color: colorMap[tier.level] ?? 'text-gray-500',
  };
}

interface GroupMembersListProps {
  groupId: string;
  memberCount: number;
}

export const GroupMembersList = ({ groupId, memberCount }: GroupMembersListProps) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchMembers = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          user_id,
          joined_at,
          profiles!inner(username)
        `)
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      const { data: karmaRows } = await supabase
        .from('group_karma')
        .select('user_id, karma_points')
        .eq('group_id', groupId);

      const karmaByUser = new Map(
        (karmaRows ?? []).map((row) => [row.user_id, row.karma_points ?? 0])
      );

      const membersWithUsernames: GroupMember[] =
        data?.map((item) => {
          const profile = item.profiles as { username?: string } | null;
          return {
            user_id: item.user_id,
            username: profile?.username ?? 'Unknown User',
            joined_at: item.joined_at,
            karmaPoints: karmaByUser.get(item.user_id) ?? 0,
          };
        }) ?? [];

      setMembers(membersWithUsernames);
    } catch (error) {
      console.error('Error fetching group members:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [isOpen, groupId]);

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return 'Today';
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Users className="w-4 h-4" />
          <span className="text-sm">
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Group Members ({memberCount})
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member, index) => {
                const tier = getKarmaTier(member.karmaPoints);
                return (
                <div key={member.user_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{member.username}</span>
                        <span title={`${tier.label} member`} className="text-sm leading-none">
                          {tier.icon}
                        </span>
                        {member.user_id === user?.id && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                        {index === 0 && (
                          <div title="First to join">
                            <Crown className="w-3 h-3 text-yellow-500" />
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Joined {formatJoinDate(member.joined_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </ScrollArea>
        
        <div className="text-center text-xs text-muted-foreground mt-4">
          Members are ordered by join date
        </div>
      </DialogContent>
    </Dialog>
  );
};