import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { GroupSeason, SeasonRecap } from '@/types/seasonMemory';

export interface ArchivedGroupMemory {
  groupId: string;
  groupName: string;
  seasons: GroupSeason[];
  latestRecap: SeasonRecap | null;
}

export const useArchivedGroupMemories = () => {
  const { user } = useAuth();
  const [archivedGroups, setArchivedGroups] = useState<ArchivedGroupMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadArchivedMemories = useCallback(async () => {
    if (!user) {
      setArchivedGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: accessRows, error: accessError } = await supabase
        .from('group_memory_access')
        .select('group_id, group_name, groups(id, name)')
        .eq('user_id', user.id);

      if (accessError) throw accessError;
      if (!accessRows?.length) {
        setArchivedGroups([]);
        setLoading(false);
        return;
      }

      const activeGroupIds = new Set<string>();
      const { data: activeMembership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      for (const m of activeMembership ?? []) {
        activeGroupIds.add(m.group_id);
      }

      const archived: ArchivedGroupMemory[] = [];

      for (const row of accessRows) {
        const groupMeta = row.groups as { id: string; name: string } | null;
        const groupId = row.group_id;
        const groupName =
          row.group_name ||
          groupMeta?.name ||
          'Past Community';
        if (activeGroupIds.has(groupId)) continue;

        const [seasonsRes, recapsRes] = await Promise.all([
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
            .limit(1),
        ]);

        archived.push({
          groupId,
          groupName,
          seasons: (seasonsRes.data ?? []) as GroupSeason[],
          latestRecap: (recapsRes.data?.[0] as SeasonRecap) ?? null,
        });
      }

      setArchivedGroups(archived);
    } catch (error) {
      console.error('Error loading archived group memories:', error);
      setArchivedGroups([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadArchivedMemories();
  }, [loadArchivedMemories]);

  return { archivedGroups, loading, refresh: loadArchivedMemories };
};
