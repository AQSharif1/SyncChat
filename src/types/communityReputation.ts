export type ReputationTier =
  | 'new_member'
  | 'trusted_member'
  | 'community_builder'
  | 'community_leader'
  | 'community_pillar';

export interface ReputationTierInfo {
  tier: ReputationTier;
  label: string;
  icon: string;
  color: string;
  minScore: number;
}

export const REPUTATION_TIERS: ReputationTierInfo[] = [
  { tier: 'new_member', label: 'New Member', icon: '🌱', color: 'from-slate-400 to-slate-600', minScore: 0 },
  { tier: 'trusted_member', label: 'Trusted Member', icon: '🤝', color: 'from-blue-400 to-blue-600', minScore: 25 },
  { tier: 'community_builder', label: 'Community Builder', icon: '🏗️', color: 'from-emerald-400 to-teal-600', minScore: 50 },
  { tier: 'community_leader', label: 'Community Leader', icon: '⭐', color: 'from-purple-400 to-indigo-600', minScore: 100 },
  { tier: 'community_pillar', label: 'Community Pillar', icon: '🏛️', color: 'from-amber-400 to-orange-600', minScore: 200 },
];

export interface ReputationAchievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  unlocked_at: string;
}

export interface CommunityReputationData {
  score: number;
  tier: ReputationTier;
  tier_label: string;
  positive: number;
  negative: number;
  achievements: ReputationAchievement[];
  loading: boolean;
}

export function getTierInfo(tier: ReputationTier): ReputationTierInfo {
  return REPUTATION_TIERS.find((t) => t.tier === tier) ?? REPUTATION_TIERS[0];
}

export function getNextTier(score: number): ReputationTierInfo | null {
  for (let i = REPUTATION_TIERS.length - 1; i >= 0; i--) {
    if (score >= REPUTATION_TIERS[i].minScore && i < REPUTATION_TIERS.length - 1) {
      return REPUTATION_TIERS[i + 1];
    }
  }
  if (score < REPUTATION_TIERS[1].minScore) return REPUTATION_TIERS[1];
  return null;
}

/** Max 5% boost — compatibility remains primary */
export const REPUTATION_MATCH_BOOST: Record<ReputationTier, number> = {
  new_member: 0,
  trusted_member: 0.02,
  community_builder: 0.03,
  community_leader: 0.04,
  community_pillar: 0.05,
};
