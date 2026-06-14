import { EngagementDashboard } from '@/components/engagement/EngagementDashboard';
import { DailyPromptCard } from '@/components/engagement/DailyPromptCard';
import { useGroupChatContext } from './GroupChatContext';
import { analyticsClient } from '@/utils/analytics';

interface ChatEngagementPanelProps {
  visible: boolean;
  showDashboard: boolean;
  onCloseDashboard: () => void;
}

export const ChatEngagementPanel = ({
  visible,
  showDashboard,
  onCloseDashboard,
}: ChatEngagementPanelProps) => {
  const { groupId, todaysPrompt, handleRespondToPrompt } = useGroupChatContext();

  if (!visible) return null;

  return (
    <>
      {showDashboard && <EngagementDashboard onClose={onCloseDashboard} />}
      {todaysPrompt && (
        <div className="px-3 sm:px-4 py-2 border-b">
          <DailyPromptCard
            prompt={todaysPrompt}
            onRespond={(text) => {
              analyticsClient.track('daily_prompt_viewed', {
                group_id: groupId,
                prompt_id: todaysPrompt.id,
              }, groupId);
              handleRespondToPrompt(text);
              analyticsClient.track('daily_prompt_responded', {
                group_id: groupId,
                prompt_id: todaysPrompt.id,
              }, groupId);
            }}
          />
        </div>
      )}
    </>
  );
};
