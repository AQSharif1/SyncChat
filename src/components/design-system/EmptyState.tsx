import { type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center py-6 px-2', className)}>
      <div
        className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4"
        aria-hidden="true"
      >
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-5">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="lg" className="w-full max-w-xs">
          {action.label}
        </Button>
      )}
    </div>
  );
}
