import type { MatchDto, ParticipantDto } from '../types/riotApiTypes';
import { ALLOWED_QUEUE_IDS } from '../types/riotApiTypes';

// 精简的玩家数据结构 - 只保留关键指标
export interface FilteredPlayerData {
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number; // CS (补刀)
  neutralMinionsKilled: number; // 野怪数 (加上 totalMinionsKilled 可以得到总 CS)
  totalDamageDealtToChampions: number; // 对英雄伤害
  goldEarned: number;
  championName: string;
  teamId: number;
  win: boolean;
  position: string; // teamPosition
  visionScore: number;
  gameDuration: number;
  gameMode: string;
}

// 批量处理配置
export interface BatchConfig {
  batchSize: number;  // 每批处理的match数量
  maxMatches: number; // 最大处理数量
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 50,
  maxMatches: 200,
};

/**
 * 从完整match数据中提取单个玩家的关键信息
 */
export function extractPlayerData(
  match: MatchDto,
  puuid: string
): FilteredPlayerData | null {
  const participant = match.info.participants.find(p => p.puuid === puuid);
  if (!participant) return null;

  return {
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    totalMinionsKilled: participant.totalMinionsKilled, // CS (补刀)
    neutralMinionsKilled: participant.neutralMinionsKilled, // 野怪数
    totalDamageDealtToChampions: participant.totalDamageDealtToChampions, // 对英雄伤害
    goldEarned: participant.goldEarned,
    championName: participant.championName,
    teamId: participant.teamId,
    win: participant.win,
    position: participant.teamPosition || participant.individualPosition,
    visionScore: participant.visionScore,
    gameDuration: match.info.gameDuration,
    gameMode: match.info.gameMode,
  };
}

/**
 * 批量过滤matches，只保留关键数据
 */
export function batchFilterMatches(
  matches: MatchDto[],
  puuid: string,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): FilteredPlayerData[] {
  const filtered: FilteredPlayerData[] = [];
  const limit = Math.min(matches.length, config.maxMatches);

  for (let i = 0; i < limit; i++) {
    const match = matches[i];
    // 验证 gameType 和 queueId
    if (!match.info || match.info.gameType !== "MATCHED_GAME") {
      continue;
    }
    if (!match.info.queueId || !ALLOWED_QUEUE_IDS.includes(match.info.queueId)) {
      continue;
    }
    const data = extractPlayerData(match, puuid);
    if (data) {
      filtered.push(data);
    }
  }

  return filtered;
}

/**
 * 流式处理 - 边获取边处理，避免内存占用过大
 */
export async function streamProcessMatches(
  matchIds: string[],
  puuid: string,
  fetchMatch: (id: string) => Promise<MatchDto>,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): Promise<FilteredPlayerData[]> {
  const results: FilteredPlayerData[] = [];
  const limit = Math.min(matchIds.length, config.maxMatches);

  for (let i = 0; i < limit; i += config.batchSize) {
    const batch = matchIds.slice(i, Math.min(i + config.batchSize, limit));
    const matches = await Promise.all(batch.map(id => fetchMatch(id)));

    for (const match of matches) {
      // 验证 gameType 和 queueId
      if (!match.info || match.info.gameType !== "MATCHED_GAME") {
        continue;
      }
      if (!match.info.queueId || !ALLOWED_QUEUE_IDS.includes(match.info.queueId)) {
        continue;
      }
      const data = extractPlayerData(match, puuid);
      if (data) {
        results.push(data);
      }
    }
  }

  return results;
}

/**
 * 计算聚合统计 - 避免存储所有原始数据
 */
export interface AggregatedStats {
  totalGames: number;
  wins: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalDamage: number;
  totalGold: number;
  totalVisionScore: number;
  championPool: Map<string, { games: number; wins: number }>;
  positionDistribution: Map<string, number>;
}

export function aggregateFilteredData(data: FilteredPlayerData[]): AggregatedStats {
  const stats: AggregatedStats = {
    totalGames: data.length,
    wins: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalAssists: 0,
    totalDamage: 0,
    totalGold: 0,
    totalVisionScore: 0,
    championPool: new Map(),
    positionDistribution: new Map(),
  };

  for (const game of data) {
    if (game.win) stats.wins++;
    stats.totalKills += game.kills;
    stats.totalDeaths += game.deaths;
    stats.totalAssists += game.assists;
    stats.totalDamage += game.totalDamageDealtToChampions;
    stats.totalGold += game.goldEarned;
    stats.totalVisionScore += game.visionScore;

    // 英雄池统计
    const champData = stats.championPool.get(game.championName) || { games: 0, wins: 0 };
    champData.games++;
    if (game.win) champData.wins++;
    stats.championPool.set(game.championName, champData);

    // 位置分布
    stats.positionDistribution.set(
      game.position,
      (stats.positionDistribution.get(game.position) || 0) + 1
    );
  }

  return stats;
}
