import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  Crown,
  Compass,
  Heart,
  Palette,
  RefreshCw,
  Archive,
  User,
} from 'lucide-react';
import { usePremium } from '@/hooks/usePremium';
import { SectionCard } from '@/components/design-system/SectionCard';
import { cn } from '@/lib/utils';

interface PremiumUpgradeProps {
  onClose?: () => void;
}

const benefitCategories = [
  {
    title: 'Community Freedom',
    icon: RefreshCw,
    items: [
      'Unlimited group switches',
      'Priority matching queue',
      'Early access to new features',
    ],
  },
  {
    title: 'Deeper History',
    icon: Archive,
    items: [
      'Full archive of all past seasons',
      'Extended community history',
      'Enhanced season memories',
    ],
  },
  {
    title: 'Personalization & Chat',
    icon: User,
    items: [
      'Unlimited username changes',
      'Chat with more people at once',
      'Reconnect with past members',
    ],
  },
];

const freeIncludes = [
  'Join a community',
  'Full chat participation',
  '3 active DM conversations',
  '1 group switch per season',
  'Current season memories',
];

export const PremiumUpgrade = ({ onClose }: PremiumUpgradeProps) => {
  const { createCheckout, isPremium, isTrialing, openCustomerPortal } = usePremium();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (planType: 'monthly' | 'yearly', trial = false) => {
    setLoading(planType);
    await createCheckout(planType, trial);
    setLoading(null);
  };

  if (isPremium || isTrialing) {
    return (
      <div className="space-y-6 p-1">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Premium Active</h2>
          <p className="text-sm text-muted-foreground">
            {isTrialing ? "You're on a free trial" : 'You have access to all premium benefits'}
          </p>
        </div>

        <div className="space-y-3">
          {benefitCategories.map((cat) => (
            <SectionCard key={cat.title} padding="sm" className="space-y-2">
              <div className="flex items-center gap-2">
                <cat.icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{cat.title}</span>
              </div>
              <ul className="space-y-1">
                {cat.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>

        <div className="flex gap-3">
          <Button onClick={openCustomerPortal} variant="outline" className="flex-1">
            Manage Subscription
          </Button>
          {onClose && (
            <Button onClick={onClose} className="flex-1">
              Continue
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">SyncChat Premium</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Go deeper with your communities. Free stays complete — Premium adds freedom, history, and priority matching.
        </p>
      </div>

      <SectionCard padding="sm" className="bg-muted/30">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Free includes
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {freeIncludes.map((item) => (
            <div key={item} className="flex items-center gap-1.5 text-xs text-foreground">
              <Check className="h-3 w-3 text-primary flex-shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="space-y-3">
        {benefitCategories.map((cat) => (
          <SectionCard key={cat.title} padding="sm" className="space-y-2">
            <div className="flex items-center gap-2">
              <cat.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{cat.title}</span>
            </div>
            <ul className="space-y-1.5">
              {cat.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </SectionCard>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SectionCard padding="md" className="space-y-4">
          <div>
            <p className="text-sm font-medium">Monthly</p>
            <p className="text-2xl font-semibold mt-1">
              $9.99<span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => handleUpgrade('monthly')}
            disabled={loading === 'monthly'}
          >
            {loading === 'monthly' ? 'Processing...' : 'Get Monthly'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => handleUpgrade('monthly', true)}
            disabled={loading === 'monthly'}
          >
            Start 3-day free trial
          </Button>
        </SectionCard>

        <SectionCard padding="md" className={cn('space-y-4 relative border-primary/40')}>
          <Badge className="absolute -top-2.5 left-4 text-[10px]">Best value</Badge>
          <div>
            <p className="text-sm font-medium">Yearly</p>
            <p className="text-2xl font-semibold mt-1">
              $79.99<span className="text-sm font-normal text-muted-foreground">/yr</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Save 33%</p>
          </div>
          <Button
            className="w-full"
            onClick={() => handleUpgrade('yearly')}
            disabled={loading === 'yearly'}
          >
            {loading === 'yearly' ? 'Processing...' : 'Get Yearly'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => handleUpgrade('yearly', true)}
            disabled={loading === 'yearly'}
          >
            Start 3-day free trial
          </Button>
        </SectionCard>
      </div>

      <p className="text-[11px] text-center text-muted-foreground leading-relaxed px-2">
        Premium enhances your experience — DMs stay open on free, with room to grow on Premium.
      </p>

      {onClose && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            Maybe later
          </Button>
        </div>
      )}
    </div>
  );
};
