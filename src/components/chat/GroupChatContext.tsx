import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useChatMessages, type ChatMessage } from '@/hooks/useChatMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { usePinnedMessages } from '@/hooks/usePinnedMessages';
import { useSimpleOnlineStatus } from '@/hooks/useSimpleOnlineStatus';
import { useEngagement } from '@/hooks/useEngagement';
import { useClearedMessages } from '@/hooks/useClearedMessages';
import { useDatabaseGames } from '@/hooks/useDatabaseGames';
import { useGamePreferences } from '@/hooks/useGamePreferences';
import { useSimpleRealtimeChat } from '@/hooks/useSimpleRealtimeChat';
import { usePolls, usePlaylists, useWouldYouRather } from '@/hooks/useOptimizedChatTools';
import { useEnhancedKarma } from '@/hooks/useEnhancedKarma';
import { useKarmaMilestoneToast } from '@/hooks/useKarmaMilestoneToast';
import { useOfflineMessageFlush } from '@/hooks/useOfflineMessageFlush';
import { useDailyPrompts } from '@/hooks/useDailyPrompts';
import { useInputValidation } from '@/hooks/useInputValidation';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useOnboardingAnalytics } from '@/hooks/useOnboardingAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { analyticsClient } from '@/utils/analytics';
import { ActiveGameState, gameTimerManager } from '@/utils/gameTimerManager';
import { THIS_OR_THAT_PROMPTS } from './ThisOrThat';
import { EMOJI_RIDDLES } from './EmojiRiddleGame';
import { WOULD_YOU_RATHER_PROMPTS } from './WouldYouRather';

export interface GroupChatCoreProps {
  groupId: string;
  groupName: string;
  groupVibe: string;
  groupDescription?: string | null;
  memberCount: number;
  maxMembers?: number;
  isFirstSession?: boolean;
}

interface GroupChatContextValue extends GroupChatCoreProps {
  userProfile: { username: string } | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  typingUsers: ReturnType<typeof useTypingIndicator>['typingUsers'];
  pinnedMessages: ReturnType<typeof usePinnedMessages>['pinnedMessages'];
  pinMessage: ReturnType<typeof usePinnedMessages>['pinMessage'];
  unpinMessage: ReturnType<typeof usePinnedMessages>['unpinMessage'];
  onlineCount: number;
  actualMemberCount: number;
  clearedMessageIds: string[];
  isMessageCleared: (id: string) => boolean;
  isGameCleared: (id: string) => boolean;
  activeGame: ActiveGameState | null;
  setActiveGame: (game: ActiveGameState | null) => void;
  activeView: string | null;
  setActiveView: (view: string | null) => void;
  replyDraft: string | undefined;
  setReplyDraft: (draft: string | undefined) => void;
  isLoading: boolean;
  showFirstSessionGuide: boolean;
  todaysPrompt: ReturnType<typeof useDailyPrompts>['getTodaysPrompt'] extends () => infer R ? R : never;
  hasNewPrompt: boolean;
  showParticipationDialog: boolean;
  setShowParticipationDialog: (v: boolean) => void;
  pendingGame: { gameType: string; duration: number } | null;
  preferencesLoading: boolean;
  polls: ReturnType<typeof usePolls>['polls'];
  totPrompts: ReturnType<typeof useDatabaseGames>['thisOrThatGames'];
  riddles: ReturnType<typeof useDatabaseGames>['emojiRiddleGames'];
  truthLieGames: ReturnType<typeof useDatabaseGames>['truthLieGames'];
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  handleSendTextMessage: (content: string, type: 'text') => Promise<boolean>;
  handleSendGif: (gifUrl: string) => Promise<boolean>;
  handleSendVoice: (audioBlob: Blob) => Promise<boolean>;
  handleReaction: (messageId: string, emoji: string) => Promise<void>;
  handleHideMessage: (messageId: string) => Promise<void>;
  handleRespondToPrompt: (promptText: string) => void;
  handleClearChat: () => Promise<void>;
  handleToolSelect: (tool: string) => void;
  handleStartGame: (gameType: ActiveGameState['gameType'], duration?: number) => void;
  handleGameParticipation: (participate: boolean) => void;
  handleExitGame: () => Promise<void>;
  createPoll: ReturnType<typeof usePolls>['createPoll'];
  createPlaylist: ReturnType<typeof usePlaylists>['createPlaylist'];
  addSongToPlaylist: ReturnType<typeof usePlaylists>['addSongToPlaylist'];
  getActivePlaylist: ReturnType<typeof usePlaylists>['getActivePlaylist'];
  createWYRPrompt: ReturnType<typeof useWouldYouRather>['createPrompt'];
  createTruthLieGame: ReturnType<typeof useDatabaseGames>['createTruthLieGame'];
  voteThisOrThat: ReturnType<typeof useDatabaseGames>['voteThisOrThat'];
  submitRiddleGuess: ReturnType<typeof useDatabaseGames>['submitRiddleGuess'];
  submitTruthLieGuess: ReturnType<typeof useDatabaseGames>['submitTruthLieGuess'];
  deleteGameData: ReturnType<typeof useDatabaseGames>['deleteGameData'];
  endGame: ReturnType<typeof useDatabaseGames>['endGame'];
  markIcebreakerReply: () => void;
  focusChatInput: () => void;
  registerChatInputFocus: (fn: () => void) => void;
  setActiveIcebreakerId: (id: string | null) => void;
}

const GroupChatContext = createContext<GroupChatContextValue | null>(null);

export const useGroupChatContext = (): GroupChatContextValue => {
  const ctx = useContext(GroupChatContext);
  if (!ctx) throw new Error('useGroupChatContext must be used within GroupChatProvider');
  return ctx;
};

interface GroupChatProviderProps extends GroupChatCoreProps {
  children: ReactNode;
}

export const GroupChatProvider = ({
  groupId,
  groupName,
  groupVibe,
  groupDescription,
  memberCount,
  maxMembers = 8,
  isFirstSession = false,
  children,
}: GroupChatProviderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { track } = useOnboardingAnalytics();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputFocusRef = useRef<(() => void) | null>(null);
  const icebreakerReplyMarkedRef = useRef(false);
  const activeIcebreakerIdRef = useRef<string | null>(null);
  const messagesLengthRef = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const userScrolledRef = useRef(false);
  const scrollObserverRef = useRef<IntersectionObserver>();

  const { messages, loading: messagesLoading, addMessage, addReaction, removeMessage, refetch } = useChatMessages(groupId);
  const { typingUsers } = useTypingIndicator(groupId, user?.id ?? '');
  const { pinnedMessages, pinMessage, unpinMessage } = usePinnedMessages(groupId);
  const { getOnlineCount } = useSimpleOnlineStatus(groupId);
  const onlineCount = getOnlineCount();
  const [userProfile, setUserProfile] = useState<{ username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [actualMemberCount, setActualMemberCount] = useState(memberCount);
  const [activeGame, setActiveGame] = useState<ActiveGameState | null>(null);
  const [showFirstSessionGuide, setShowFirstSessionGuide] = useState(isFirstSession);
  const [replyDraft, setReplyDraft] = useState<string | undefined>();
  const [showParticipationDialog, setShowParticipationDialog] = useState(false);
  const [pendingGame, setPendingGame] = useState<{ gameType: string; duration: number } | null>(null);

  const { clearedMessageIds, clearMessages, isMessageCleared } = useClearedMessages(groupId);
  const isGameCleared = useCallback(
    (gameId: string) => clearedMessageIds.includes(gameId),
    [clearedMessageIds]
  );

  const { trackActivity } = useEngagement();
  const { trackKarmaActivity, trackEnhancedActivity } = useEnhancedKarma();
  useKarmaMilestoneToast(groupId);

  const removeOptimisticMessage = useCallback(
    (id: string) => {
      removeMessage(id);
    },
    [removeMessage]
  );

  useOfflineMessageFlush(groupId, removeOptimisticMessage);
  const { getTodaysPrompt } = useDailyPrompts(groupId);
  const { validateMessageContent, checkRateLimit, sanitizeInput } = useInputValidation();
  const { trackError, trackUserAction } = usePerformanceMonitor();
  const todaysPrompt = getTodaysPrompt();
  const hasNewPrompt = Boolean(todaysPrompt);

  const { createPoll, polls } = usePolls();
  const { createPlaylist, addSongToPlaylist, getActivePlaylist } = usePlaylists();
  const { createPrompt: createWYRPrompt } = useWouldYouRather();
  const {
    thisOrThatGames: totPrompts,
    emojiRiddleGames: riddles,
    truthLieGames,
    createThisOrThatGame: createTOTPrompt,
    createEmojiRiddleGame: createRiddle,
    createTruthLieGame,
    voteThisOrThat,
    submitRiddleGuess,
    submitTruthLieGuess,
    endGame,
    deleteGameData,
  } = useDatabaseGames(groupId);
  const { preferences: gamePreferences, loading: preferencesLoading } = useGamePreferences();

  const smartScrollToBottom = useCallback((force = false) => {
    if (!scrollAreaRef.current) return;
    const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    if (!force && userScrolledRef.current) return;
    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
  }, []);

  const setupScrollDetection = useCallback(() => {
    if (!scrollAreaRef.current) return;
    const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;
    const lastMessage = scrollContainer.lastElementChild;
    if (lastMessage && !scrollObserverRef.current) {
      scrollObserverRef.current = new IntersectionObserver(
        ([entry]) => { userScrolledRef.current = !entry.isIntersecting; },
        { threshold: 0.8 }
      );
      scrollObserverRef.current.observe(lastMessage);
    }
  }, []);

  useSimpleRealtimeChat({
    groupId,
    onNewMessage: () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        smartScrollToBottom();
        setupScrollDetection();
      }, 100);
    },
    onReactionUpdate: () => { refetch(); },
    onOnlineUsersUpdate: () => {},
  });

  useEffect(() => {
    const currentLength = messages?.length ?? 0;
    if (currentLength > messagesLengthRef.current) {
      messagesLengthRef.current = currentLength;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        smartScrollToBottom();
        setupScrollDetection();
      }, 100);
    }
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [messages?.length, smartScrollToBottom, setupScrollDetection]);

  useEffect(() => () => { scrollObserverRef.current?.disconnect(); }, []);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data } = await supabase.from('profiles').select('username').eq('user_id', user.id).single();
      if (data) setUserProfile(data);
      const { data: members } = await supabase.from('group_members').select('user_id').eq('group_id', groupId);
      if (members) setActualMemberCount(members.length);
    };
    load();
  }, [user?.id, groupId]);

  useEffect(() => {
    analyticsClient.track('group_opened', {
      group_id: groupId,
      member_count: memberCount,
    }, groupId);
  }, [groupId, memberCount]);

  const silentTrackedRef = useRef(false);

  useEffect(() => {
    if (messagesLoading || messages.length === 0 || silentTrackedRef.current) return;
    const last = messages[messages.length - 1];
    const hoursSince = (Date.now() - last.timestamp.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 48) {
      silentTrackedRef.current = true;
      analyticsClient.track('group_silent_threshold_hit', {
        group_id: groupId,
        hours_since_last_message: Math.round(hoursSince),
      }, groupId);
    }
  }, [messagesLoading, messages, groupId]);

  const registerChatInputFocus = useCallback((fn: () => void) => {
    inputFocusRef.current = fn;
  }, []);

  const focusChatInput = useCallback(() => {
    inputFocusRef.current?.();
  }, []);

  const setActiveIcebreakerId = useCallback((id: string | null) => {
    activeIcebreakerIdRef.current = id;
  }, []);

  const markIcebreakerReply = useCallback(() => {
    if (icebreakerReplyMarkedRef.current) return;
    icebreakerReplyMarkedRef.current = true;
    void supabase.rpc('mark_icebreaker_first_reply', { p_group_id: groupId });
    analyticsClient.track('icebreaker_answered', {
      group_id: groupId,
      prompt_id: activeIcebreakerIdRef.current ?? '',
    }, groupId);
  }, [groupId]);

  const clearFirstSession = () => {
    sessionStorage.removeItem('syncchat_first_session');
    setShowFirstSessionGuide(false);
  };

  const handleSendTextMessage = async (content: string, type: 'text') => {
    if (!user || !userProfile) return false;
    const sanitized = sanitizeInput(content);
    const validation = validateMessageContent(sanitized);
    if (!validation.isValid) {
      toast({ title: 'Invalid Message', description: validation.error, variant: 'destructive' });
      return false;
    }
    if (!(await checkRateLimit())) return false;
    setIsLoading(true);
    try {
      const success = await addMessage({ content: sanitized, messageType: type });
      if (success) {
        setReplyDraft(undefined);
        if (showFirstSessionGuide) {
          track('first_message_sent', { metadata: { groupId } });
          clearFirstSession();
        }
        trackEnhancedActivity('message');
        trackUserAction('send_text_message');
        analyticsClient.track('message_sent', {
          group_id: groupId,
          has_gif: false,
          has_voice: false,
          message_length: sanitized.length,
        }, groupId);
        markIcebreakerReply();
        return true;
      }
      return false;
    } catch (error) {
      trackError(error as Error, 'send_text_message');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendGif = async (gifUrl: string) => {
    if (!user || !userProfile) return false;
    setIsLoading(true);
    try {
      const success = await addMessage({ messageType: 'gif', gifUrl });
      if (success) {
        trackActivity('message');
        trackUserAction('send_gif');
        analyticsClient.track('message_sent', {
          group_id: groupId,
          has_gif: true,
          has_voice: false,
          message_length: 0,
        }, groupId);
        markIcebreakerReply();
        return true;
      }
      return false;
    } catch (error) {
      trackError(error as Error, 'send_gif');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVoice = async (audioBlob: Blob) => {
    if (!user || !userProfile) return false;
    setIsLoading(true);
    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      const success = await addMessage({
        messageType: 'voice',
        voiceAudioUrl: audioUrl,
        voiceTranscription: 'Voice message',
      });
      if (success) {
        trackKarmaActivity('voice', 2, 'Sent voice message', 1.0, groupId);
        analyticsClient.track('message_sent', {
          group_id: groupId,
          has_gif: false,
          has_voice: true,
          message_length: 0,
        }, groupId);
        markIcebreakerReply();
        return true;
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const success = await addReaction(messageId, emoji);
    if (success) {
      trackActivity('reaction');
      analyticsClient.track('reaction_added', { group_id: groupId }, groupId);
    }
  };

  const handleHideMessage = async (messageId: string) => {
    await clearMessages([messageId]);
  };

  const handleRespondToPrompt = (promptText: string) => {
    setReplyDraft(`Re: "${promptText}" — `);
  };

  const handleClearChat = async () => {
    const messageIds = messages.map((m) => m.id);
    const success = await clearMessages(messageIds);
    if (success) {
      if (activeGame) {
        await deleteGameData(activeGame.gameType, activeGame.gameId);
        gameTimerManager.endGame();
        setActiveGame(null);
      }
      toast({ title: 'Chat cleared', description: 'All messages and game data have been permanently deleted' });
    } else {
      toast({ title: 'Error', description: 'Failed to clear messages. Please try again.', variant: 'destructive' });
    }
  };

  const handleStartGame = (gameType: ActiveGameState['gameType'], duration?: number) => {
    if (!userProfile || preferencesLoading) {
      if (preferencesLoading) {
        toast({ title: 'Loading...', description: 'Please wait while preferences are loading.', variant: 'destructive' });
      }
      return;
    }
    const gameDuration = duration ?? gamePreferences.gameDuration;
    if (activeGame) {
      toast({ title: 'Game Already Active', description: 'Please wait for the current game to finish.', variant: 'destructive' });
      return;
    }
    setPendingGame({ gameType, duration: gameDuration });
    setShowParticipationDialog(true);
  };

  const handleGameParticipation = (participate: boolean) => {
    if (!pendingGame || !userProfile) return;
    setShowParticipationDialog(false);
    if (!participate) {
      setPendingGame(null);
      toast({ title: 'Game Declined', description: 'You can join the next game when it starts.' });
      return;
    }
    const success = gameTimerManager.startGame(
      pendingGame.gameType as ActiveGameState['gameType'],
      crypto.randomUUID(),
      pendingGame.duration,
      {
        onTimeEnd: async () => {
          if (activeGame) await deleteGameData(activeGame.gameType, activeGame.gameId);
          setActiveGame(null);
          toast({ title: 'Game Ended', description: 'Round completed - game data cleaned up!' });
        },
        onTick: () => {
          const current = gameTimerManager.getActiveGame();
          if (current) setActiveGame({ ...current });
        },
      }
    );
    if (success) {
      const newActiveGame = gameTimerManager.getActiveGame();
      if (newActiveGame) {
        setActiveGame(newActiveGame);
        analyticsClient.track('game_started', { group_id: groupId, game_type: pendingGame.gameType }, groupId);
        switch (pendingGame.gameType) {
          case 'thisorthat': {
            const randomTOT = THIS_OR_THAT_PROMPTS[Math.floor(Math.random() * THIS_OR_THAT_PROMPTS.length)];
            createTOTPrompt(randomTOT.question, randomTOT.options[0]?.text ?? '', randomTOT.options[1]?.text ?? '', pendingGame.duration);
            break;
          }
          case 'emojiriddle': {
            const randomRiddle = EMOJI_RIDDLES[Math.floor(Math.random() * EMOJI_RIDDLES.length)];
            createRiddle(randomRiddle.emojis, randomRiddle.answer, randomRiddle.hint, randomRiddle.funFact, pendingGame.duration);
            break;
          }
          case 'twoTruths': {
            const statements = ['I have traveled to 5 different countries', 'I can speak 3 languages fluently', 'I have never been on a roller coaster'];
            createTruthLieGame(statements, Math.floor(Math.random() * 3) + 1, pendingGame.duration);
            break;
          }
        }
        trackActivity('tool');
        toast({ title: 'Game Started', description: `${pendingGame.gameType} round is now active!` });
      }
    }
    setPendingGame(null);
  };

  const handleExitGame = async () => {
    gameTimerManager.endGame();
    if (activeGame && user?.id) {
      await supabase.from('user_cleared_messages').insert({
        user_id: user.id,
        group_id: groupId,
        message_id: activeGame.gameId,
        cleared_at: new Date().toISOString(),
      });
      await endGame(activeGame.gameType, activeGame.gameId);
      analyticsClient.track('game_completed', { group_id: groupId, game_type: activeGame.gameType }, groupId);
    }
    setActiveGame(null);
    toast({ title: 'Left Game', description: "You've left the current game session." });
  };

  const handleToolSelect = (tool: string) => {
    if (!userProfile) return;
    trackActivity('tool');
    switch (tool) {
      case 'poll':
        setActiveView('create-poll');
        break;
      case 'playlist':
        setActiveView(getActivePlaylist() ? 'playlist' : 'create-playlist');
        break;
      case 'addsong':
        if (getActivePlaylist()) setActiveView('playlist');
        else toast({ title: 'No Active Playlist', description: 'Create a playlist first', variant: 'destructive' });
        break;
      case 'wouldyourather': {
        const randomWYR = WOULD_YOU_RATHER_PROMPTS[Math.floor(Math.random() * WOULD_YOU_RATHER_PROMPTS.length)];
        createWYRPrompt(randomWYR.question, randomWYR.options);
        break;
      }
      case 'truthslie':
        setActiveView('create-truthlie');
        break;
      case 'start-thisorthat':
        handleStartGame('thisorthat');
        break;
      case 'start-emojiriddle':
        handleStartGame('emojiriddle');
        break;
      case 'start-truthslie':
        handleStartGame('twoTruths');
        break;
      case 'game':
        setActiveView('game-picker');
        break;
    }
  };

  const value: GroupChatContextValue = {
    groupId,
    groupName,
    groupVibe,
    groupDescription,
    memberCount,
    maxMembers,
    isFirstSession,
    userProfile,
    messages,
    messagesLoading,
    typingUsers,
    pinnedMessages,
    pinMessage,
    unpinMessage,
    onlineCount,
    actualMemberCount,
    clearedMessageIds,
    isMessageCleared,
    isGameCleared,
    activeGame,
    setActiveGame,
    activeView,
    setActiveView,
    replyDraft,
    setReplyDraft,
    isLoading,
    showFirstSessionGuide,
    todaysPrompt,
    hasNewPrompt,
    showParticipationDialog,
    setShowParticipationDialog,
    pendingGame,
    preferencesLoading,
    polls,
    totPrompts,
    riddles,
    truthLieGames,
    scrollAreaRef,
    handleSendTextMessage,
    handleSendGif,
    handleSendVoice,
    handleReaction,
    handleHideMessage,
    handleRespondToPrompt,
    handleClearChat,
    handleToolSelect,
    handleStartGame,
    handleGameParticipation,
    handleExitGame,
    createPoll,
    createPlaylist,
    addSongToPlaylist,
    getActivePlaylist,
    createWYRPrompt,
    createTruthLieGame,
    voteThisOrThat,
    submitRiddleGuess,
    submitTruthLieGuess,
    deleteGameData,
    endGame,
    trackActivity,
    markIcebreakerReply,
    focusChatInput,
    registerChatInputFocus,
    setActiveIcebreakerId,
  };

  return <GroupChatContext.Provider value={value}>{children}</GroupChatContext.Provider>;
};
