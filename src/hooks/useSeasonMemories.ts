import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  GroupSeason,
  SeasonMemoriesData,
  SeasonMemory,
  SeasonRecap,
  SeasonTimelineEvent,
} from '@/types/seasonMemory';

const EMPTY_STATE: SeasonMemoriesData = {
  activeSeason: null,
  latestRecap: null,
  recentMemories: [],
  timelineEvents: [],
  pastRecaps: [],
  loading: true,
};

export const useSeasonMemories = (groupId: string | null | undefined) => {
  const [data, setData] = useState<SeasonMemoriesData>(EMPTY_STATE);

  const loadSeasonMemories = useCallback(async () => {
    if (!groupId) {
      setData({ ...EMPTY_STATE, loading: false });
      return;
    }

    setData((prev) => ({ ...prev, loading: true }));

    try {
      const [
        seasonsRes,
        recapsRes,
        memoriesRes,
        timelineRes,
      ] = await Promise.all([
        supabase
          .from('group_seasons')
          .select('*')
          .eq('group_id', groupId)
          .order('season_number', { ascending: false }),
        supabase
          .from('season_recaps')
          .select('*')
          .eq('group_id', groupId)
          .order('generated_at', { ascending: false })
          .limit(12),
        supabase
          .from('season_memories')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('season_timeline_events')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      if (seasonsRes.error) throw seasonsRes.error;
      if (recapsRes.error) throw recapsRes.error;
      if (memoriesRes.error) throw memoriesRes.error;
      if (timelineRes.error) throw timelineRes.error;

      const seasons = (seasonsRes.data || []) as GroupSeason[];
      const recaps = (recapsRes.data || []) as SeasonRecap[];
      const memories = (memoriesRes.data || []) as SeasonMemory[];
      const timeline = (timelineRes.data || []) as SeasonTimelineEvent[];

      const activeSeason = seasons.find((s) => s.is_active) || seasons[0] || null;
      const latestRecap = recaps[0] || null;
      const activeSeasonId = activeSeason?.id;

      const seasonMemories = activeSeasonId
        ? memories.filter((m) => m.season_id === activeSeasonId)
        : memories;
      const seasonTimeline = activeSeasonId
        ? timeline.filter((e) => e.season_id === activeSeasonId)
        : timeline;

      setData({
        activeSeason,
        latestRecap,
        recentMemories: seasonMemories,
        timelineEvents: seasonTimeline.reverse(),
        pastRecaps: recaps,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading season memories:', error);
      setData({ ...EMPTY_STATE, loading: false });
    }
  }, [groupId]);

  useEffect(() => {
    loadSeasonMemories();
  }, [loadSeasonMemories]);

  return { ...data, refresh: loadSeasonMemories };
};
