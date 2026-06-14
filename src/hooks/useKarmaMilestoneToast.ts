import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useEnhancedKarma, KARMA_LEVELS } from '@/hooks/useEnhancedKarma';

function getTierRank(levelName: string): number {
  return KARMA_LEVELS.findIndex((level) => level.level === levelName);
}

function milestoneKey(groupId: string, tierName: string): string {
  return `karma_milestone_shown_${groupId}_${tierName}`;
}

export function useKarmaMilestoneToast(groupId: string): void {
  const { karmaProgress, loading } = useEnhancedKarma();
  const { toast } = useToast();
  const lastKnownTierRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (loading || !karmaProgress) return;

    const currentTier = karmaProgress.currentLevel.level;

    if (!initializedRef.current) {
      lastKnownTierRef.current = currentTier;
      initializedRef.current = true;
      return;
    }

    const previousTier = lastKnownTierRef.current;
    if (!previousTier || currentTier === previousTier) return;

    const previousRank = getTierRank(previousTier);
    const currentRank = getTierRank(currentTier);
    if (currentRank <= previousRank) {
      lastKnownTierRef.current = currentTier;
      return;
    }

    const storageKey = milestoneKey(groupId, currentTier);
    if (localStorage.getItem(storageKey) === '1') {
      lastKnownTierRef.current = currentTier;
      return;
    }

    const newTier = karmaProgress.currentLevel;
    toast({
      title: `${newTier.icon} You reached ${newTier.level}!`,
      description: 'Your karma in this group keeps growing.',
      duration: 5000,
    });

    localStorage.setItem(storageKey, '1');
    lastKnownTierRef.current = currentTier;
  }, [groupId, karmaProgress, loading, toast]);
}
