import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { analyticsClient } from '@/utils/analytics';

export const AppAnalyticsListener = () => {
  const { user } = useAuth();
  const sessionStartRef = useRef(Date.now());
  const trackedOpenRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    analyticsClient.identify(user.id);
    if (!trackedOpenRef.current) {
      analyticsClient.trackAppOpened();
      trackedOpenRef.current = true;
    }
  }, [user]);

  useEffect(() => {
    const handleBackground = () => {
      analyticsClient.trackAppBackgrounded();
      sessionStartRef.current = Date.now();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        handleBackground();
      } else if (user) {
        analyticsClient.trackAppOpened();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleBackground);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleBackground);
    };
  }, [user]);

  return null;
};
