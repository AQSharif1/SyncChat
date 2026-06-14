import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAppData } from '@/hooks/useAppData';
import { useEngagement } from '@/hooks/useEngagement';
import { usePremium } from '@/hooks/usePremium';
import { useGroupLifecycle } from '@/hooks/useGroupLifecycle';
import {
  MessageCircle,
  Users,
  Compass,
  ChevronRight,
  Crown,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { GroupIdentityDisplay } from '@/components/group/GroupIdentityDisplay';
import { SeasonMemoriesSection } from '@/components/group/SeasonMemoriesSection';
import { CommunityReputationCard } from '@/components/reputation/CommunityReputationCard';
import { PageHeader, SectionCard, EmptyState, SectionHeader } from '@/components/design-system';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { GROUP_MAX_MEMBERS } from '@/types/matchingProfile';
import { supabase } from '@/integrations/supabase/client';

interface HomePageProps {
  onStartMatching?: (groupId?: string, groupData?: any) => void;
  onViewPremium?: () => void;
  isFindingCommunity?: boolean;
  className?: string;
}

export const HomePage: React.FC<HomePageProps> = ({
  onStartMatching,
  onViewPremium,
  isFindingCommunity = false,
  className,
}) => {
  const { user } = useAuth();
  const { currentGroup: appCurrentGroup } = useAppData();
  const { engagement } = useEngagement();
  const { isPremium } = usePremium();
  const { lifecycleData } = useGroupLifecycle(appCurrentGroup?.id ?? null);

  const [userProfile, setUserProfile] = useState<{ username?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadUserData();
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', user.id)
        .single();
      if (profile) setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterChat = async () => {
    if (!user) return;

    try {
      const { data: membership, error } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups!inner(
            id, name, vibe_label, group_type, description,
            identity_tags, current_members, max_members,
            lifecycle_stage, created_at
          )
        `)
        .eq('user_id', user.id)
        .eq('groups.lifecycle_stage', 'active')
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (membership?.groups) {
        const groupData = membership.groups as Record<string, unknown>;
        const { data: memberCount } = await supabase
          .from('group_members')
          .select('user_id', { count: 'exact' })
          .eq('group_id', groupData.id as string);

        onStartMatching?.(groupData.id as string, {
          id: groupData.id,
          name: groupData.name,
          vibe_label: groupData.vibe_label,
          group_type: groupData.group_type,
          description: groupData.description,
          identity_tags: groupData.identity_tags,
          current_members: memberCount?.length || (groupData.current_members as number) || 0,
          max_members: (groupData.max_members as number) ?? 8,
          lifecycle_stage: groupData.lifecycle_stage,
          created_at: groupData.created_at,
        });
      } else {
        onStartMatching?.();
      }
    } catch (error) {
      console.error('Error checking user group:', error);
      onStartMatching?.();
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <div className={`max-w-lg mx-auto px-4 py-6 pb-24 space-y-8 animate-fade-in ${className}`}>
      <PageHeader
        title={`${getGreeting()}, ${userProfile?.username || 'friend'}`}
        subtitle="Here's what's happening."
      />

      {/* Current Community — primary focus */}
      <section className="space-y-3">
        <SectionHeader>Current Community</SectionHeader>

        {appCurrentGroup ? (
          <SectionCard padding="lg" className="space-y-4 border-primary/20 primary-glow">
            <GroupIdentityDisplay
              name={appCurrentGroup.name}
              vibeLabel={appCurrentGroup.vibe_label}
              description={appCurrentGroup.description}
              memberCount={
                (appCurrentGroup as { actual_member_count?: number }).actual_member_count ??
                appCurrentGroup.current_members ??
                0
              }
              maxMembers={appCurrentGroup.max_members ?? GROUP_MAX_MEMBERS}
              identityTags={appCurrentGroup.identity_tags}
              seasonNumber={lifecycleData?.seasonNumber}
            />

            {lifecycleData?.lifecycleStage && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs capitalize">
                  Season {lifecycleData.seasonNumber ?? 1}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {lifecycleData.lifecycleStage.replace(/_/g, ' ')}
                </Badge>
              </div>
            )}

            <Button
              onClick={handleEnterChat}
              className="w-full gap-2"
              size="lg"
              disabled={isFindingCommunity}
            >
              {isFindingCommunity ? (
                <>
                  <LoadingSpinner size="sm" />
                  Finding your community...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Enter {appCurrentGroup?.name ?? 'Community Chat'}
                  <ChevronRight className="w-4 h-4 ml-auto" />
                </>
              )}
            </Button>
          </SectionCard>
        ) : (
          <SectionCard>
            <EmptyState
              icon={Users}
              title="Your group is out there"
              description="Tell us who you are and we'll find people who actually click with you."
              action={{
                label: isFindingCommunity ? 'Finding your community...' : 'Find my people',
                onClick: handleEnterChat,
              }}
            />
          </SectionCard>
        )}
      </section>

      {/* Community Activity */}
      {appCurrentGroup && (
        <section className="space-y-3">
          <SectionHeader>Your community</SectionHeader>
          <SectionCard className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {(appCurrentGroup as { actual_member_count?: number }).actual_member_count ??
                    appCurrentGroup.current_members ??
                    0}{' '}
                  members active
                </p>
                <p className="text-xs text-muted-foreground">
                  {engagement?.daily_streak
                    ? `${engagement.daily_streak}-day engagement streak`
                    : 'Jump in and say hello'}
                </p>
              </div>
            </div>

            {user && (
              <div className="pt-1">
                <CommunityReputationCard compact />
              </div>
            )}
          </SectionCard>
        </section>
      )}

      {/* Season Memories preview */}
      {appCurrentGroup && (
        <section className="space-y-3">
          <SectionHeader>This season</SectionHeader>
          <SeasonMemoriesSection
            groupId={appCurrentGroup.id}
            groupName={appCurrentGroup.name}
            compact
          />
        </section>
      )}

      {/* Discover — only when relevant */}
      {(!isPremium || !appCurrentGroup) && (
        <section className="space-y-3">
          <SectionHeader>Discover</SectionHeader>
          <div className="space-y-2">
            {!isPremium && (
              <SectionCard
                interactive
                onClick={onViewPremium}
                className="flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium">SyncChat Premium</p>
                  <p className="text-xs text-muted-foreground">
                    Multiple communities, enhanced memories, and more
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </SectionCard>
            )}

            {appCurrentGroup && !isPremium && (
              <SectionCard className="flex items-center gap-3 opacity-80">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Community refresh</p>
                  <p className="text-xs text-muted-foreground">
                    Available with Premium — find a new community when you're ready
                  </p>
                </div>
              </SectionCard>
            )}

            {!appCurrentGroup && (
              <SectionCard
                interactive
                onClick={handleEnterChat}
                className="flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Compass className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium">Open communities</p>
                  <p className="text-xs text-muted-foreground">
                    Get matched with people who share your vibe
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </SectionCard>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
