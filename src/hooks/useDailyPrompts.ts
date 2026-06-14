import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DailyPrompt {
  id: string;
  group_id: string;
  prompt_text: string;
  prompt_type: string;
  expires_at: Date;
  created_at: Date;
  message_id?: string | null;
  reply_count?: number;
  reaction_count?: number;
  engagement_score?: number;
}

export const useDailyPrompts = (groupId?: string) => {
  const [prompts, setPrompts] = useState<DailyPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivePrompts = useCallback(async () => {
    if (!groupId) {
      setPrompts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('daily_prompts')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching daily prompts:', error);
        return;
      }

      setPrompts(
        data?.map((prompt) => ({
          id: prompt.id,
          group_id: prompt.group_id,
          prompt_text: prompt.prompt_text,
          prompt_type: prompt.prompt_type,
          expires_at: new Date(prompt.expires_at),
          created_at: new Date(prompt.created_at),
          message_id: prompt.message_id,
          reply_count: prompt.reply_count,
          reaction_count: prompt.reaction_count,
          engagement_score: prompt.engagement_score,
        })) || []
      );
    } catch (error) {
      console.error('Error fetching daily prompts:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchActivePrompts();
  }, [fetchActivePrompts]);

  const getTodaysPrompt = (): DailyPrompt | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysPrompts = prompts.filter((prompt) => {
      const promptDate = new Date(prompt.created_at);
      promptDate.setHours(0, 0, 0, 0);
      return promptDate.getTime() === today.getTime();
    });

    return todaysPrompts.length > 0 ? todaysPrompts[0] : null;
  };

  return {
    prompts,
    loading,
    getTodaysPrompt,
    refresh: fetchActivePrompts,
  };
};
