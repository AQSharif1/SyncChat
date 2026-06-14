import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFlow } from '@/hooks/useAuthFlow';
import { useIsMobile, useDeviceType } from '@/hooks/use-mobile';
import { useAppData } from '@/hooks/useAppData';

import { supabase } from '@/integrations/supabase/client';
import { assignUserToBestGroup } from '@/utils/groupAssignment';
import { hasCompleteProfile, type MatchingProfile } from '@/types/matchingProfile';
import { toast } from 'sonner';
import { useMatchingQueue } from '@/hooks/useMatchingQueue';
import { WaitingForGroupScreen } from '@/components/matching/WaitingForGroupScreen';
import { NavigationBar } from '@/components/navigation/NavigationBar';
import { BottomNav, type AppTab } from '@/components/navigation/BottomNav';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import type { OnboardingCompleteResult } from '@/hooks/useOnboardingCompletion';
import { HomePage } from '@/components/home/HomePage';
import { MemoriesPage } from '@/components/memories/MemoriesPage';
import { WelcomingLanding } from '@/components/landing/WelcomingLanding';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { GroupChat } from '@/components/chat/GroupChat';
import { GroupArrivalScreen } from '@/components/group/GroupArrivalScreen';
import { useGroupArrival } from '@/hooks/useGroupArrival';
import { PremiumUpgrade } from '@/components/premium/PremiumUpgrade';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

const Index = () => {
  const { user } = useAuth();
  const { authState, refreshUserStatus } = useAuthFlow();
  const { userProfile, currentGroup, isLoading: dataLoading, setCurrentGroup, refreshData } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();

  const isMobile = useIsMobile();
  const deviceType = useDeviceType();
  const [showPremium, setShowPremium] = useState(false);
  const [isFindingCommunity, setIsFindingCommunity] = useState(false);
  const { status: queueStatus, setNotifyWhenReady, refreshStatus, isWaiting } = useMatchingQueue();

  const getCurrentTab = (): AppTab | 'settings' => {
    const path = location.pathname;
    if (path === '/profile' || path === '/settings') return 'profile';
    if (path === '/community' || path === '/chat') return 'community';
    if (path === '/memories') return 'memories';
    return 'home';
  };

  const [activeTab, setActiveTab] = useState<AppTab | 'settings'>(getCurrentTab());

  useEffect(() => {
    setActiveTab(getCurrentTab());
  }, [location.pathname]);

  // Redirect legacy /settings to profile
  useEffect(() => {
    if (location.pathname === '/settings') {
      navigate('/profile', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const handleGroupReady = async (event: Event) => {
      const detail = (event as CustomEvent<{ groupId?: string }>).detail;
      await refreshData();
      await refreshStatus();
      if (detail?.groupId) {
        const { data } = await supabase
          .from('groups')
          .select('*')
          .eq('id', detail.groupId)
          .maybeSingle();
        if (data) {
          setCurrentGroup({
            id: data.id,
            name: data.name,
            vibe_label: data.vibe_label ?? '',
            group_type: data.group_type,
            description: data.description,
            identity_tags: data.identity_tags,
            current_members: data.current_members ?? 0,
            max_members: data.max_members ?? 8,
            lifecycle_stage: data.lifecycle_stage ?? 'active',
            created_at: data.created_at,
          });
          navigate('/community');
        }
      }
    };

    window.addEventListener('matching:group-ready', handleGroupReady);
    return () => window.removeEventListener('matching:group-ready', handleGroupReady);
  }, [navigate, refreshData, refreshStatus, setCurrentGroup]);

  const handleTabNavigate = (tab: AppTab) => {
    const routes: Record<AppTab, string> = {
      home: '/home',
      community: '/community',
      memories: '/memories',
      profile: '/profile',
    };
    navigate(routes[tab]);
  };

  const handleCompleteOnboarding = async (result: OnboardingCompleteResult) => {
    try {
      if (result.waitingForGroup) {
        await refreshUserStatus();
        await refreshStatus();
        navigate('/home');
        return;
      }

      if (result.group) {
        setCurrentGroup({
          id: result.group.id,
          name: result.group.name,
          vibe_label: result.group.vibe_label,
          group_type: result.group.group_type,
          description: result.group.description,
          identity_tags: result.group.identity_tags,
          current_members: result.group.current_members,
          max_members: result.group.max_members,
          lifecycle_stage: 'active',
          created_at: new Date().toISOString(),
        });
      }

      await refreshUserStatus();
      await refreshData();
      navigate('/community');
    } catch {
      navigate('/home');
    }
  };

  const handleGroupMatched = async (groupId: string, groupData?: Record<string, unknown>) => {
    if (groupData) {
      setCurrentGroup({
        id: groupData.id as string,
        name: groupData.name as string,
        vibe_label: (groupData.vibe_label as string) ?? '',
        group_type: (groupData.group_type as string) ?? null,
        description: (groupData.description as string) ?? null,
        identity_tags: (groupData.identity_tags as string[]) ?? null,
        current_members: (groupData.current_members as number) ?? 0,
        max_members: (groupData.max_members as number) ?? 8,
        lifecycle_stage: (groupData.lifecycle_stage as string) ?? 'active',
        created_at: (groupData.created_at as string) ?? new Date().toISOString(),
      });
    } else {
      try {
        const { data } = await supabase
          .from('groups')
          .select('*')
          .eq('id', groupId)
          .maybeSingle();

        if (data) {
          setCurrentGroup({
            id: data.id,
            name: data.name,
            vibe_label: data.vibe_label ?? '',
            group_type: data.group_type,
            description: data.description,
            identity_tags: data.identity_tags,
            current_members: data.current_members ?? 0,
            max_members: data.max_members ?? 8,
            lifecycle_stage: data.lifecycle_stage ?? 'active',
            created_at: data.created_at,
          });
        }
      } catch {
        // silent
      }
    }
    navigate('/community');
  };

  const handleFindCommunity = async () => {
    if (!user || isFindingCommunity) return;

    setIsFindingCommunity(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(
          'username, life_stage, primary_goals, personality_traits, activity_level, active_period, interests, genres, personality, habits'
        )
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!profile || !hasCompleteProfile(profile)) {
        await refreshUserStatus();
        return;
      }

      const matchingProfile: MatchingProfile = {
        username: profile.username ?? '',
        life_stage: profile.life_stage ?? null,
        primary_goals: profile.primary_goals ?? [],
        personality_traits: profile.personality_traits ?? [],
        activity_level: profile.activity_level ?? null,
        active_period: profile.active_period ?? null,
        interests: profile.interests ?? [],
        genres: profile.genres ?? [],
        personality: profile.personality ?? [],
        habits: profile.habits ?? [],
      };

      const assignment = await assignUserToBestGroup(matchingProfile, user.id);
      if (!assignment) {
        toast.error('We could not find a compatible community right now. Please try again shortly.');
        return;
      }

      if (assignment.status === 'waiting') {
        await refreshStatus();
        toast.message("You're in the queue — we're finding your people.");
        return;
      }

      await refreshData();
      await handleChatNavigation();
    } catch (error) {
      console.error('Error finding community:', error);
      toast.error('Something went wrong while finding your community.');
    } finally {
      setIsFindingCommunity(false);
    }
  };

  const handleChatNavigation = async () => {
    if (!currentGroup && user) {
      try {
        const { data: groupMembership } = await supabase
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

        if (groupMembership) {
          const groupData = groupMembership.groups as Record<string, unknown>;
          setCurrentGroup({
            id: groupData.id as string,
            name: groupData.name as string,
            vibe_label: groupData.vibe_label as string,
            group_type: groupData.group_type as string,
            description: groupData.description as string,
            identity_tags: groupData.identity_tags as string[],
            current_members: groupData.current_members as number,
            max_members: (groupData.max_members as number) ?? 8,
            lifecycle_stage: groupData.lifecycle_stage as string,
            created_at: groupData.created_at as string,
          });
        }
      } catch (error) {
        console.error('Error loading group data:', error);
      }
    }
    navigate('/community');
  };

  if (!user) {
    return <WelcomingLanding />;
  }

  if (!user.email_confirmed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md mx-auto">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto" aria-hidden="true">
            <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Verify Your Email</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Check your email and click the verification link to access all features.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
            >
              I've Verified My Email
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full px-4 py-3 border border-input bg-background rounded-lg hover:bg-muted text-sm"
            >
              Continue Anyway
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authState.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <LoadingSpinner size="lg" text="Checking your account..." />
      </div>
    );
  }

  if (user && !userProfile && dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <LoadingSpinner size="lg" text="Loading your profile..." />
      </div>
    );
  }

  if (authState.shouldShowOnboarding) {
    return <OnboardingFlow onComplete={handleCompleteOnboarding} />;
  }

  if (isWaiting && !currentGroup && queueStatus) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationBar isMobile={isMobile} activeTab="home" />
        <div className="pt-14">
          <WaitingForGroupScreen
            status={queueStatus}
            profile={userProfile ? {
              username: userProfile.username ?? '',
              life_stage: userProfile.life_stage ?? null,
              primary_goals: userProfile.primary_goals ?? [],
              personality_traits: userProfile.personality_traits ?? [],
              activity_level: userProfile.activity_level ?? null,
              active_period: userProfile.active_period ?? null,
              interests: userProfile.interests ?? [],
            } : null}
            onNotifyChange={setNotifyWhenReady}
          />
        </div>
        <BottomNav activeTab="home" onNavigate={handleTabNavigate} />
      </div>
    );
  }

  const isChatView = activeTab === 'community';
  const showBottomNav = !isChatView;
  const { shouldShow: showArrival, loading: arrivalLoading, markSeen: markArrivalSeen } =
    useGroupArrival(isChatView && currentGroup ? currentGroup.id : undefined);

  const renderMainContent = () => {
    if (activeTab === 'profile') {
      return (
        <div className="animate-fade-in">
          <ProfilePage
            onViewPremium={() => setShowPremium(true)}
            defaultTab={location.pathname === '/settings' ? 'settings' : undefined}
          />
        </div>
      );
    }

    if (activeTab === 'memories') {
      return (
        <div className="animate-fade-in">
          <MemoriesPage onViewPremium={() => setShowPremium(true)} />
        </div>
      );
    }

    if (activeTab === 'community') {
      if (!currentGroup) {
        return (
          <div className="min-h-[60vh] flex items-center justify-center bg-background p-4 pb-24">
            <div className="text-center space-y-4 max-w-sm mx-auto">
              <MessageCirclePlaceholder />
              <h1 className="text-xl font-semibold text-foreground">No Active Community</h1>
              <p className="text-sm text-muted-foreground">
                Join a community from Home to start chatting.
              </p>
              <button
                onClick={() => navigate('/home')}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium"
              >
                Go to Home
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="animate-fade-in h-full">
          {arrivalLoading ? (
            <div className="min-h-[60vh] flex items-center justify-center">
              <LoadingSpinner size="lg" text="Loading your group..." />
            </div>
          ) : showArrival ? (
            <GroupArrivalScreen
              groupId={currentGroup.id}
              groupName={currentGroup.name}
              vibeLabel={currentGroup.vibe_label}
              identityTags={currentGroup.identity_tags}
              memberCount={currentGroup.current_members || 0}
              onEnter={() => markArrivalSeen()}
            />
          ) : (
            <GroupChat
              groupId={currentGroup.id}
              groupName={currentGroup.name}
              groupVibe={currentGroup.vibe_label}
              groupDescription={currentGroup.description}
              memberCount={currentGroup.current_members || 0}
              maxMembers={currentGroup.max_members || 8}
              isFirstSession={sessionStorage.getItem('syncchat_first_session') === currentGroup.id}
              onBack={() => navigate('/home')}
              onGoHome={() => navigate('/home')}
              onViewPremium={() => setShowPremium(true)}
            />
          )}
        </div>
      );
    }

    return (
      <div className="animate-fade-in">
        <HomePage
          onStartMatching={(groupId, groupData) => {
            if (groupId && groupData) {
              handleGroupMatched(groupId, groupData);
            } else {
              handleFindCommunity();
            }
          }}
          onViewPremium={() => setShowPremium(true)}
          isFindingCommunity={isFindingCommunity}
        />
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen bg-background ${
        deviceType === 'mobile' ? 'mobile-optimized' : 'laptop-optimized'
      }`}
    >
      <NavigationBar isMobile={isMobile} activeTab={isChatView ? undefined : (activeTab as AppTab)} />

      <div className={`${isChatView ? 'h-[100dvh]' : 'pt-14 safe-area-pb-nav'}`}>
        {renderMainContent()}
      </div>

      {showBottomNav && (
        <BottomNav
          activeTab={activeTab as AppTab}
          onNavigate={handleTabNavigate}
        />
      )}

      <ResponsiveModal
        open={showPremium}
        onOpenChange={setShowPremium}
        title="SyncChat Premium"
        className="max-w-2xl"
      >
        <PremiumUpgrade onClose={() => setShowPremium(false)} />
      </ResponsiveModal>
    </div>
  );
};

function MessageCirclePlaceholder() {
  return (
    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto" aria-hidden="true">
      <svg className="w-7 h-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    </div>
  );
}

export default Index;
