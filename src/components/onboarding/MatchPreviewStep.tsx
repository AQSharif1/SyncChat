import { Card } from '@/components/ui/card';
import { Sparkles, Users } from 'lucide-react';
import { generateMatchPreview } from '@/utils/matchExplanation';
import type { MatchingProfile } from '@/types/matchingProfile';

interface MatchPreviewStepProps {
  profile: MatchingProfile;
}

export const MatchPreviewStep = ({ profile }: MatchPreviewStepProps) => {
  const previewLines = generateMatchPreview(profile);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Based on your profile, SyncChat will match you with a community that fits your life
          stage, goals, and personality — not random strangers.
        </p>
      </div>

      <Card className="p-6 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">You&apos;re likely to connect with:</h3>
        </div>
        <ul className="space-y-3">
          {previewLines.map((line) => (
            <li
              key={line}
              className="flex items-center gap-3 text-base py-2 px-3 rounded-lg bg-background/80 border border-border/50"
            >
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-center text-muted-foreground px-4">
        This is a preview only — we won&apos;t assign you to a specific group until you confirm.
        No other users are shown.
      </p>
    </div>
  );
};
