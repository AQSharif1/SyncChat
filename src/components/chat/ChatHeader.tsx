import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Users,
  ArrowLeft,
  Home,
  Eraser,
  MessageCircle,
  MoreVertical,
  Settings,
  RefreshCw,
  Lightbulb,
  Share2,
  Sparkles,
  Headphones,
} from 'lucide-react';
import { GroupMembersList } from './GroupMembersList';
import { useGroupChatContext } from './GroupChatContext';
import { useVoiceRoom } from '@/contexts/VoiceRoomContext';
import { useEnhancedKarma } from '@/hooks/useEnhancedKarma';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  onBack: () => void;
  onGoHome?: () => void;
  onOpenDM: () => void;
  onToggleActivities: () => void;
  onToggleVoice: () => void;
  onOpenKarmaDashboard: () => void;
  showActivities: boolean;
  hasNewPrompt: boolean;
  onShowGroupInsights: () => void;
  onShowSwitchDialog: () => void;
}

export const ChatHeader = ({
  onBack,
  onGoHome,
  onOpenDM,
  onToggleActivities,
  onToggleVoice,
  onOpenKarmaDashboard,
  showActivities,
  hasNewPrompt,
  onShowGroupInsights,
  onShowSwitchDialog,
}: ChatHeaderProps) => {
  const {
    groupId,
    groupName,
    groupVibe,
    groupDescription,
    memberCount,
    maxMembers,
    onlineCount,
    actualMemberCount,
    handleClearChat,
  } = useGroupChatContext();

  const { isConnected, participantCount } = useVoiceRoom();
  const voiceActive = isConnected || participantCount > 0;
  const { karmaProgress, loading: karmaLoading } = useEnhancedKarma();

  const handleRefresh = () => window.location.reload();

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background/95 backdrop-blur-md sticky top-0 z-10 min-h-[56px]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-primary/12 flex items-center justify-center flex-shrink-0 border border-primary/20">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-base truncate text-foreground tracking-tight">{groupName}</h2>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground">{groupVibe}</span>
              <span className="text-xs text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground">{memberCount}/{maxMembers}</span>
              {onlineCount > 0 && (
                <>
                  <span className="text-xs text-muted-foreground/50">·</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    {onlineCount} online
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Button
            variant={voiceActive ? 'default' : 'ghost'}
            size="sm"
            onClick={onToggleVoice}
            className={cn(
              'h-9 px-2 gap-1 relative',
              voiceActive && 'bg-green-500 hover:bg-green-600 text-white'
            )}
            title={
              voiceActive
                ? `${participantCount} in voice — join them`
                : 'Start voice room'
            }
          >
            <Headphones className="w-3.5 h-3.5" />
            {voiceActive && participantCount > 0 && (
              <span className="text-xs font-medium">{participantCount}</span>
            )}
            {voiceActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </Button>

          {!karmaLoading && karmaProgress && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenKarmaDashboard}
              className="h-9 px-2 text-xs gap-1"
              title={`${karmaProgress.currentLevel.level} — tap to view karma`}
            >
              <span>{karmaProgress.currentLevel.icon}</span>
              <span className="hidden sm:inline text-muted-foreground">
                {karmaProgress.currentLevel.level}
              </span>
            </Button>
          )}

          <Button
            variant={showActivities ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onToggleActivities}
            className="h-9 px-2 text-xs gap-1 relative"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Activities</span>
            {hasNewPrompt && !showActivities && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
            )}
          </Button>

          <GroupMembersList groupId={groupId} memberCount={actualMemberCount} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full hover:bg-muted/50" title="More options">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGoHome}>
                <Home className="w-4 h-4 mr-2" /> Go to Home
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenDM}>
                <MessageCircle className="w-4 h-4 mr-2" /> Direct Messages
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShowGroupInsights}>
                <Lightbulb className="w-4 h-4 mr-2" /> Group Insights
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleClearChat}>
                <Eraser className="w-4 h-4 mr-2" /> Clear Chat
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="w-4 h-4 mr-2" /> Group Settings
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share2 className="w-4 h-4 mr-2" /> Share Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={onShowSwitchDialog}
            className="h-9 px-2 sm:px-3 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </div>
      </div>

      {groupDescription && (
        <p className="px-4 py-2 text-xs sm:text-sm text-muted-foreground border-b bg-muted/20 line-clamp-2">
          {groupDescription}
        </p>
      )}
    </>
  );
};
