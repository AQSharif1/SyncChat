import { useState, useEffect, useCallback, useRef } from 'react';
import { GroupChatProvider, useGroupChatContext } from './GroupChatContext';
import { ChatHeader } from './ChatHeader';
import { ChatLifecycleBanner } from './ChatLifecycleBanner';
import { SeasonVoteScreen, shouldAutoOpenSeasonVote } from '@/components/group/SeasonVoteScreen';
import { useGroupLifecycle } from '@/hooks/useGroupLifecycle';
import { ChatMessageList } from './ChatMessageList';
import { ChatInputBar } from './ChatInputBar';
import { ChatToolbar } from './ChatToolbar';
import { ChatEngagementPanel } from './ChatEngagementPanel';
import { ChatDMPanel } from './ChatDMPanel';
import { ChatVoiceRoom } from './voice/ChatVoiceRoom';
import { VoiceJoinNudge } from './VoiceJoinNudge';
import { GroupSwitchDialog } from './GroupSwitchDialog';
import { GameParticipationDialog } from './GameParticipationDialog';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { GroupPersonalityCard } from '@/components/group/GroupPersonalityCard';
import { SeasonMemoriesSection } from '@/components/group/SeasonMemoriesSection';
import { GroupInvitePanel } from '@/components/sharing/GroupInvitePanel';
import { KarmaDashboard } from '@/components/karma/KarmaDashboard';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRoom } from '@/contexts/VoiceRoomContext';

interface GroupChatProps {
  groupId: string;
  groupName: string;
  groupVibe: string;
  groupDescription?: string | null;
  memberCount: number;
  maxMembers?: number;
  isFirstSession?: boolean;
  onBack: () => void;
  onGoHome?: () => void;
  onViewPremium?: () => void;
}

const ACTIVITIES_KEY = 'syncchat_activities_open';

const GroupChatLayout = ({
  onBack,
  onGoHome,
  onViewPremium,
}: Pick<GroupChatProps, 'onBack' | 'onGoHome' | 'onViewPremium'>) => {
  const { user } = useAuth();
  const {
    groupId,
    groupName,
    hasNewPrompt,
    showParticipationDialog,
    setShowParticipationDialog,
    pendingGame,
    userProfile,
    handleGameParticipation,
  } = useGroupChatContext();

  const [viewMode, setViewMode] = useState<'chat' | 'dm'>('chat');
  const [showActivities, setShowActivities] = useState(false);
  const [showVoiceExpanded, setShowVoiceExpanded] = useState(false);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [showGroupInsights, setShowGroupInsights] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showEngagementDashboard, setShowEngagementDashboard] = useState(false);
  const [voteScreenOpen, setVoteScreenOpen] = useState(false);
  const [showKarmaDashboard, setShowKarmaDashboard] = useState(false);
  const [showVoiceNudge, setShowVoiceNudge] = useState(false);
  const [nudgeParticipantName, setNudgeParticipantName] = useState('');
  const voiceNudgeShownThisSessionRef = useRef(false);

  const { lifecycleData } = useGroupLifecycle(groupId);
  const { isConnected, participantCount, participants, joinVoiceRoom, watchVoicePresence, unwatchVoicePresence } = useVoiceRoom();

  useEffect(() => {
    if (!isConnected) {
      watchVoicePresence(groupId);
    }
    return () => unwatchVoicePresence();
  }, [groupId, isConnected, watchVoicePresence, unwatchVoicePresence]);

  useEffect(() => {
    if (
      participantCount > 0 &&
      !isConnected &&
      !voiceNudgeShownThisSessionRef.current
    ) {
      const firstName = participants[0]?.name?.split(' ')[0] ?? 'Someone';
      setNudgeParticipantName(firstName);
      setShowVoiceNudge(true);
      voiceNudgeShownThisSessionRef.current = true;
    }

    if (participantCount === 0) {
      voiceNudgeShownThisSessionRef.current = false;
    }
  }, [participantCount, isConnected, participants]);

  useEffect(() => {
    if (!lifecycleData?.continuationActive || lifecycleData.userChoice) return;
    if (!shouldAutoOpenSeasonVote(groupId)) return;

    const timer = setTimeout(() => {
      setVoteScreenOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [groupId, lifecycleData?.continuationActive, lifecycleData?.userChoice]);

  useEffect(() => {
    if (!user?.id) return;
    const stored = localStorage.getItem(`${ACTIVITIES_KEY}_${user.id}`);
    if (stored === 'true') setShowActivities(true);
  }, [user?.id]);

  const toggleActivities = useCallback(() => {
    setShowActivities((prev) => {
      const next = !prev;
      if (user?.id) localStorage.setItem(`${ACTIVITIES_KEY}_${user.id}`, String(next));
      if (next && hasNewPrompt) setShowEngagementDashboard(true);
      return next;
    });
  }, [user?.id, hasNewPrompt]);

  if (viewMode === 'dm') {
    return (
      <ChatDMPanel
        groupId={groupId}
        onBack={() => setViewMode('chat')}
        onUpgrade={onViewPremium}
      />
    );
  }

  return (
    <>
      <ChatVoiceRoom
        groupId={groupId}
        groupName={groupName}
        expanded={showVoiceExpanded}
        onExpandedChange={setShowVoiceExpanded}
      />

      <div className="flex flex-col min-h-[100dvh] max-w-6xl mx-auto bg-background">
        <ChatHeader
          onBack={onBack}
          onGoHome={onGoHome}
          onOpenDM={() => setViewMode('dm')}
          onToggleActivities={toggleActivities}
          onToggleVoice={() => setShowVoiceExpanded((v) => !v)}
          onOpenKarmaDashboard={() => setShowKarmaDashboard(true)}
          showActivities={showActivities}
          hasNewPrompt={hasNewPrompt}
          onShowGroupInsights={() => setShowGroupInsights(true)}
          onShowSwitchDialog={() => setShowSwitchDialog(true)}
        />

        <ChatLifecycleBanner
          groupId={groupId}
          onOpenVoteScreen={() => setVoteScreenOpen(true)}
        />
        <SeasonVoteScreen
          groupId={groupId}
          groupName={groupName}
          open={voteScreenOpen}
          onOpenChange={setVoteScreenOpen}
        />
        <ChatToolbar visible={showActivities} />
        <ChatEngagementPanel
          visible={showActivities}
          showDashboard={showEngagementDashboard}
          onCloseDashboard={() => setShowEngagementDashboard(false)}
        />
        <ChatMessageList />
        {showVoiceNudge && !isConnected && (
          <VoiceJoinNudge
            groupId={groupId}
            participantCount={participantCount}
            firstParticipantName={nudgeParticipantName}
            onJoin={async () => {
              setShowVoiceNudge(false);
              await joinVoiceRoom(groupId, groupName);
              setShowVoiceExpanded(true);
            }}
            onDismiss={() => setShowVoiceNudge(false)}
          />
        )}
        <ChatInputBar />
      </div>

      <ResponsiveModal open={showGroupInsights} onOpenChange={setShowGroupInsights} title="Group Insights" className="max-w-lg">
        <div className="space-y-4">
          <GroupPersonalityCard groupId={groupId} />
          <SeasonMemoriesSection groupId={groupId} groupName={groupName} />
        </div>
      </ResponsiveModal>

      <Sheet open={showKarmaDashboard} onOpenChange={setShowKarmaDashboard}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto safe-area-inset-bottom">
          <SheetHeader>
            <SheetTitle>Your Karma</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <KarmaDashboard />
          </div>
        </SheetContent>
      </Sheet>

      {showInvitePanel && (
        <GroupInvitePanel groupId={groupId} groupName={groupName} onClose={() => setShowInvitePanel(false)} />
      )}

      <GroupSwitchDialog
        isOpen={showSwitchDialog}
        onClose={() => setShowSwitchDialog(false)}
        groupId={groupId}
        groupName={groupName}
        onUpgrade={onViewPremium}
        onSwitchSuccess={() => onGoHome?.()}
      />

      {showParticipationDialog && pendingGame && (
        <GameParticipationDialog
          isOpen={showParticipationDialog}
          onClose={() => setShowParticipationDialog(false)}
          onParticipate={() => handleGameParticipation(true)}
          onDecline={() => handleGameParticipation(false)}
          gameType={pendingGame.gameType}
          gameDuration={pendingGame.duration}
          creatorUsername={userProfile?.username ?? 'Anonymous'}
        />
      )}
    </>
  );
};

export const GroupChat = (props: GroupChatProps) => (
  <GroupChatProvider
    groupId={props.groupId}
    groupName={props.groupName}
    groupVibe={props.groupVibe}
    groupDescription={props.groupDescription}
    memberCount={props.memberCount}
    maxMembers={props.maxMembers}
    isFirstSession={props.isFirstSession}
  >
    <GroupChatLayout onBack={props.onBack} onGoHome={props.onGoHome} onViewPremium={props.onViewPremium} />
  </GroupChatProvider>
);
