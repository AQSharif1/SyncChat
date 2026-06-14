import { Home, MessageCircle, BookOpen, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppTab = 'home' | 'community' | 'memories' | 'profile';

interface BottomNavProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
}

const tabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'community', label: 'Community', icon: MessageCircle },
  { id: 'memories', label: 'Memories', icon: BookOpen },
  { id: 'profile', label: 'Profile', icon: User },
];

export function BottomNav({ activeTab, onNavigate }: BottomNavProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-md safe-area-inset-bottom md:hidden"
      aria-label="Main navigation"
    >
      <div className="max-w-lg mx-auto px-2">
        <ul className="flex items-stretch justify-around h-[3.5rem]">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <li key={id} className="flex-1">
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 w-full h-full min-h-[44px] rounded-lg transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="relative flex items-center justify-center">
                    {isActive && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        'w-5 h-5 transition-all duration-150',
                        isActive ? 'scale-105' : 'scale-100'
                      )}
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden="true"
                    />
                  </div>
                  <span
                    className={cn(
                      'text-[10px] transition-all duration-150',
                      isActive
                        ? 'font-semibold text-primary'
                        : 'font-medium text-muted-foreground'
                    )}
                  >
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
