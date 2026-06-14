import React, { useRef, useState, useEffect } from "react";
import { useVoiceRoom } from '@/contexts/VoiceRoomContext';
import { useToast } from '@/hooks/use-toast';
import { validateChatMessage } from '@/lib/security';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { VoiceRecorder } from './VoiceRecorder';
import { GiphyPicker } from './GiphyPicker';

// Lightweight inline SVG icons (no external deps)

const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

// Menu entry iconography
const GamepadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
    <rect x="3" y="9" width="18" height="8" rx="4" />
    <path d="M8 13h-3M6.5 11.5v3" />
    <circle cx="16.5" cy="12.5" r="1" />
    <circle cx="18.5" cy="14.5" r="1" />
  </svg>
);

const HeadsetIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
    <path d="M4 13a8 8 0 1 1 16 0v5a2 2 0 0 1-2 2h-1v-7h3M4 20h1a2 2 0 0 0 2-2v-5H4" />
  </svg>
);

interface ChatInputProps {
  onSendMessage: (message: string, type: 'text') => Promise<boolean>;
  onSendGif: (gifUrl: string) => Promise<boolean>;
  onSendVoice: (audioBlob: Blob) => Promise<boolean>;
  onToolSelect: (tool: string) => void;
  disabled?: boolean;
  loading?: boolean;
  groupId?: string;
  groupName?: string;
  prefillDraft?: string;
}

export const ChatInput = ({ 
  onSendMessage, 
  onSendGif, 
  onSendVoice, 
  onToolSelect, 
  disabled, 
  loading, 
  groupId, 
  groupName,
  prefillDraft,
}: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMicrophoneOptions, setShowMicrophoneOptions] = useState(false);
  const { toast } = useToast();
  const { joinVoiceRoom, leaveVoiceRoom, isConnected } = useVoiceRoom();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const microphoneOptionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefillDraft) {
      setMessage(prefillDraft);
      areaRef.current?.focus();
    }
  }, [prefillDraft]);

  // autosize textarea
  useEffect(() => {
    if (!areaRef.current) return;
    areaRef.current.style.height = "0px";
    areaRef.current.style.height = Math.min(areaRef.current.scrollHeight, 160) + "px";
  }, [message]);

  // Close microphone options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (microphoneOptionsRef.current && !microphoneOptionsRef.current.contains(event.target as Node)) {
        setShowMicrophoneOptions(false);
      }
    };

    if (showMicrophoneOptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMicrophoneOptions]);

  const handleSendText = async () => {
    if (message.trim() && !sendingMessage) {
      // Validate and sanitize the message
      const validation = validateChatMessage(message);
      
      if (!validation.isValid) {
        toast({
          title: "Invalid Message",
          description: validation.error || "Message contains invalid content",
          variant: "destructive",
        });
        return;
      }
      
      setSendingMessage(true);
      const success = await onSendMessage(validation.sanitizedMessage, 'text');
      if (success) {
        setMessage('');
      }
      setSendingMessage(false);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleStartVoiceRoom = () => {
    if (groupId && groupName) {
      if (isConnected) {
        leaveVoiceRoom();
      } else {
        setShowMicrophoneOptions(true);
      }
    }
  };

  const handleStartGame = (gameType: string) => {
    onToolSelect(gameType);
  };

  return (
    <div className="w-full px-3 sm:px-4 py-2.5 bg-background border-t border-border/60">
      <div className="flex items-end gap-1.5 sm:gap-2 chat-composer px-3 py-2">
        {/* text area */}
        <textarea
          ref={areaRef}
          value={message}
          disabled={disabled || sendingMessage}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground outline-none leading-5 sm:leading-6 max-h-32 sm:max-h-40 min-h-[36px] sm:min-h-[40px] py-1.5 sm:py-2 text-sm sm:text-[15px]"
          aria-label="Message input"
        />

        {/* mic for voice notes - directly triggers voice recording */}
        <div className="relative">
          <VoiceRecorder 
            onRecordingComplete={onSendVoice} 
            disabled={disabled || sendingMessage}
          />
        </div>

        {/* GIF picker */}
        <div className="relative">
          <GiphyPicker onGifSelect={onSendGif} disabled={disabled || sendingMessage} />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSendText}
          disabled={disabled || sendingMessage || !message.trim()}
          className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 transition-colors duration-150"
          aria-label="Send message"
        >
          {sendingMessage ? (
            <LoadingSpinner size="sm" />
          ) : (
            <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>

        {/* plus menu: Game + Voice Room */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((s) => !s)}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-shrink-0 transition-colors duration-150"
            aria-expanded={showMenu}
            aria-haspopup="menu"
            aria-label="Open actions"
          >
            <PlusIcon className="h-5 w-5 sm:h-7 sm:w-7" />
          </button>

          {showMenu && (
            <div className="absolute right-0 bottom-12 min-w-[220px] rounded-xl bg-popover border border-border shadow-lg p-1 z-50 animate-scale-in">
              <MenuItem 
                icon={<GamepadIcon className="h-5 w-5" />} 
                label="Start a Game" 
                onClick={() => { 
                  setShowMenu(false); 
                  // Show game picker
                  onToolSelect('game');
                }} 
              />
              {groupId && groupName && (
                <MenuItem 
                  icon={<HeadsetIcon className="h-5 w-5" />} 
                  label={isConnected ? "Leave Voice Room" : "Start Voice Room"} 
                  onClick={() => { 
                    setShowMenu(false); 
                    handleStartVoiceRoom();
                  }} 
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Microphone Options Modal for Voice Room */}
      {showMicrophoneOptions && (
        <div ref={microphoneOptionsRef} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 min-w-[300px] max-w-[90vw] animate-scale-in">
            <div className="space-y-4">
              <div className="text-lg font-semibold text-foreground text-center">
                Join Voice Room
              </div>
              <div className="text-sm text-muted-foreground text-center mb-4">
                Choose your microphone preference
              </div>
              
              <button
                onClick={async () => {
                  setShowMicrophoneOptions(false);
                  await joinVoiceRoom(groupId!, groupName!, true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-border transition-colors"
              >
                <HeadsetIcon className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">With Microphone</div>
                  <div className="text-xs text-muted-foreground">Speak and listen</div>
                </div>
              </button>
              
              <button
                onClick={async () => {
                  setShowMicrophoneOptions(false);
                  await joinVoiceRoom(groupId!, groupName!, false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-border transition-colors"
              >
                <HeadsetIcon className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Listen Only</div>
                  <div className="text-xs text-muted-foreground">Hear others but can't speak</div>
                </div>
              </button>
              
              <button
                onClick={() => setShowMicrophoneOptions(false)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted text-muted-foreground focus-visible:outline-none transition-colors"
              >
                <span className="text-sm">Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hint row */}
      <div className="px-3 pt-1.5 text-[11px] text-muted-foreground/70 select-none hidden sm:block">
        Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> to send · <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Shift</kbd>+<kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd> for a new line
      </div>
    </div>
  );
};

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}