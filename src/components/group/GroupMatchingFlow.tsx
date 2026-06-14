import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Sparkles, RotateCcw, MessageCircle, Trophy, Crown, Home } from 'lucide-react';
import { GroupChat } from '../chat/GroupChat';
import { useEngagement } from '@/hooks/useEngagement';
import { usePremium } from '@/hooks/usePremium';
import { PremiumLimitModal } from '@/components/premium/PremiumLimitModal';
import { AchievementBadge } from '@/components/engagement/AchievementBadge';
import { useGroupMatchingLifecycle } from '@/hooks/useGroupMatchingLifecycle';
import { useNavigate } from 'react-router-dom';

import type { MatchingProfile } from '@/types/matchingProfile';
import { GROUP_MAX_MEMBERS } from '@/types/matchingProfile';
import { assignUserToBestGroup } from '@/utils/groupAssignment';
import { useGroupMemberManagement } from '@/hooks/useGroupMemberManagement';
import { GroupIdentityDisplay } from '@/components/group/GroupIdentityDisplay';

interface GroupData {
  id: string;
  name: string;
  vibe_label: string;
  group_type?: string | null;
  description?: string | null;
  identity_tags?: string[] | null;
  members: { username: string }[];
}

interface GroupMatchingFlowProps {
  userProfile: MatchingProfile;
  onGroupMatched: (groupId: string) => void;
}

export const GroupMatchingFlow = ({ userProfile, onGroupMatched }: GroupMatchingFlowProps) => {
  const [isMatching, setIsMatching] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<GroupData | null>(null);
  const [canSwitch, setCanSwitch] = useState(true);
  const [hasUsedFreeSwitch, setHasUsedFreeSwitch] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { engagement, achievements, trackActivity } = useEngagement();
  const { isPremium, canUseFeature } = usePremium();
  const navigate = useNavigate();
  const {
    lifecycleData,
    refreshLifecycleData,
    findAndJoinGroupWithCapacityCheck,
  } = useGroupMatchingLifecycle();
  const { removeUserFromGroup } = useGroupMemberManagement();

  useEffect(() => {
    if (user) {
      checkExistingGroup();
      checkSwitchStatus();
      refreshLifecycleData();
    }
  }, [user]);

  const checkExistingGroup = async () => {
    if (!user) return;

    try {
      const { data: membership } = await supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id,
            name,
            vibe_label,
            group_type,
            description,
            identity_tags
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (membership?.groups) {
        // Get group members with their profiles
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', membership.group_id);

        // Get usernames for all members
        const memberUsernames: string[] = [];
        if (members) {
          for (const member of members) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('user_id', member.user_id)
              .single();
            
            memberUsernames.push(profile?.username || 'Unknown');
          }
        }

        const groupData: GroupData = {
          id: membership.groups.id,
          name: membership.groups.name,
          vibe_label: membership.groups.vibe_label,
          group_type: membership.groups.group_type,
          description: membership.groups.description,
          identity_tags: membership.groups.identity_tags,
          members: memberUsernames.map(username => ({ username }))
        };

        setCurrentGroup(groupData);
        onGroupMatched(groupData.id);
      }
    } catch (error) {
      console.error('Error checking existing group:', error);
    }
  };

  const checkSwitchStatus = async () => {
    if (!user) return;

    try {
      // Check if user has available group switches this month
      const { data: canSwitch, error: switchError } = await supabase
        .rpc('can_user_switch_groups', { p_user_id: user.id });
      
      if (switchError) {
        console.error('Error checking switch availability:', switchError);
        setCanSwitch(false);
        return;
      }
      
      setCanSwitch(canSwitch);
    } catch (error) {
      console.error('Error checking switch status:', error);
      setCanSwitch(false);
    }
  };

  const saveUserProfile = async () => {
    if (!user) return;

    try {
      await supabase.from('profiles').upsert(
        {
          user_id: user.id,
          username: userProfile.username,
          life_stage: userProfile.life_stage,
          primary_goals: userProfile.primary_goals,
          personality_traits: userProfile.personality_traits,
          activity_level: userProfile.activity_level,
          active_period: userProfile.active_period,
          interests: userProfile.interests,
        },
        { onConflict: 'user_id' }
      );
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  };

  const findOrCreateGroup = async () => {
    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'Please log in again to join a group.',
        variant: 'destructive',
      });
      return;
    }

    setIsMatching(true);

    try {
      await saveUserProfile();

      const assignment = await assignUserToBestGroup(userProfile, user.id);

      if (!assignment) {
        throw new Error('Could not find or create a compatible group');
      }

      if (assignment.status === 'waiting') {
        toast({
          title: "You're in the queue",
          description: "We're finding your people — you'll be notified when your group is ready.",
        });
        setIsMatching(false);
        return;
      }

      const targetGroupId = assignment.groupId;

      // Verify group membership and get complete group data
      const { data: groupData, error: groupDataError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', targetGroupId)
        .single();

      if (groupDataError || !groupData) {
        console.error('❌ Failed to fetch group data:', groupDataError);
        throw new Error('Failed to fetch group information after joining');
      }

      // Get actual member count and usernames
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select(`
          user_id,
          profiles!inner(username)
        `)
        .eq('group_id', targetGroupId);

      const memberUsernames = members?.map(m => ({ 
        username: m.profiles?.username || 'Unknown User' 
      })) || [{ username: userProfile.username }];

      const completeGroup: GroupData = {
        id: targetGroupId,
        name: groupData.name,
        vibe_label: groupData.vibe_label || 'Friendly conversations',
        group_type: groupData.group_type,
        description: groupData.description,
        identity_tags: groupData.identity_tags,
        members: memberUsernames
      };

      setCurrentGroup(completeGroup);
      onGroupMatched(targetGroupId);

      const identityLine = groupData.description
        ? `${groupData.description}`
        : `A ${groupData.group_type?.replace(/_/g, ' ') ?? 'community'} group matched to your profile.`;

      toast({
        title: "🎉 Welcome to Your Group!",
        description: `You've joined ${groupData.name}. ${identityLine}`,
        variant: "default"
      });

    } catch (error: any) {
      console.error('❌ Critical error in group matching:', error);
      
      let errorMessage = 'Failed to find or create group. Please try again.';
      if (error.message?.includes('Profile save')) {
        errorMessage = 'Failed to save your profile. Please check your information and try again.';
      } else if (error.message?.includes('Group creation')) {
        errorMessage = 'Failed to create a new group. Please try again or contact support.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      toast({
        title: "Group Matching Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsMatching(false);
    }
  };

  const handleSwitchGroup = async () => {
    if (!user || !currentGroup) return;

    // Check if user can switch groups
    if (!isPremium && hasUsedFreeSwitch) {
      setShowLimitModal(true);
      return;
    }

    // Check daily switch limit for free users
    if (!isPremium && engagement && engagement.group_switches_used_today >= 1) {
      setShowLimitModal(true);
      return;
    }

    try {
      const { data: switchUsed, error: switchError } = await supabase.rpc('use_group_switch', {
        p_user_id: user.id,
      });

      if (switchError) throw switchError;
      if (!switchUsed && !isPremium) {
        setShowLimitModal(true);
        return;
      }

      const removeResult = await removeUserFromGroup(currentGroup.id);
      if (!removeResult.success) {
        throw new Error(removeResult.error ?? 'Failed to leave current group');
      }

      await trackActivity('group_switch');

      if (!isPremium) {
        setHasUsedFreeSwitch(true);
        setCanSwitch(false);
      }

      setCurrentGroup(null);

      // Find new group
      await findOrCreateGroup();

    } catch (error) {
      console.error('Error switching groups:', error);
      toast({
        title: "Error",
        description: "Failed to switch groups. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (showChat && currentGroup) {
    return (
      <GroupChat
        groupId={currentGroup.id}
        groupName={currentGroup.name}
        groupVibe={currentGroup.vibe_label}
        groupDescription={currentGroup.description}
        memberCount={currentGroup.members.length}
        maxMembers={GROUP_MAX_MEMBERS}
        onBack={() => setShowChat(false)}
      />
    );
  }

  if (currentGroup) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Home Button */}
        <div className="mb-4 flex justify-start">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </div>
        
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10" />
          {isPremium && (
            <div className="absolute top-4 right-4">
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            </div>
          )}
          <CardHeader className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {currentGroup.group_type && (
                <Badge variant="secondary" className="capitalize">
                  {currentGroup.group_type.replace(/_/g, ' ')}
                </Badge>
              )}
              {lifecycleData.matchingMode === 'strict' && (
                <Badge variant="outline" className="text-xs">
                  Curated Match
                </Badge>
              )}
            </div>
            <GroupIdentityDisplay
              name={currentGroup.name}
              vibeLabel={currentGroup.vibe_label}
              description={currentGroup.description}
              memberCount={currentGroup.members.length}
              maxMembers={GROUP_MAX_MEMBERS}
              identityTags={currentGroup.identity_tags}
            />
          </CardHeader>
          <CardContent className="relative space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Group Members:</h4>
              <div className="flex flex-wrap gap-2">
                {currentGroup.members.map((member, index) => (
                  <Badge key={index} variant="outline">
                    {member.username}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Engagement Summary */}
            {engagement && (
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Your Progress</span>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm font-bold">
                      {engagement.achievement_points} pts
                      {isPremium && <span className="text-xs text-primary ml-1">(2x rate)</span>}
                    </span>
                  </div>
                </div>
                
                {achievements.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">Recent Achievement</span>
                    <AchievementBadge achievement={achievements[0]} size="sm" />
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-bold text-primary">{engagement.daily_streak}</div>
                    <div className="text-xs text-muted-foreground">Day Streak</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-500">{engagement.messages_sent_today}</div>
                    <div className="text-xs text-muted-foreground">Messages</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-pink-500">{engagement.reactions_given_today}</div>
                    <div className="text-xs text-muted-foreground">Reactions</div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowChat(true)}
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Open Chat
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleSwitchGroup}
                  disabled={!isPremium && !canSwitch}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  {isPremium ? 'Switch Group' : 
                   canSwitch ? 'Switch Group (Free)' : 'Switch Group (Premium)'}
                </Button>
              </div>
              
              {!isPremium && hasUsedFreeSwitch && (
                <p className="text-sm text-muted-foreground mt-2">
                  You've used your free switch. Upgrade to Premium for unlimited switches!
                </p>
              )}
              
              {isPremium && (
                <p className="text-sm text-primary mt-2 flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Unlimited group switching with Premium
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <PremiumLimitModal
          open={showLimitModal}
          onOpenChange={setShowLimitModal}
          feature="group_switch"
          currentUsage={engagement?.group_switches_used_today || 0}
          limit={1}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Home Button */}
      <div className="mb-4 flex justify-start">
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Home
        </Button>
      </div>
      
      <Card className="text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Find Your Perfect Group</CardTitle>
          {!lifecycleData.loading && (
            <div className="flex justify-center gap-2 mt-2">
              <Badge variant={lifecycleData.matchingMode === 'flexible' ? 'default' : 'secondary'}>
                {lifecycleData.matchingMode === 'flexible' ? 'Quick Match' : 'Curated Match'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {lifecycleData.totalUserCount} users
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {lifecycleData.matchingMode === 'flexible'
                ? "We'll find you an active group to join and start connecting!"
                : "Based on your preferences, we'll match you with like-minded people in a curated group of up to 8 members."
              }
            </p>
            
            <div className="space-y-2">
              <h4 className="font-medium">Your Profile Summary:</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{userProfile?.life_stage ?? 'Life stage not set'}</p>
                <p>{userProfile?.primary_goals?.length || 0} primary goals</p>
                <p>{userProfile?.personality_traits?.length || 0} personality traits</p>
                <p>{userProfile?.interests?.length || 0} interests</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={findOrCreateGroup} 
            disabled={isMatching || lifecycleData.loading}
            size="lg"
            className="w-full"
          >
            {isMatching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finding Your Group...
              </>
            ) : (
              'Find My Group'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};