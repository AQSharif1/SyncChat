import { Users } from 'lucide-react';
import { GROUP_MAX_MEMBERS_DISPLAY } from '@/types/groupIdentity';

export interface GroupIdentityDisplayProps {
  name: string;
  vibeLabel: string;
  description?: string | null;
  memberCount: number;
  maxMembers?: number;
  identityTags?: string[] | null;
  seasonNumber?: number | null;
  compact?: boolean;
  className?: string;
}

export function GroupIdentityDisplay({
  name,
  vibeLabel,
  description,
  memberCount,
  maxMembers = GROUP_MAX_MEMBERS_DISPLAY,
  identityTags,
  seasonNumber,
  compact = false,
  className = '',
}: GroupIdentityDisplayProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <h3
          className={`text-foreground tracking-tight ${
            compact ? 'text-lg font-bold' : 'group-name'
          }`}
        >
          {name}
        </h3>
        <p
          className={`mt-1 font-medium ${
            compact
              ? 'text-xs text-muted-foreground'
              : 'text-sm text-primary/80'
          }`}
        >
          {vibeLabel}
        </p>
      </div>

      {description && !compact && (
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      )}

      <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {memberCount} / {maxMembers} members
          </span>
        </div>
        {seasonNumber != null && (
          <span className="text-xs text-muted-foreground/80">Season {seasonNumber}</span>
        )}
      </div>

      {identityTags && identityTags.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1.5">
          {identityTags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-primary/8 text-primary/90 border border-primary/15"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
