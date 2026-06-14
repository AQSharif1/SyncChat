import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { VoiceRecorder } from './VoiceRecorder';
import { GiphyPicker } from './GiphyPicker';
import { useGroupChatContext } from './GroupChatContext';
import { useVoiceRoom } from '@/contexts/VoiceRoomContext';
import { useNetworkResilience } from '@/hooks/useNetworkResilience';
import { validateChatMessage } from '@/lib/security';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Gamepad2,
  BarChart3,
  ListMusic,
  Mic,
  Headphones,
  Image,
  Send,
  WifiOff,
} from 'lucide-react';

export const ChatInputBar = () => {
  const {
    groupId,
    groupName,
    userProfile,
    isLoading,
    messagesLoading,
    replyDraft,
    setReplyDraft,
    handleSendTextMessage,
    handleSendGif,
    handleSendVoice,
    handleToolSelect,
    registerChatInputFocus,
  } = useGroupChatContext();

  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [showVoiceOptions, setShowVoiceOptions] = useState(false);
  const { toast } = useToast();
  const { isOnline } = useNetworkResilience();
  const { joinVoiceRoom, leaveVoiceRoom, isConnected } = useVoiceRoom();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    registerChatInputFocus(() => {
      areaRef.current?.focus();
    });
  }, [registerChatInputFocus]);

  useEffect(() => {
    if (replyDraft) {
      setMessage(replyDraft);
      areaRef.current?.focus();
    }
  }, [replyDraft]);

  useEffect(() => {
    if (!areaRef.current) return;
    areaRef.current.style.height = '0px';
    areaRef.current.style.height = `${Math.min(areaRef.current.scrollHeight, 160)}px`;
  }, [message]);

  const handleSendText = async () => {
    if (!message.trim() || sendingMessage) return;
    const validation = validateChatMessage(message);
    if (!validation.isValid) {
      toast({ title: 'Invalid Message', description: validation.error, variant: 'destructive' });
      return;
    }
    setSendingMessage(true);
    const success = await handleSendTextMessage(validation.sanitizedMessage, 'text');
    if (success) setMessage('');
    setSendingMessage(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const runAction = (action: () => void) => {
    setShowActionsSheet(false);
    action();
  };

  return (
    <div className="w-full px-3 sm:px-4 py-2.5 bg-background border-t border-border/60 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      {!isOnline && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-2">
          <WifiOff className="w-3 h-3 flex-shrink-0" />
          Offline — messages will send when you reconnect
        </div>
      )}
      <div className="flex items-end gap-1.5 sm:gap-2 chat-composer px-3 py-2">
        <textarea
          ref={areaRef}
          value={message}
          disabled={!userProfile || sendingMessage}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground outline-none leading-5 sm:leading-6 max-h-32 min-h-[36px] py-1.5 text-sm sm:text-[15px]"
          aria-label="Message input"
        />

        <button
          type="button"
          onClick={() => setShowActionsSheet(true)}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0 transition-colors"
          aria-label="More actions"
        >
          <Plus className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={handleSendText}
          disabled={!userProfile || sendingMessage || !message.trim()}
          className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 flex-shrink-0 transition-colors"
          aria-label={isOnline ? 'Send message' : 'Queue message'}
        >
          {sendingMessage ? (
            <LoadingSpinner size="sm" />
          ) : isOnline ? (
            <Send className="h-4 w-4" />
          ) : (
            <span className="text-xs font-medium px-0.5">Queue</span>
          )}
        </button>
      </div>

      <Sheet open={showActionsSheet} onOpenChange={setShowActionsSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Send or create</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border">
              <Image className="h-5 w-5" />
              <span className="text-sm font-medium">GIF</span>
              <GiphyPicker
                onGifSelect={async (url) => {
                  setShowActionsSheet(false);
                  await handleSendGif(url);
                }}
                disabled={!userProfile || sendingMessage}
                compact
              />
            </div>
            <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border">
              <Mic className="h-5 w-5" />
              <span className="text-sm font-medium">Voice message</span>
              <VoiceRecorder
                onRecordingComplete={async (blob) => {
                  setShowActionsSheet(false);
                  await handleSendVoice(blob);
                }}
                disabled={!userProfile || sendingMessage}
              />
            </div>
            <ActionTile icon={<Gamepad2 className="h-5 w-5" />} label="Games" onClick={() => runAction(() => handleToolSelect('game'))} />
            <ActionTile icon={<BarChart3 className="h-5 w-5" />} label="Poll" onClick={() => runAction(() => handleToolSelect('poll'))} />
            <ActionTile icon={<ListMusic className="h-5 w-5" />} label="Playlist" onClick={() => runAction(() => handleToolSelect('playlist'))} />
            <ActionTile
              icon={<Headphones className="h-5 w-5" />}
              label={isConnected ? 'Leave voice room' : 'Voice room'}
              onClick={() =>
                runAction(() => {
                  if (isConnected) leaveVoiceRoom();
                  else if (groupId && groupName) setShowVoiceOptions(true);
                })
              }
            />
          </div>
        </SheetContent>
      </Sheet>

      {showVoiceOptions && groupId && groupName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 min-w-[300px] max-w-[90vw] space-y-3">
            <p className="text-lg font-semibold text-center">Join Voice Room</p>
            <button
              type="button"
              onClick={async () => {
                setShowVoiceOptions(false);
                await joinVoiceRoom(groupId, groupName, true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-muted"
            >
              <Headphones className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">With Microphone</div>
                <div className="text-xs text-muted-foreground">Speak and listen</div>
              </div>
            </button>
            <button
              type="button"
              onClick={async () => {
                setShowVoiceOptions(false);
                await joinVoiceRoom(groupId, groupName, false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-muted"
            >
              <Headphones className="h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">Listen Only</div>
              </div>
            </button>
            <button type="button" onClick={() => setShowVoiceOptions(false)} className="w-full text-sm text-muted-foreground py-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ActionTileProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function ActionTile({ icon, label, onClick }: ActionTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium"
    >
      {icon}
      {label}
    </button>
  );
}
