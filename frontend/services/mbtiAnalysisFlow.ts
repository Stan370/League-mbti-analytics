/**
 * 完整的数据处理到MBTI分析流程
 * 
 * 数据流: 原始Match (150字段) → 过滤数据 (20字段) → MBTI得分 (8维度) → 性格类型 (4字母)
 */

import type { MatchDto } from '../types/riotApiTypes';
import { ALLOWED_QUEUE_IDS } from '../types/riotApiTypes';
import { extractPlayerData, type FilteredPlayerData } from './dataFilterService';
import { calculateMBTIScores, determineMBTI, type MBTIScores } from './mbtiMappingService';

/**
 * 完整分析结果
 */
export interface MBTIAnalysisResult {
  mbtiType: string;
  scores: MBTIScores;
  confidence: number;
  insights: string[];
  rawDataCount: number;
}

/**
 * 从原始matches到MBTI类型的完整流程
 */
export async function analyzeMBTIFromMatches(
  matches: MatchDto[],
  puuid: string
): Promise<MBTIAnalysisResult> {
  
  // 步骤1: 数据过滤 (150字段 → 20字段)
  // 只处理 gameType === "MATCHED_GAME" 且 queueId 在允许范围内的比赛
  const filtered: FilteredPlayerData[] = [];
  for (const match of matches) {
    // 验证 gameType
    if (!match.info || match.info.gameType !== "MATCHED_GAME") {
      continue;
    }
    // 验证 queueId
    if (!match.info.queueId || !ALLOWED_QUEUE_IDS.includes(match.info.queueId)) {
      continue;
    }
    const data = extractPlayerData(match, puuid);
    if (data) {
      filtered.push(data);
    }
  }
  
  // 步骤2: 计算MBTI得分
  const scores = calculateMBTIScores(filtered);
  
  // 步骤3: 确定MBTI类型
  const mbtiType = determineMBTI(scores);
  
  // 步骤4: 计算置信度
  const confidence = calculateConfidence(scores);
  
  // 步骤5: 生成洞察
  const insights = generateInsights(filtered, scores, mbtiType);
  
  return {
    mbtiType,
    scores,
    confidence,
    insights,
    rawDataCount: filtered.length,
  };
}

/**
 * 计算置信度 - 基于得分差异
 */
function calculateConfidence(scores: MBTIScores): number {
  const diffs = [
    Math.abs(scores.E - scores.I),
    Math.abs(scores.N - scores.S),
    Math.abs(scores.T - scores.F),
    Math.abs(scores.P - scores.J),
  ];
  
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return Math.min(avgDiff / 10, 1); // 归一化到0-1
}

/**
 * 生成个性化洞察
 */
function generateInsights(
  games: FilteredPlayerData[],
  scores: MBTIScores,
  mbtiType: string
): string[] {
  const insights: string[] = [];
  
  const avgKDA = games.reduce((sum, g) => 
    sum + (g.kills + g.assists) / Math.max(g.deaths, 1), 0) / games.length;
  
  const avgAssists = games.reduce((sum, g) => sum + g.assists, 0) / games.length;
  const avgKills = games.reduce((sum, g) => sum + g.kills, 0) / games.length;
  
  // E vs I 洞察
  if (scores.E > scores.I) {
    insights.push(`团队型玩家：平均 ${avgAssists.toFixed(1)} 助攻，喜欢参与团战`);
  } else {
    insights.push(`独立型玩家：平均 ${avgKills.toFixed(1)} 击杀，擅长单带carry`);
  }
  
  // S vs N 洞察
  if (scores.S > scores.N) {
    insights.push(`稳健型：KDA ${avgKDA.toFixed(2)}，注重生存和稳定输出`);
  } else {
    insights.push(`激进型：敢于冒险换血，追求高光时刻`);
  }
  
  // T vs F 洞察
  const avgVision = games.reduce((sum, g) => sum + g.visionScore, 0) / games.length;
  if (scores.T > scores.F) {
    insights.push(`效率导向：专注伤害和经济，追求个人表现`);
  } else {
    insights.push(`支援型：平均视野 ${avgVision.toFixed(1)}，为团队提供支持`);
  }
  
  // J vs P 洞察
  const championPool = new Set(games.map(g => g.championName)).size;
  if (scores.J > scores.P) {
    insights.push(`计划型：专精 ${championPool} 个英雄，有明确的游戏规划`);
  } else {
    insights.push(`灵活型：英雄池 ${championPool} 个，适应性强`);
  }
  
  return insights;
}

/**
 * 数据压缩示例
 */
export function demonstrateDataReduction(matches: MatchDto[], puuid: string) {
  // 原始数据大小估算
  const rawFieldsPerMatch = 150; // 每个participant约150个字段
  const rawTotalFields = matches.length * rawFieldsPerMatch;
  
  // 过滤后数据大小
  const filteredFieldsPerMatch = 20;
  const filteredTotalFields = matches.length * filteredFieldsPerMatch;
  
  // MBTI得分
  const mbtiFields = 8;
  
  console.log('数据压缩流程:');
  console.log(`原始数据: ${rawTotalFields.toLocaleString()} 个字段`);
  console.log(`过滤后: ${filteredTotalFields.toLocaleString()} 个字段 (减少 ${((1 - filteredTotalFields/rawTotalFields) * 100).toFixed(1)}%)`);
  console.log(`MBTI得分: ${mbtiFields} 个维度 (减少 ${((1 - mbtiFields/rawTotalFields) * 100).toFixed(3)}%)`);
  console.log(`最终结果: 4个字母 (MBTI类型)`);
}
