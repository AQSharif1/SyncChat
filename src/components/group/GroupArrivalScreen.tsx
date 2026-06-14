import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { analyticsClient } from '@/utils/analytics';

interface GroupArrivalScreenProps {
  groupId: string;
  groupName: string;
  vibeLabel: string;
  identityTags?: string[] | null;
  memberCount: number;
  onEnter: (timeSpentSeconds: number) => void;
}

interface ArrivalMember {
  userId: string;
  username: string;
  isOnline: boolean;
}

export const GroupArrivalScreen = ({
  groupId,
  groupName,
  vibeLabel,
  identityTags,
  memberCount,
  onEnter,
}: GroupArrivalScreenProps) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<ArrivalMember[]>([]);
  const [sharedInterests, setSharedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const openedAtRef = useRef(Date.now());
  const trackedShownRef = useRef(false);

  useEffect(() => {
    if (!trackedShownRef.current) {
      trackedShownRef.current = true;
      analyticsClient.track('group_arrival_screen_shown', {
        group_id: groupId,
        member_count: memberCount,
      }, groupId);
    }
  }, [groupId, memberCount]);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;

      try {
        const { data: memberRows } = await supabase
          .from('group_members')
          .select(`
            user_id,
            shared_interests,
            profiles!inner(username, is_online, show_online_status)
          `)
          .eq('group_id', groupId);

        if (memberRows) {
          const parsed: ArrivalMember[] = memberRows
            .filter((m) => m.user_id !== user.id)
            .map((m) => {
              const profile = m.profiles as {
                username: string;
                is_online: boolean;
                show_online_status: boolean;
              };
              return {
                userId: m.user_id,
                username: profile.username,
                isOnline: Boolean(profile.is_online && profile.show_online_status),
              };
            });
          setMembers(parsed);

          const selfRow = memberRows.find((m) => m.user_id === user.id);
          const interests = (selfRow?.shared_interests as string[]) ?? [];
          setSharedInterests(interests);
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [groupId, user?.id]);

  const othersCount = Math.max(0, memberCount - 1);
  const othersLabel =
    othersCount === 1 ? 'You + 1 other are here' : `You + ${othersCount} others are here`;

  const handleEnter = () => {
    const timeSpentSeconds = Math.floor((Date.now() - openedAtRef.current) / 1000);
    analyticsClient.track('group_arrival_screen_completed', {
      group_id: groupId,
      time_spent_seconds: timeSpentSeconds,
    }, groupId);
    onEnter(timeSpentSeconds);
  };

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-lg mx-auto w-full space-y-8">
        <header className="text-center space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">Your new community</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{groupName}</h1>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="secondary">{vibeLabel}</Badge>
            {(identityTags ?? []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Who&apos;s in your group</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading members...</p>
          ) : (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {members.map((member) => (
                  <div key={member.userId} className="flex flex-col items-center gap-1.5 min-w-[64px]">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="text-sm">{getInitials(member.username)}</AvatarFallback>
                      </Avatar>
                      {member.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate max-w-[72px]">
                      {member.username}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{othersLabel}</p>
            </>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Why you were matched</h2>
          {sharedInterests.length > 0 ? (
            <>
              <p className="text-sm text-foreground">
                You all share:{' '}
                <span className="font-medium">{sharedInterests.join(', ')}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                We matched you based on your pace, interests, and how you like to connect.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              We matched you based on your pace, interests, and how you like to connect.
            </p>
          )}
        </section>

        <section className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>This is your space — chat, play games, hang out on voice.</p>
          <p>Every month your group decides if you want to keep going.</p>
          <p>The more you show up, the better it gets.</p>
        </section>
      </div>

      <div className="sticky bottom-0 p-4 bg-background/95 backdrop-blur-md border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto">
          <Button type="button" className="w-full h-12 text-base" onClick={handleEnter}>
            Meet your group →
          </Button>
        </div>
      </div>
    </div>
  );
};
