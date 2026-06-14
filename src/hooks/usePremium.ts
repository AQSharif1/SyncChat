import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { analyticsClient } from '@/utils/analytics';

export interface PremiumData {
  subscribed: boolean;
  subscription_tier: string | null;
  subscription_end: string | null;
  trial_end: string | null;
}

export interface DMAllowanceContext {
  activeConversationCount: number;
  totalConversationCount: number;
  accountAgeDays: number;
  isNewConversation: boolean;
}

export const FREE_ACTIVE_DM_LIMIT = 3;
export const FREE_FIRST_WEEK_TOTAL_LIMIT = 5;
export const FREE_FIRST_WEEK_DAYS = 7;

export const usePremium = () => {
  const { user } = useAuth();
  const [premium, setPremium] = useState<PremiumData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      setPremium(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCheckout = async (planType: 'monthly' | 'yearly', trial = false, source = 'checkout') => {
    if (!user) return;

    analyticsClient.track('premium_upgrade_started', { source });

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planType, trial },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error creating checkout:', error);
        return;
      }

      const checkoutWindow = window.open(data.url, '_blank');

      if (checkoutWindow) {
        startSubscriptionPolling();
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
    }
  };

  const startSubscriptionPolling = useCallback(() => {
    if (!user) return;

    const pollInterval = setInterval(async () => {
      try {
        await checkSubscription();

        if (premium?.subscribed) {
          clearInterval(pollInterval);
          analyticsClient.track('premium_upgrade_completed', {
            plan: 'monthly',
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    setTimeout(() => {
      clearInterval(pollInterval);
    }, 300000);

    return () => clearInterval(pollInterval);
  }, [user, premium]);

  const openCustomerPortal = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error opening customer portal:', error);
        return;
      }

      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error opening customer portal:', error);
    }
  };

  const isPremiumUser = premium?.subscribed || false;

  const canUseFeature = () => isPremiumUser;

  const canSendDM = (context: DMAllowanceContext): boolean => {
    if (isPremiumUser) return true;

    if (context.isNewConversation) {
      if (
        context.accountAgeDays <= FREE_FIRST_WEEK_DAYS &&
        context.totalConversationCount < FREE_FIRST_WEEK_TOTAL_LIMIT
      ) {
        return true;
      }
    }

    return context.activeConversationCount < FREE_ACTIVE_DM_LIMIT;
  };

  const shouldShowDMUpsell = (context: DMAllowanceContext): boolean => {
    if (isPremiumUser) return false;
    if (canSendDM(context)) return false;
    return context.activeConversationCount >= FREE_ACTIVE_DM_LIMIT;
  };

  const canSwitchGroup = (switchesThisSeason: number): boolean => {
    if (isPremiumUser) return true;
    return switchesThisSeason < 1;
  };

  const canViewArchivedSeason = (): boolean => isPremiumUser;

  const canChangeUsername = (hasChangedBefore: boolean): boolean => {
    if (isPremiumUser) return true;
    return !hasChangedBefore;
  };

  return {
    premium,
    loading,
    isPremium: isPremiumUser,
    isTrialing: premium?.trial_end ? new Date(premium.trial_end) > new Date() : false,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    canUseFeature,
    canSendDM,
    shouldShowDMUpsell,
    canSwitchGroup,
    canViewArchivedSeason,
    canChangeUsername,
  };
};
