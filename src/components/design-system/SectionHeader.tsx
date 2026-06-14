import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <h2
      className={cn(
        'text-xs font-medium uppercase tracking-wider text-muted-foreground px-1',
        className
      )}
    >
      {children}
    </h2>
  );
}
