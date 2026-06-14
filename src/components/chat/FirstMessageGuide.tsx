import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MessageCircle, Sparkles, UserRound } from 'lucide-react';

interface FirstMessageGuideProps {
  groupName: string;
  onQuickAction: (text: string) => void;
  hasDailyPrompt?: boolean;
  onAnswerPrompt?: () => void;
}

const QUICK_ACTIONS = [
  {
    label: 'Say Hello',
    text: 'Hey everyone! 👋 Excited to be here.',
    icon: MessageCircle,
  },
  {
    label: 'Introduce Yourself',
    text: "Hi! I'm new here — looking forward to getting to know you all.",
    icon: UserRound,
  },
];

export const FirstMessageGuide = ({
  groupName,
  onQuickAction,
  hasDailyPrompt,
  onAnswerPrompt,
}: FirstMessageGuideProps) => {
  return (
    <div className="max-w-md mx-auto space-y-5 px-2">
      <div className="text-center space-y-2">
        <h3 className="text-lg sm:text-xl font-semibold text-foreground">
          Start the conversation
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Welcome to <strong className="text-foreground">{groupName}</strong>. Pick a quick
          action below — or type your own message when you&apos;re ready.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUICK_ACTIONS.map(({ label, text, icon: Icon }) => (
          <Button
            key={label}
            variant="outline"
            className="h-auto py-4 px-4 flex flex-col items-start gap-2 text-left"
            onClick={() => onQuickAction(text)}
          >
            <Icon className="w-5 h-5 text-primary" />
            <span className="font-medium">{label}</span>
          </Button>
        ))}

        {hasDailyPrompt && onAnswerPrompt && (
          <Button
            variant="outline"
            className="h-auto py-4 px-4 flex flex-col items-start gap-2 text-left sm:col-span-2"
            onClick={onAnswerPrompt}
          >
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-medium">Answer Today&apos;s Prompt</span>
          </Button>
        )}
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <p className="text-xs text-muted-foreground text-center">
          Introduce yourself · Share what brought you here · Say something interesting about
          yourself
        </p>
      </Card>
    </div>
  );
};
