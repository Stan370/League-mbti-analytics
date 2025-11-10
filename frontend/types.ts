import type { ReactNode } from 'react';

export interface ChampionData {
  name: string;
  gamesPlayed: number;
  winRate: number;
  kda: string;
  imageUrl: string;
  playstyleAnalysis: string;
}

export interface GrowthDataPoint {
  month: string;
  winRate: number;
  kda: number;
}

import type { FilteredPlayerData } from './services/dataFilterService';

export interface MatchData extends FilteredPlayerData {
  matchId: string;
  gameEndTimestamp: number;
  queueId: number;
}

export interface AggregatedSummary {
  totalGames: number;
  wins: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgKDA: number;
  avgCS: number;
  avgTotalCS: number;
  avgDamage: number;
  avgGold: number;
  avgVisionScore: number;
  avgDamagePerMin: number;
  avgGoldPerMin: number;
}

export interface AnalysisResult {
  summonerName: string;
  tag: string;
  archetype: {
    title: string;
    mbti: string;
    description: string;
    imageUrl: string;
  };
  strengths: {
    title: string;
    description: string;
    // Fix: Use the imported ReactNode type to resolve the 'Cannot find namespace React' error.
    icon: ReactNode;
  }[];
  growthCurve: GrowthDataPoint[];
  topChampions: ChampionData[];
  matchData: MatchData[];
  aggregatedSummary: AggregatedSummary;
}
