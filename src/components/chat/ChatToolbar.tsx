import { ArrowRight } from 'lucide-react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { GameQuickPicker } from './GameQuickPicker';
import { CreatePoll } from './ChatPoll';
import { CreatePlaylist, PlaylistBuilder } from './PlaylistBuilder';
import { CreateTruthLie } from './TruthLieGame';
import { useGroupChatContext } from './GroupChatContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { analyticsClient } from '@/utils/analytics';
import type { ActiveGameState } from '@/utils/gameTimerManager';

interface ChatToolbarProps {
  visible: boolean;
}

export const ChatToolbar = ({ visible }: ChatToolbarProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    groupId,
    activeView,
    setActiveView,
    userProfile,
    handleToolSelect,
    handleStartGame,
    createPoll,
    createPlaylist,
    addSongToPlaylist,
    getActivePlaylist,
    createTruthLieGame,
    todaysPrompt,
    handleRespondToPrompt,
  } = useGroupChatContext();

  if (!visible) return null;

  const renderActiveView = () => {
    if (!userProfile) return null;

    switch (activeView) {
      case 'create-poll':
        return (
          <CreatePoll
            onCreatePoll={(question, options) => {
              createPoll(question, options, userProfile.username);
              setActiveView(null);
              analyticsClient.track('poll_created', { group_id: groupId }, groupId);
              toast({ title: 'Poll Created', description: 'Your poll is now live in the chat!' });
            }}
            onCancel={() => setActiveView(null)}
          />
        );
      case 'create-playlist':
        return (
          <CreatePlaylist
            onCreatePlaylist={(name) => {
              createPlaylist(name);
              setActiveView('playlist');
              toast({ title: 'Playlist Created', description: `${name} is ready for songs!` });
            }}
            onCancel={() => setActiveView(null)}
          />
        );
      case 'playlist': {
        const activePlaylist = getActivePlaylist();
        if (!activePlaylist) return null;
        return (
          <PlaylistBuilder
            playlist={activePlaylist}
            currentUserId={user?.id ?? ''}
            onAddSong={(songQuery) => {
              addSongToPlaylist(activePlaylist.id, songQuery, userProfile.username);
              toast({ title: 'Song Added', description: 'Added to the collaborative playlist!' });
            }}
          />
        );
      }
      case 'create-truthlie':
        return (
          <CreateTruthLie
            onCreateGame={(statements) => {
              createTruthLieGame(statements, 1);
              setActiveView(null);
              toast({ title: 'Game Started', description: 'Two Truths and a Lie is now active!' });
            }}
            onCancel={() => setActiveView(null)}
          />
        );
      case 'game-picker':
        return (
          <GameQuickPicker
            onGameSelect={(gameType, duration) => {
              setActiveView(null);
              handleStartGame(gameType as ActiveGameState['gameType'], duration);
            }}
            disabled={false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ResponsiveModal
        open={!!activeView && activeView !== 'game-picker'}
        onOpenChange={(open) => !open && setActiveView(null)}
        title="Chat Tools"
        className="max-w-2xl"
      >
        {renderActiveView()}
      </ResponsiveModal>

      {activeView === 'game-picker' && (
        <div className="border-t border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-foreground">Select a Game</h3>
            <button type="button" onClick={() => setActiveView(null)} className="text-muted-foreground hover:text-foreground text-lg">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { key: 'start-truthslie', title: 'Two Truths & a Lie', emoji: '🎯', color: 'blue' },
              { key: 'start-thisorthat', title: 'This or That', emoji: '⚖️', color: 'green' },
              { key: 'start-emojiriddle', title: 'Emoji Riddle', emoji: '🧩', color: 'purple' },
            ].map((game) => (
              <button
                key={game.key}
                type="button"
                onClick={() => {
                  setActiveView(null);
                  handleToolSelect(game.key);
                }}
                className="p-4 text-left rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span>{game.emoji}</span>
                  <h4 className="font-medium text-foreground">{game.title}</h4>
                </div>
                <div className="flex items-center text-xs text-primary">
                  <span>Start Game</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {todaysPrompt && (
        <div className="px-4 py-2 border-b bg-muted/10">
          <button
            type="button"
            className="text-sm text-primary hover:underline"
            onClick={() => {
              analyticsClient.track('daily_prompt_viewed', {
                group_id: groupId,
                prompt_id: todaysPrompt.id,
              }, groupId);
              handleRespondToPrompt(todaysPrompt.prompt_text);
              analyticsClient.track('daily_prompt_responded', {
                group_id: groupId,
                prompt_id: todaysPrompt.id,
              }, groupId);
            }}
          >
            Answer today&apos;s prompt: {todaysPrompt.prompt_text.slice(0, 60)}…
          </button>
        </div>
      )}
    </>
  );
};
