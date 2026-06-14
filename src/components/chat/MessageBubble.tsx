import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, Pin, MoreHorizontal, EyeOff, Sparkles, MessageCircle } from 'lucide-react';
import { AI_HOST_USER_ID } from '@/hooks/useChatMessages';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useAuth } from '@/hooks/useAuth';
import { useUserMood } from '@/hooks/useUserMood';
import { useSimpleOnlineStatus } from '@/hooks/useSimpleOnlineStatus';
import { MessageModerationMenu } from './MessageModerationMenu';
import { cn } from '@/lib/utils';

import { supabase } from '@/integrations/supabase/client';

interface MessageBubbleProps {
  message: ChatMessage;
  chatType?: 'group' | 'private';
  onReaction?: (messageId: string, emoji: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onPin?: (messageId: string, content: string, username: string, messageType: 'text' | 'gif' | 'voice' | 'ai_host', gifUrl?: string, voiceAudioUrl?: string) => void;
  onHideMessage?: (messageId: string) => void;
  onRespondToPrompt?: (promptText: string) => void;
  currentUserId?: string;
  groupId?: string;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export const MessageBubble = ({
  message,
  chatType = 'group',
  onReaction,
  onReact,
  onPin,
  onHideMessage,
  onRespondToPrompt,
  currentUserId,
  groupId,
}: MessageBubbleProps) => {
  const handleReaction = onReaction || onReact;
  const { user } = useAuth();
  const { getUserDisplayName } = useUserMood();
  const { getUserOnlineStatus } = useSimpleOnlineStatus(groupId || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [displayName, setDisplayName] = useState(message.username);
  const [isHidden, setIsHidden] = useState(false);
  const isAiHost = message.messageType === 'ai_host' || message.userId === AI_HOST_USER_ID;
  const isOwnMessage = !isAiHost && user?.id === message.userId;
  const userOnlineStatus = getUserOnlineStatus(message.userId);

  useEffect(() => {
    const loadDisplayName = async () => {
      if (message.userId && !isAiHost) {
        const name = await getUserDisplayName(message.username, message.userId);
        setDisplayName(name);
      }
    };
    loadDisplayName();
  }, [message.id, message.username, message.userId, getUserDisplayName, isAiHost]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handlePlayVoice = () => {
    if (!message.voiceAudioUrl) return;
    if (isPlaying && audioElement) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      let audio = audioElement;
      if (!audio) {
        audio = new Audio(message.voiceAudioUrl);
        setAudioElement(audio);
        audio.onended = () => { setIsPlaying(false); setAudioElement(null); };
        audio.onerror = () => { setIsPlaying(false); setAudioElement(null); };
      }
      audio.play().then(() => setIsPlaying(true)).catch(() => {
        setIsPlaying(false);
        setAudioElement(null);
      });
    }
  };

  const handlePinMessage = () => {
    onPin?.(message.id, message.content || '', message.username, message.messageType, message.gifUrl, message.voiceAudioUrl);
  };

  const handleHideMessage = () => {
    setIsHidden(true);
    onHideMessage?.(message.id);
  };

  const renderTextWithMentions = (text: string) => {
    if (!currentUserId || !text) return <span>{text}</span>;
    const mentionRegex = /@(\w+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
      parts.push(
        <span key={match.index} className="text-primary font-medium">
          {match[0]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) parts.push(text.substring(lastIndex));
    return <>{parts}</>;
  };

  const renderMessageContent = () => {
    switch (message.messageType) {
      case 'ai_host':
        return (
          <div className="space-y-3">
            <p className="text-[15px] leading-relaxed text-foreground">
              {message.content}
            </p>
            {onRespondToPrompt && message.content && (
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs"
                onClick={(e) => { e.stopPropagation(); onRespondToPrompt(message.content!); }}
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                Share your answer
              </Button>
            )}
          </div>
        );
      case 'text':
        return (
          <p className="text-[15px] leading-[1.5] break-words">
            {renderTextWithMentions(message.content || '')}
          </p>
        );
      case 'gif':
        return (
          <div className="rounded-xl overflow-hidden max-w-[280px]">
            <img src={message.gifUrl} alt="GIF" className="w-full h-auto" loading="lazy" />
          </div>
        );
      case 'voice':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 py-1">
              <Button onClick={handlePlayVoice} size="sm" variant="ghost" className="h-9 w-9 p-0 rounded-full bg-background/20">
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <div className="flex-1 h-1 bg-background/20 rounded-full">
                <div className={cn('h-full bg-current rounded-full transition-all', isPlaying ? 'w-2/3' : 'w-0')} />
              </div>
              <Volume2 className="h-3.5 w-3.5 opacity-60" />
            </div>
            {message.voiceTranscription && (
              <p className="text-xs opacity-70 italic leading-relaxed">
                {message.voiceTranscription}
              </p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const ReactionPills = () => {
    if (!message.reactions?.length) return null;
    return (
      <div className={cn('flex flex-wrap gap-1 mt-1.5', isOwnMessage ? 'justify-end' : 'justify-start', isAiHost && 'justify-center')}>
        {message.reactions.map((reaction) => (
          <button
            key={reaction.emoji}
            type="button"
            className="inline-flex items-center gap-1 h-6 px-2 text-xs rounded-full bg-muted/80 hover:bg-muted border border-border/50 transition-colors"
            onClick={() => handleReaction?.(message.id, reaction.emoji)}
          >
            <span>{reaction.emoji}</span>
            <span className="text-muted-foreground font-medium">{reaction.count}</span>
          </button>
        ))}
      </div>
    );
  };

  const ReactionPicker = () => {
    if (!showReactions || message.isPending) return null;
    return (
      <div className={cn(
        'flex gap-0.5 mt-1.5 p-1 bg-popover border border-border/60 rounded-full shadow-sm w-fit',
        isOwnMessage ? 'ml-auto' : '',
        isAiHost && 'mx-auto'
      )}>
        {!message.isPending && REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="h-8 w-8 text-base rounded-full hover:bg-muted transition-colors"
            onClick={() => { handleReaction?.(message.id, emoji); setShowReactions(false); }}
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  };

  if (isHidden) return null;

  if (isAiHost) {
    return (
      <div className="flex justify-center mb-6 px-3 group" role="article" aria-label="AI Host message">
        <div className="max-w-[88%] w-full">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
            </div>
            <span className="text-xs font-semibold text-primary/90 tracking-tight">Group Host</span>
            <time className="text-[11px] text-muted-foreground/70">{formatTime(message.timestamp)}</time>
          </div>
          <div
            className="px-4 py-4 rounded-2xl bg-gradient-to-br from-primary/8 to-primary/4 border border-primary/20 cursor-pointer relative overflow-hidden"
            onClick={() => !message.isPending && setShowReactions(!showReactions)}
          >
            <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary/40" />
            <div className="pl-2">
              {renderMessageContent()}
            </div>
          </div>
          <ReactionPills />
          <ReactionPicker />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('flex mb-6 group px-3', isOwnMessage ? 'justify-end' : 'justify-start')}
      role="article"
    >
      <div className={cn('max-w-[78%] relative', isOwnMessage ? 'items-end' : 'items-start')}>
        <div className={cn('flex items-center gap-1.5 mb-1', isOwnMessage ? 'justify-end' : 'justify-start')}>
          {!isOwnMessage && (
            <>
              <span className="text-xs font-medium text-foreground/80">{displayName}</span>
              {userOnlineStatus?.isOnline && (
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" title="Online" aria-label="Online" />
              )}
            </>
          )}
          <time className="text-[11px] text-muted-foreground/60">{formatTime(message.timestamp)}</time>
          {message.isPending && (
            <span className="text-xs text-muted-foreground ml-1">⏳</span>
          )}

          {!isOwnMessage && (
            <MessageModerationMenu
              messageId={message.id}
              authorId={message.userId}
              chatType={chatType}
              groupId={groupId}
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Message options">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwnMessage ? 'end' : 'start'}>
              {onPin && (
                <DropdownMenuItem onClick={handlePinMessage}>
                  <Pin className="h-4 w-4 mr-2" />Pin
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleHideMessage}>
                <EyeOff className="h-4 w-4 mr-2" />Hide
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div
          className={cn(
            'px-4 py-3 rounded-2xl transition-shadow',
            !message.isPending && 'cursor-pointer',
            message.isPending && 'opacity-60',
            isOwnMessage
              ? 'bg-primary text-primary-foreground rounded-br-md ml-1'
              : 'bg-card border border-border/50 rounded-bl-md mr-1',
            !message.isPending && 'hover:shadow-sm'
          )}
          onClick={() => !message.isPending && setShowReactions(!showReactions)}
        >
          {renderMessageContent()}
        </div>

        <ReactionPills />
        <ReactionPicker />
      </div>
    </div>
  );
};
