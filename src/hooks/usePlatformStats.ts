import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformStats {
  totalMembers: number;
  activeGroups: number;
  activeSeasons: number;
  loading: boolean;
}

export function roundStatDown(n: number): number {
  if (n < 10) return 0;
  if (n < 100) return Math.floor(n / 10) * 10;
  if (n < 500) return Math.floor(n / 50) * 50;
  return Math.floor(n / 100) * 100;
}

export function usePlatformStats(): PlatformStats {
  const [stats, setStats] = useState<PlatformStats>({
    totalMembers: 0,
    activeGroups: 0,
    activeSeasons: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.rpc('get_platform_stats');
        if (error || !data || typeof data !== 'object') {
          setStats({
            totalMembers: 0,
            activeGroups: 0,
            activeSeasons: 0,
            loading: false,
          });
          return;
        }

        const payload = data as Record<string, unknown>;
        setStats({
          totalMembers: Number(payload.total_members) || 0,
          activeGroups: Number(payload.active_groups) || 0,
          activeSeasons: Number(payload.active_seasons) || 0,
          loading: false,
        });
      } catch {
        setStats({
          totalMembers: 0,
          activeGroups: 0,
          activeSeasons: 0,
          loading: false,
        });
      }
    };

    fetchStats();
  }, []);

  return stats;
}
