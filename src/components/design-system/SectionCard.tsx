import { cn } from '@/lib/utils';

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onClick?: () => void;
}

const paddingMap = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export function SectionCard({
  children,
  className,
  padding = 'md',
  interactive = false,
  onClick,
}: SectionCardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border/60 bg-card text-left w-full',
        paddingMap[padding],
        interactive && 'transition-all duration-200 hover:border-border hover:bg-card-hover active:scale-[0.99]',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </Component>
  );
}
