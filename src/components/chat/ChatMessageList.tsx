import { useState, useEffect, useRef, type RefObject } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PinnedMessagesPanel } from './PinnedMessagesPanel';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ActiveGameDisplay } from './ActiveGameDisplay';
import { TruthLieGame } from './TruthLieGame';
import { ThisOrThat } from './ThisOrThat';
import { EmojiRiddleGame } from './EmojiRiddleGame';
import { FirstMessageGuide } from './FirstMessageGuide';
import { GroupReEntryCard } from './GroupReEntryCard';
import { DailyPromptCard } from '@/components/engagement/DailyPromptCard';
import { ChatIcebreaker } from './ChatIcebreaker';
import { useGroupChatContext } from './GroupChatContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessage } from '@/hooks/useChatMessages';

function useVirtualMessages(
  messages: ChatMessage[],
  containerRef: RefObject<HTMLDivElement>
): {
  visibleMessages: ChatMessage[];
  hasOlderMessages: boolean;
  topSentinelRef: RefObject<HTMLDivElement>;
  bottomSentinelRef: RefObject<HTMLDivElement>;
} {
  const [range, setRange] = useState({ start: 0, end: 40 });
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRange({ start: 0, end: 40 });
  }, [messages[0]?.id]);

  useEffect(() => {
    const scrollEl = containerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    );
    if (!scrollEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (entry.target === topSentinelRef.current) {
            setRange((prev) => ({
              ...prev,
              start: Math.max(0, prev.start - 20),
            }));
          }
          if (entry.target === bottomSentinelRef.current) {
            setRange((prev) => ({
              ...prev,
              end: Math.min(messages.length, prev.end + 20),
            }));
          }
        });
      },
      { root: scrollEl, rootMargin: '200px', threshold: 0 }
    );

    if (topSentinelRef.current) observer.observe(topSentinelRef.current);
    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current);
    return () => observer.disconnect();
  }, [containerRef, messages.length, range.start, range.end]);

  useEffect(() => {
    setRange((prev) => ({
      ...prev,
      end: Math.max(prev.end, messages.length),
    }));
  }, [messages.length]);

  return {
    visibleMessages: messages.slice(range.start, range.end),
    hasOlderMessages: range.start > 0,
    topSentinelRef,
    bottomSentinelRef,
  };
}

export const ChatMessageList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    groupId,
    groupName,
    messages,
    messagesLoading,
    typingUsers,
    pinnedMessages,
    pinMessage,
    unpinMessage,
    isMessageCleared,
    isGameCleared,
    activeGame,
    handleExitGame,
    userProfile,
    scrollAreaRef,
    handleReaction,
    handleHideMessage,
    handleRespondToPrompt,
    showFirstSessionGuide,
    todaysPrompt,
    setReplyDraft,
    totPrompts,
    riddles,
    truthLieGames,
    voteThisOrThat,
    submitRiddleGuess,
    submitTruthLieGuess,
    trackActivity,
  } = useGroupChatContext();

  const {
    visibleMessages,
    hasOlderMessages,
    topSentinelRef,
    bottomSentinelRef,
  } = useVirtualMessages(messages, scrollAreaRef);

  return (
    <>
      <PinnedMessagesPanel pinnedMessages={pinnedMessages} onUnpin={unpinMessage} />

      <ScrollArea ref={scrollAreaRef} className="flex-1 px-1 py-4 min-h-0 bg-chat-surface">
        <div className="space-y-1">
          <ChatIcebreaker messageCount={messages.length} />

          {messagesLoading ? (
            <div className="text-center py-20">
              <LoadingSpinner size="lg" text="Loading messages..." />
            </div>
          ) : messages.length === 0 ? (
            <div className="space-y-6">
              {todaysPrompt && (
                <DailyPromptCard prompt={todaysPrompt} onRespond={handleRespondToPrompt} />
              )}
              {showFirstSessionGuide ? (
                <FirstMessageGuide
                  groupName={groupName}
                  onQuickAction={(text) => setReplyDraft(text)}
                  hasDailyPrompt={!!todaysPrompt}
                  onAnswerPrompt={
                    todaysPrompt ? () => handleRespondToPrompt(todaysPrompt.prompt_text) : undefined
                  }
                />
              ) : (
                <div className="text-center py-10 sm:py-20 text-muted-foreground">
                  <div className="max-w-md mx-auto space-y-4">
                    <h3 className="text-lg sm:text-xl font-medium text-foreground">Ready to connect?</h3>
                    <p className="text-sm leading-relaxed px-4">
                      Start the conversation! Share what&apos;s on your mind, ask a question, or just say hello.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {todaysPrompt &&
                !messages.some((m) => m.messageType === 'ai_host' && m.content === todaysPrompt.prompt_text) && (
                  <DailyPromptCard prompt={todaysPrompt} onRespond={handleRespondToPrompt} />
                )}
              <div className="relative">
                <div ref={topSentinelRef} className="h-1" />
                {hasOlderMessages && (
                  <p className="text-xs text-center text-muted-foreground py-2 opacity-60">
                    Scroll up to see older messages
                  </p>
                )}
                {visibleMessages
                  .filter((message) => !isMessageCleared(message.id))
                  .map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onReact={handleReaction}
                      onPin={pinMessage}
                      onHideMessage={handleHideMessage}
                      onRespondToPrompt={handleRespondToPrompt}
                      currentUserId={user?.id}
                      groupId={groupId}
                    />
                  ))}
                <div ref={bottomSentinelRef} className="h-1" />
              </div>
            </>
          )}

          {activeGame && (
            <ActiveGameDisplay
              game={activeGame}
              onExit={handleExitGame}
              currentUserId={user?.id ?? ''}
              currentUsername={userProfile?.username ?? 'Anonymous'}
            />
          )}

          {(totPrompts.length > 0 || riddles.length > 0 || truthLieGames.length > 0) && (
            <div className="space-y-4 mt-6 pt-4 border-t">
              {truthLieGames
                .filter((game) => !isGameCleared(game.id))
                .map((game) => {
                  const guesses = (game.truth_lie_guesses ?? []).map((guess) => ({
                    userId: guess.user_id,
                    username: 'Anonymous',
                    guessedLieNumber: guess.guessed_lie_number,
                    isCorrect: guess.is_correct,
                    timestamp: new Date(guess.created_at),
                  }));
                  return (
                    <TruthLieGame
                      key={game.id}
                      game={{
                        id: game.id,
                        createdBy: game.created_by,
                        createdByUsername: 'Anonymous',
                        statements: [
                          { id: '1', text: game.statement_1, isLie: game.lie_statement_number === 1 },
                          { id: '2', text: game.statement_2, isLie: game.lie_statement_number === 2 },
                          { id: '3', text: game.statement_3, isLie: game.lie_statement_number === 3 },
                        ],
                        guesses,
                        isActive: game.is_active,
                        expiresAt: new Date(game.expires_at),
                      }}
                      currentUserId={user?.id ?? ''}
                      currentUsername={userProfile?.username ?? 'Anonymous'}
                      onGuess={async (gameId, statementId) => {
                        if (!user?.id) return;
                        const success = await submitTruthLieGuess(gameId, parseInt(statementId, 10));
                        if (success) {
                          trackActivity('game_participation');
                          toast({ title: 'Guess submitted!', description: 'Your guess has been recorded.' });
                        }
                      }}
                    />
                  );
                })}

              {totPrompts
                .filter((prompt) => !isGameCleared(prompt.id))
                .map((prompt) => {
                  const votes = prompt.this_or_that_votes ?? [];
                  const optionAVotes = votes.filter((v) => v.choice === 'A');
                  const optionBVotes = votes.filter((v) => v.choice === 'B');
                  return (
                    <ThisOrThat
                      key={prompt.id}
                      prompt={{
                        id: prompt.id,
                        question: prompt.question,
                        options: [
                          { id: 'A', text: prompt.option_a, emoji: '🍕', votes: optionAVotes.length, voters: optionAVotes.map((v) => v.user_id) },
                          { id: 'B', text: prompt.option_b, emoji: '🍔', votes: optionBVotes.length, voters: optionBVotes.map((v) => v.user_id) },
                        ],
                        createdAt: new Date(prompt.created_at),
                        expiresAt: new Date(prompt.expires_at),
                        isActive: prompt.is_active,
                      }}
                      currentUserId={user?.id ?? ''}
                      onVote={async (promptId, optionId) => {
                        if (!user?.id) return;
                        const success = await voteThisOrThat(promptId, optionId);
                        if (success) {
                          trackActivity('tool');
                          toast({ title: 'Vote submitted!', description: 'Your choice has been recorded.' });
                        }
                      }}
                    />
                  );
                })}

              {riddles
                .filter((riddle) => !isGameCleared(riddle.id))
                .map((riddle) => {
                  const processedGuesses = (riddle.emoji_riddle_guesses ?? []).map((guess) => ({
                    userId: guess.user_id,
                    username: 'Anonymous',
                    guess: guess.guess,
                    timestamp: new Date(guess.created_at),
                    isCorrect: guess.guess.toLowerCase().trim() === riddle.answer.toLowerCase().trim(),
                  }));
                  return (
                    <EmojiRiddleGame
                      key={riddle.id}
                      riddle={{
                        id: riddle.id,
                        emojis: riddle.emojis,
                        answer: riddle.answer,
                        hint: riddle.hint ?? '',
                        funFact: riddle.fun_fact ?? '',
                        guesses: processedGuesses,
                        solvedBy: processedGuesses.find((g) => g.isCorrect)?.username,
                        solvedAt: processedGuesses.find((g) => g.isCorrect)?.timestamp,
                        createdAt: new Date(riddle.created_at),
                        expiresAt: new Date(riddle.expires_at),
                        isActive: riddle.is_active,
                      }}
                      currentUserId={user?.id ?? ''}
                      currentUsername={userProfile?.username ?? 'Anonymous'}
                      onGuess={async (riddleId, guess) => {
                        if (!user?.id) return;
                        const success = await submitRiddleGuess(riddleId, guess);
                        if (success) {
                          trackActivity('tool');
                          toast({ title: 'Guess submitted!', description: 'Your guess has been recorded.' });
                        }
                      }}
                    />
                  );
                })}
            </div>
          )}

          <GroupReEntryCard />
        </div>
      </ScrollArea>

      <TypingIndicator typingUsers={typingUsers} />
    </>
  );
};
