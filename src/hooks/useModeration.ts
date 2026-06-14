import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserReport {
  messageId: string;
  reportedUserId: string;
  groupId?: string;
  chatType: 'group' | 'private';
  reason: string;
  additionalContext?: string;
}

export const useModeration = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const getBlockedUserIds = useCallback(async (): Promise<string[]> => {
    if (!user) return [];
    try {
      const { data } = await supabase.rpc('get_blocked_user_ids', { p_user_id: user.id });
      return (data as string[]) ?? [];
    } catch {
      return [];
    }
  }, [user]);

  const getMutedUserIds = useCallback(async (): Promise<string[]> => {
    if (!user) return [];
    try {
      const { data } = await supabase.rpc('get_muted_user_ids', { p_user_id: user.id });
      return (data as string[]) ?? [];
    } catch {
      return [];
    }
  }, [user]);

  const blockUser = async (targetUserId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_moderation_actions')
        .insert({
          user_id: user.id,
          target_user_id: targetUserId,
          action_type: 'block',
        });

      if (error) {
        console.error('Error blocking user:', error);
        return false;
      }
      return true;
    } finally {
      setLoading(false);
    }
  };

  const muteUser = async (targetUserId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_moderation_actions')
        .insert({
          user_id: user.id,
          target_user_id: targetUserId,
          action_type: 'mute',
        });

      if (error) {
        console.error('Error muting user:', error);
        return false;
      }
      return true;
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (targetUserId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_moderation_actions')
        .delete()
        .eq('user_id', user.id)
        .eq('target_user_id', targetUserId)
        .eq('action_type', 'block');

      if (error) {
        console.error('Error unblocking user:', error);
        return false;
      }
      return true;
    } finally {
      setLoading(false);
    }
  };

  const unmuteUser = async (targetUserId: string) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_moderation_actions')
        .delete()
        .eq('user_id', user.id)
        .eq('target_user_id', targetUserId)
        .eq('action_type', 'mute');

      if (error) {
        console.error('Error unmuting user:', error);
        return false;
      }
      return true;
    } finally {
      setLoading(false);
    }
  };

  const reportMessage = async (report: UserReport) => {
    if (!user) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: user.id,
          reported_message_id: report.messageId,
          reported_user_id: report.reportedUserId,
          group_id: report.groupId ?? null,
          chat_type: report.chatType,
          report_reason: report.reason,
          additional_context: report.additionalContext,
          status: 'pending',
        });

      if (error) {
        console.error('Error reporting message:', error);
        return false;
      }

      return true;
    } finally {
      setLoading(false);
    }
  };

  const checkUserStatus = async (userId: string) => {
    try {
      const { data: shadowMuted } = await supabase.rpc('is_user_shadow_muted', {
        user_id_param: userId,
      });

      const { data: lockedOut } = await supabase.rpc('is_user_locked_out', {
        user_id_param: userId,
      });

      return {
        isShadowMuted: !!shadowMuted,
        isLockedOut: !!lockedOut,
      };
    } catch (error) {
      console.error('Error checking user status:', error);
      return {
        isShadowMuted: false,
        isLockedOut: false,
      };
    }
  };

  const checkCanSendMessage = async () => {
    if (!user) return { allowed: false, reason: 'not_authenticated' };

    const status = await checkUserStatus(user.id);
    if (status.isLockedOut) {
      return { allowed: false, reason: 'account_restricted' };
    }

    try {
      const { data, error } = await supabase.rpc('check_message_rate_limit', {
        p_user_id: user.id,
      });

      if (error) throw error;
      return data as { allowed: boolean; reason?: string; retry_after_seconds?: number };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return { allowed: true };
    }
  };

  return {
    loading,
    blockUser,
    muteUser,
    unblockUser,
    unmuteUser,
    reportMessage,
    checkUserStatus,
    checkCanSendMessage,
    getBlockedUserIds,
    getMutedUserIds,
  };
};
