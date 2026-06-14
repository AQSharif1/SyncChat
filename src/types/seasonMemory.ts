export type RecapType = 'monthly' | 'milestone' | 'final';

export type SeasonContinuationChoice = 'stay' | 'refresh' | 'memories_only';

export type MemoryType =
  | 'achievement'
  | 'milestone'
  | 'community_growth'
  | 'activity_highlight'
  | 'identity_highlight';

export interface GroupSeason {
  id: string;
  group_id: string;
  season_number: number;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SeasonRecap {
  id: string;
  group_id: string;
  season_id: string;
  recap_text: string;
  recap_type: RecapType;
  generated_at: string;
}

export interface SeasonMemory {
  id: string;
  group_id: string;
  season_id: string;
  memory_type: MemoryType;
  memory_text: string;
  created_at: string;
}

export interface SeasonTimelineEvent {
  id: string;
  group_id: string;
  season_id: string;
  event_type: string;
  event_label: string;
  created_at: string;
}

export interface SeasonMemoriesData {
  activeSeason: GroupSeason | null;
  latestRecap: SeasonRecap | null;
  recentMemories: SeasonMemory[];
  timelineEvents: SeasonTimelineEvent[];
  pastRecaps: SeasonRecap[];
  loading: boolean;
}
