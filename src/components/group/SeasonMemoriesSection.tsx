import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { useSeasonMemories } from '@/hooks/useSeasonMemories';
import {
  BookOpen,
  Calendar,
  ChevronRight,
  History,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { MemoryType, RecapType } from '@/types/seasonMemory';

interface SeasonMemoriesSectionProps {
  groupId: string;
  groupName?: string;
  compact?: boolean;
}

const memoryTypeLabels: Record<MemoryType, string> = {
  achievement: 'Achievement',
  milestone: 'Milestone',
  community_growth: 'Growth',
  activity_highlight: 'Activity',
  identity_highlight: 'Identity',
};

const recapTypeLabels: Record<RecapType, string> = {
  monthly: 'Monthly Recap',
  milestone: 'Milestone',
  final: 'Final Season',
};

export const SeasonMemoriesSection = ({
  groupId,
  groupName,
  compact = false,
}: SeasonMemoriesSectionProps) => {
  const {
    activeSeason,
    latestRecap,
    recentMemories,
    timelineEvents,
    pastRecaps,
    loading,
  } = useSeasonMemories(groupId);

  const [showFullHistory, setShowFullHistory] = useState(false);

  if (loading) {
    return (
      <Card className="border-primary/10">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Loading season memories...
        </CardContent>
      </Card>
    );
  }

  if (!activeSeason && !latestRecap && recentMemories.length === 0) {
    return (
      <Card className="border-dashed border-muted/50 bg-muted/5">
        <CardContent className="p-6 text-center">
          <History className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Your group&apos;s season story will grow as you build community together.
          </p>
        </CardContent>
      </Card>
    );
  }

  const recentMilestone = recentMemories.find((m) => m.memory_type === 'milestone');
  const topTimeline = timelineEvents.slice(-4).reverse();

  const content = (
    <div className="space-y-4">
      {activeSeason && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Season {activeSeason.season_number}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {activeSeason.is_active ? 'In Progress' : 'Completed'}
          </Badge>
        </div>
      )}

      {latestRecap && (
        <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wide">
              {recapTypeLabels[latestRecap.recap_type as RecapType] || 'Season Recap'}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-foreground">{latestRecap.recap_text}</p>
        </div>
      )}

      {recentMilestone && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <Trophy className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
              Recent Milestone
            </p>
            <p className="text-sm text-foreground">{recentMilestone.memory_text}</p>
          </div>
        </div>
      )}

      {topTimeline.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Timeline
          </p>
          <div className="space-y-2">
            {topTimeline.map((event) => (
              <div key={event.id} className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="flex-1">{event.event_label}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && recentMemories.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Memory Cards
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {recentMemories.slice(0, 4).map((memory) => (
              <div
                key={memory.id}
                className="rounded-lg border bg-card p-3 text-sm"
              >
                <Badge variant="secondary" className="text-[10px] mb-1.5">
                  {memoryTypeLabels[memory.memory_type as MemoryType] || memory.memory_type}
                </Badge>
                <p className="text-muted-foreground leading-snug">{memory.memory_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(pastRecaps.length > 1 || timelineEvents.length > 4) && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-primary"
          onClick={() => setShowFullHistory(true)}
        >
          View full history
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Card className="border-primary/10 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="w-5 h-5 text-primary" />
            Season Memories
          </CardTitle>
          <CardDescription>
            {groupName
              ? `Celebrate what ${groupName} accomplished together`
              : 'Your community history — built from activity, not conversations'}
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>

      <ResponsiveModal
        open={showFullHistory}
        onOpenChange={setShowFullHistory}
        title="Season History"
      >
        <ScrollArea className="max-h-[70vh] pr-4">
          <p className="text-sm text-muted-foreground mb-4">
            Recaps, milestones, and timeline events for your group
          </p>
          <div className="space-y-6 pb-4">
            {pastRecaps.map((recap) => (
              <div key={recap.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    {recapTypeLabels[recap.recap_type as RecapType]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(recap.generated_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{recap.recap_text}</p>
              </div>
            ))}

            <div>
              <h4 className="text-sm font-semibold mb-3">Full Timeline</h4>
              <div className="space-y-3 border-l-2 border-primary/20 pl-4 ml-2">
                {timelineEvents.map((event) => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium">{event.event_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {recentMemories.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">All Memory Cards</h4>
                <div className="grid gap-2">
                  {recentMemories.map((memory) => (
                    <div key={memory.id} className="rounded-lg border p-3 text-sm">
                      <Badge variant="secondary" className="text-[10px] mb-1">
                        {memoryTypeLabels[memory.memory_type as MemoryType]}
                      </Badge>
                      <p>{memory.memory_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </ResponsiveModal>
    </>
  );
};
