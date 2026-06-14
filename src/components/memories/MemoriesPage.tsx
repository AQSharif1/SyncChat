import { useAppData } from '@/hooks/useAppData';
import { useArchivedGroupMemories } from '@/hooks/useArchivedGroupMemories';
import { usePremium } from '@/hooks/usePremium';
import { PageHeader, SectionCard, SectionHeader, EmptyState } from '@/components/design-system';
import { SeasonMemoriesSection } from '@/components/group/SeasonMemoriesSection';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Calendar, Crown, Lock } from 'lucide-react';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface MemoriesPageProps {
  onViewPremium?: () => void;
}

export function MemoriesPage({ onViewPremium }: MemoriesPageProps) {
  const { currentGroup } = useAppData();
  const { archivedGroups, loading } = useArchivedGroupMemories();
  const { isPremium, canViewArchivedSeason } = usePremium();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner size="lg" text="Loading memories..." />
      </div>
    );
  }

  const hasCurrentMemories = !!currentGroup;
  const hasArchivedMemories = archivedGroups.length > 0;
  const showArchiveGate = hasArchivedMemories && !canViewArchivedSeason();

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-8 animate-fade-in">
      <PageHeader
        title="Memories"
        subtitle="Season recaps and milestones from your communities"
      />

      {hasCurrentMemories && (
        <section className="space-y-3">
          <SectionHeader>Current Season</SectionHeader>
          <SeasonMemoriesSection
            groupId={currentGroup.id}
            groupName={currentGroup.name}
          />
        </section>
      )}

      {hasArchivedMemories && (
        <section className="space-y-3 relative">
          <SectionHeader>Past Seasons</SectionHeader>

          {showArchiveGate && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 backdrop-blur-sm px-4">
              <SectionCard padding="md" className="max-w-sm w-full text-center space-y-3 shadow-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold">Full season archive</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Free accounts see the current season. Upgrade to unlock every past season, recap, and milestone.
                </p>
                {onViewPremium && (
                  <Button className="w-full gap-2" onClick={onViewPremium}>
                    <Crown className="w-4 h-4" />
                    Upgrade to Premium
                  </Button>
                )}
              </SectionCard>
            </div>
          )}

          <div className={showArchiveGate ? 'blur-sm pointer-events-none select-none space-y-3' : 'space-y-3'}>
            {archivedGroups.map((group) => (
              <SectionCard key={group.groupId} padding="md" className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">
                      {group.groupName}
                    </h3>
                    {group.seasons.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {group.seasons.length} season{group.seasons.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    Archived
                  </Badge>
                </div>

                {group.latestRecap && (
                  <div className="rounded-lg bg-muted/40 border border-border/40 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span className="font-medium capitalize">
                        {group.latestRecap.recap_type.replace(/_/g, ' ')} recap
                      </span>
                      {group.latestRecap.generated_at && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <Calendar className="w-3 h-3" />
                          <time dateTime={group.latestRecap.generated_at}>
                            {formatDate(group.latestRecap.generated_at)}
                          </time>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                      {group.latestRecap.recap_text}
                    </p>
                  </div>
                )}

                {group.seasons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {group.seasons.slice(0, 3).map((season) => (
                      <Badge key={season.id} variant="outline" className="text-xs font-normal">
                        Season {season.season_number}
                      </Badge>
                    ))}
                    {group.seasons.length > 3 && (
                      <Badge variant="outline" className="text-xs font-normal">
                        +{group.seasons.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </SectionCard>
            ))}
          </div>

          {isPremium && (
            <p className="text-xs text-muted-foreground text-center">
              Premium: full archive unlocked
            </p>
          )}
        </section>
      )}

      {!hasCurrentMemories && !hasArchivedMemories && (
        <SectionCard>
          <EmptyState
            icon={BookOpen}
            title="No memories yet"
            description="As you build community and complete seasons, your recaps and milestones will appear here."
          />
        </SectionCard>
      )}
    </div>
  );
}
