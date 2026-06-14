import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Award } from 'lucide-react';
import { useCommunityReputation } from '@/hooks/useCommunityReputation';
import { getNextTier, getTierInfo } from '@/types/communityReputation';

interface CommunityReputationCardProps {
  userId?: string;
  compact?: boolean;
}

export const CommunityReputationCard = ({ userId, compact = false }: CommunityReputationCardProps) => {
  const { score, tier, tier_label, achievements, loading } = useCommunityReputation(userId);

  if (loading) {
    return (
      <Card className="border-primary/10">
        <CardContent className="p-4 text-sm text-muted-foreground">Loading reputation...</CardContent>
      </Card>
    );
  }

  const tierInfo = getTierInfo(tier);
  const nextTier = getNextTier(score);
  const progressToNext = nextTier
    ? Math.min(100, ((score - tierInfo.minScore) / (nextTier.minScore - tierInfo.minScore)) * 100)
    : 100;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <span className="text-xl">{tierInfo.icon}</span>
        <div>
          <p className="text-sm font-medium">{tier_label}</p>
          <p className="text-xs text-muted-foreground">{score} reputation points</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Community Reputation</CardTitle>
          </div>
          <Badge className={`bg-gradient-to-r ${tierInfo.color} text-white border-0`}>
            {tierInfo.icon} {tier_label}
          </Badge>
        </div>
        <CardDescription>
          Built through positive participation — never from popularity or disagreements.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Reputation score</span>
            <span className="font-medium">{score}</span>
          </div>
          {nextTier && (
            <>
              <Progress value={progressToNext} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {nextTier.minScore - score} points to {nextTier.label}
              </p>
            </>
          )}
        </div>

        {achievements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Award className="h-4 w-4 text-primary" />
              Contribution Badges
            </div>
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => (
                <Badge key={a.key} variant="secondary" className="gap-1" title={a.description}>
                  {a.icon} {a.title}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
