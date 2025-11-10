import type { FilteredPlayerData } from './dataFilterService';

/**
 * MBTI维度得分
 */
export interface MBTIScores {
  E: number; // Extroversion - 外向：主动参与团战
  I: number; // Introversion - 内向：独立发育
  S: number; // Sensing - 实感：稳定输出
  N: number; // Intuition - 直觉：高风险高回报
  T: number; // Thinking - 思考：效率优先
  F: number; // Feeling - 情感：团队支持
  J: number; // Judging - 判断：计划性
  P: number; // Perceiving - 感知：灵活应变
}

/**
 * 从游戏数据计算MBTI得分
 */
export function calculateMBTIScores(games: FilteredPlayerData[]): MBTIScores {
  const scores: MBTIScores = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
  
  for (const game of games) {
    const kda = (game.kills + game.assists) / Math.max(game.deaths, 1);
    const killParticipation = (game.kills + game.assists) / Math.max(game.kills + game.assists + 1, 1);
    const damagePerMin = game.totalDamageDealtToChampions / (game.gameDuration / 60);
    const visionPerMin = game.visionScore / (game.gameDuration / 60);
    const goldPerMin = game.goldEarned / (game.gameDuration / 60);
    
    // E vs I: 团战参与 vs 独立发育
    if (game.assists > game.kills) {
      scores.E += 2; // 高助攻 = 团队参与
    } else {
      scores.I += 1; // 高击杀 = 独立carry
    }
    
    if (killParticipation > 0.6) {
      scores.E += 1; // 参与率高
    } else {
      scores.I += 1; // 独立发育
    }
    
    // S vs N: 稳定 vs 冒险
    if (game.deaths <= 3) {
      scores.S += 2; // 低死亡 = 稳健
    } else if (game.deaths >= 8) {
      scores.N += 2; // 高死亡 = 激进
    }
    
    if (kda >= 3) {
      scores.S += 1; // 高KDA = 稳定
    } else if (kda < 1.5) {
      scores.N += 1; // 低KDA = 冒险
    }
    
    // T vs F: 输出 vs 支援
    if (damagePerMin > 500) {
      scores.T += 2; // 高伤害 = 效率导向
    }
    
    if (visionPerMin > 1.5) {
      scores.F += 2; // 高视野 = 团队支持
    }
    
    if (game.position === 'UTILITY') {
      scores.F += 2; // 辅助位 = 支援型
    } else if (game.position === 'MIDDLE' || game.position === 'BOTTOM') {
      scores.T += 1; // Carry位 = 输出型
    }
    
    // J vs P: 计划 vs 灵活
    if (goldPerMin > 400) {
      scores.J += 1; // 高经济 = 有计划的发育
    }
    
    if (game.visionScore > 30) {
      scores.J += 1; // 高视野 = 有规划
    }
    
    const championVariety = new Set(games.map(g => g.championName)).size;
    if (championVariety > games.length * 0.5) {
      scores.P += 2; // 英雄池广 = 灵活应变
    } else {
      scores.J += 1; // 专精少数英雄 = 计划性
    }
  }
  
  return scores;
}

/**
 * 从得分确定MBTI类型
 */
export function determineMBTI(scores: MBTIScores): string {
  return (
    (scores.E > scores.I ? 'E' : 'I') +
    (scores.N > scores.S ? 'N' : 'S') +
    (scores.T > scores.F ? 'T' : 'F') +
    (scores.P > scores.J ? 'P' : 'J')
  );
}

/**
 * 关键数据到MBTI的映射逻辑
 */
export const MBTI_MAPPING = {
  // E (外向) - 团队参与型
  E: [
    'assists > kills → 更多助攻说明参与团战',
    'killParticipation > 60% → 高参与率',
    'teamPosition = UTILITY → 辅助位天然团队型',
  ],
  
  // I (内向) - 独立发育型
  I: [
    'kills > assists → 更多单杀',
    'killParticipation < 40% → 独立carry',
    'totalMinionsKilled高 → 专注发育',
  ],
  
  // S (实感) - 稳健型
  S: [
    'deaths低 (≤3) → 谨慎不送',
    'kda高 (≥3) → 稳定输出',
    'win rate稳定 → 可靠',
  ],
  
  // N (直觉) - 激进型
  N: [
    'deaths高 (≥8) → 激进换血',
    'kda波动大 → 高风险高回报',
    'kills极高或极低 → 不稳定',
  ],
  
  // T (思考) - 效率型
  T: [
    'damagePerMinute高 → 输出效率',
    'goldPerMinute高 → 经济效率',
    'totalDamageDealtToChampions高 → 伤害优先',
  ],
  
  // F (情感) - 支援型
  F: [
    'visionScore高 → 视野支持',
    'assists高 → 帮助队友',
    'position = UTILITY → 辅助角色',
  ],
  
  // J (判断) - 计划型
  J: [
    'goldPerMinute稳定 → 有规划的发育',
    'visionScore高 → 提前布局',
    '专精少数英雄 → 计划性强',
  ],
  
  // P (感知) - 灵活型
  P: [
    '英雄池广 → 适应性强',
    'position多变 → 灵活补位',
    'championName多样 → 随机应变',
  ],
};
