import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, Home, BookOpen, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppTab } from './BottomNav';

interface NavigationBarProps {
  className?: string;
  isMobile?: boolean;
  activeTab?: AppTab;
}

const desktopTabs: { id: AppTab; label: string; path: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', path: '/home', icon: Home },
  { id: 'community', label: 'Community', path: '/community', icon: MessageCircle },
  { id: 'memories', label: 'Memories', path: '/memories', icon: BookOpen },
  { id: 'profile', label: 'Profile', path: '/profile', icon: User },
];

export const NavigationBar = ({
  className = '',
  isMobile = false,
  activeTab,
}: NavigationBarProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (isMobile) {
    return null;
  }

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/60',
        className
      )}
      aria-label="App navigation"
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-base font-semibold text-foreground tracking-tight">SyncChat</span>
          </button>

          {user && (
            <ul className="flex items-center gap-1" role="list">
              {desktopTabs.map(({ id, label, path, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => navigate(path)}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      )}
                    >
                      <Icon className="w-4 h-4" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </nav>
  );
};
