import { useState, useEffect } from 'react';

interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typingUsers.length === 0) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [typingUsers.length]);

  if (!visible || typingUsers.length === 0) return null;

  const formatTypingText = () => {
    if (typingUsers.length === 1) return `${typingUsers[0].username} is typing`;
    if (typingUsers.length === 2) return `${typingUsers[0].username} and ${typingUsers[1].username} are typing`;
    return `${typingUsers.length} people are typing`;
  };

  return (
    <div
      className="px-4 py-2 flex items-center gap-2"
      role="status"
      aria-live="polite"
      aria-label={formatTypingText()}
    >
      <div className="flex gap-[3px] items-center" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <div
            key={delay}
            className="w-[5px] h-[5px] bg-muted-foreground/50 rounded-full animate-bounce"
            style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{formatTypingText()}</span>
    </div>
  );
};
