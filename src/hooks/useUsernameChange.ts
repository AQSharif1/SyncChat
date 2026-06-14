import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { usePremium } from '@/hooks/usePremium';

interface UsernameChangeData {
  canChange: boolean;
  isFirstTime: boolean;
  isPremium: boolean;
  loading: boolean;
}

export const useUsernameChange = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isPremium, canChangeUsername } = usePremium();
  const [changeData, setChangeData] = useState<UsernameChangeData>({
    canChange: false,
    isFirstTime: true,
    isPremium: false,
    loading: true,
  });

  useEffect(() => {
    if (user) {
      fetchChangeData();
    }
  }, [user, isPremium]);

  const fetchChangeData = async () => {
    if (!user) return;

    try {
      setChangeData((prev) => ({ ...prev, loading: true }));

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username_changed')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      const hasChanged = Boolean(profile.username_changed);
      const canChange = canChangeUsername(hasChanged);

      setChangeData({
        canChange,
        isFirstTime: !hasChanged,
        isPremium,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching username change data:', error);
      setChangeData((prev) => ({ ...prev, loading: false }));
    }
  };

  const changeUsername = async (newUsername: string) => {
    if (!user) return false;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('username_changed')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      if (!canChangeUsername(Boolean(profile.username_changed))) {
        toast({
          title: 'Cannot Change Username',
          description: isPremium
            ? 'Unable to change username right now.'
            : "You've used your one free username change. Upgrade for unlimited changes.",
          variant: 'destructive',
        });
        return false;
      }

      if (!newUsername.trim() || newUsername.length < 3) {
        toast({
          title: 'Invalid Username',
          description: 'Username must be at least 3 characters long.',
          variant: 'destructive',
        });
        return false;
      }

      if (newUsername.length > 20) {
        toast({
          title: 'Username Too Long',
          description: 'Username must be 20 characters or less.',
          variant: 'destructive',
        });
        return false;
      }

      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', newUsername.trim())
        .neq('user_id', user.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        toast({
          title: 'Username Taken',
          description: 'This username is already taken. Please choose another.',
          variant: 'destructive',
        });
        return false;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          username: newUsername.trim(),
          username_changed: true,
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      await fetchChangeData();

      toast({
        title: 'Username Changed!',
        description: isPremium
          ? `Your username has been updated to "${newUsername}".`
          : `Your username has been updated to "${newUsername}". This was your one free change.`,
      });

      return true;
    } catch (error) {
      console.error('Error changing username:', error);
      toast({
        title: 'Error',
        description: 'Failed to change username. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    ...changeData,
    changeUsername,
    refreshChangeData: fetchChangeData,
  };
};
