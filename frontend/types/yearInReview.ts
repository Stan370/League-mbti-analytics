// 年度回顾数据结构 - 参考 Spotify Wrapped 模式
export interface YearInReview2025 {
  // 基础统计
  totalGames: number;
  totalHoursPlayed: number;
  winRate: number;
  
  // Top 3 模式（最吸引人的展示方式）
  topChampions: Array<{
    name: string;
    games: number;
    winRate: number;
    iconUrl: string;
  }>;
  
  // 时间线趋势（按月聚合）
  monthlyProgress: Array<{
    month: string; // "2025-01", "2025-02"...
    games: number;
    winRate: number;
    avgKDA: number;
  }>;
  
  // 里程碑时刻（AI 生成的故事点）
  milestones: Array<{
    title: string; // "Your Breakthrough Moment"
    description: string; // AI 生成的叙述
    matchId?: string;
    timestamp: number;
  }>;
  
  // AI 生成的个性化洞察
  aiInsights: {
    playstyle: string; // "You evolved from a cautious player to an aggressive carry"
    strengths: string[]; // ["Exceptional vision control", "Clutch teamfighting"]
    growthAreas: string[]; // ["Early game consistency", "Champion pool diversity"]
    prediction: string; // "In 2026, you're ready to climb to Diamond"
  };
}
