import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface PendingReport {
  id: string;
  report_reason: string;
  additional_context: string | null;
  chat_type: string;
  reported_message_id: string;
  reported_user_id: string | null;
  group_id: string | null;
  reporter_id: string;
  status: string;
  created_at: string;
}

export interface GroupHealthSummary {
  group_id: string;
  health_score: number;
  participation_rate: number;
  active_member_pct: number;
  needs_intervention: boolean;
  group_name?: string;
}

export const useAdminModeration = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [healthScores, setHealthScores] = useState<GroupHealthSummary[]>([]);
  const [spamEvents, setSpamEvents] = useState<Array<{ id: string; event_type: string; severity: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  const checkAdmin = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      return false;
    }

    const { data } = await supabase.rpc('is_user_admin', { p_user_id: user.id });
    const admin = !!data;
    setIsAdmin(admin);
    return admin;
  }, [user]);

  const loadAdminData = useCallback(async () => {
    if (!user) return;

    const admin = await checkAdmin();
    if (!admin) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [reportsRes, healthRes, spamRes] = await Promise.all([
        supabase
          .from('user_reports')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('group_health_scores')
          .select('*, groups(name)')
          .order('health_score', { ascending: true })
          .limit(30),
        supabase
          .from('spam_detection_events')
          .select('id, event_type, severity, created_at')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      setPendingReports((reportsRes.data ?? []) as PendingReport[]);
      setHealthScores(
        (healthRes.data ?? []).map((h: Record<string, unknown>) => ({
          group_id: h.group_id as string,
          health_score: Number(h.health_score),
          participation_rate: Number(h.participation_rate),
          active_member_pct: Number(h.active_member_pct),
          needs_intervention: !!h.needs_intervention,
          group_name: (h.groups as { name?: string })?.name,
        }))
      );
      setSpamEvents(spamRes.data ?? []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, checkAdmin]);

  const resolveReport = async (
    reportId: string,
    action: 'warning' | 'restriction' | 'lockout' | 'shadow_mute' | 'removal' | 'dismiss',
    notes?: string
  ) => {
    if (action === 'dismiss') {
      const { error } = await supabase
        .from('user_reports')
        .update({ status: 'dismissed', resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq('id', reportId);
      if (error) return false;
    } else {
      const { data, error } = await supabase.rpc('resolve_user_report', {
        p_report_id: reportId,
        p_action: action,
        p_notes: notes ?? null,
      });
      if (error) return false;
      const result = data as { ok?: boolean };
      if (!result?.ok) return false;
    }

    await loadAdminData();
    return true;
  };

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  return {
    isAdmin,
    pendingReports,
    healthScores,
    spamEvents,
    loading,
    resolveReport,
    refresh: loadAdminData,
  };
};
