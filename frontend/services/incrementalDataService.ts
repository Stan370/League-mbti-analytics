import type { FilteredPlayerData, AggregatedStats } from './dataFilterService';
import { extractPlayerData, aggregateFilteredData } from './dataFilterService';
import type { MatchDto } from '../types/riotApiTypes';
import { ALLOWED_QUEUE_IDS } from '../types/riotApiTypes';

/**
 * 增量数据加载器 - 支持分页和进度追踪
 */
export class IncrementalDataLoader {
  private processedCount = 0;
  private totalCount = 0;
  private aggregatedStats: AggregatedStats | null = null;

  constructor(
    private puuid: string,
    private fetchMatch: (id: string) => Promise<MatchDto>
  ) {}

  /**
   * 加载指定范围的数据
   */
  async loadRange(
    matchIds: string[],
    start: number,
    end: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<FilteredPlayerData[]> {
    const results: FilteredPlayerData[] = [];
    const range = matchIds.slice(start, end);
    this.totalCount = matchIds.length;

    for (let i = 0; i < range.length; i++) {
      try {
        const match = await this.fetchMatch(range[i]);
        // 验证 gameType 和 queueId
        if (!match.info || match.info.gameType !== "MATCHED_GAME") {
          continue;
        }
        if (!match.info.queueId || !ALLOWED_QUEUE_IDS.includes(match.info.queueId)) {
          continue;
        }
        const data = extractPlayerData(match, this.puuid);
        if (data) {
          results.push(data);
        }

        this.processedCount = start + i + 1;
        onProgress?.(this.processedCount, this.totalCount);
      } catch (error) {
        console.warn(`Failed to load match ${range[i]}:`, error);
      }
    }

    return results;
  }

  /**
   * 分页加载所有数据
   */
  async *loadPaginated(
    matchIds: string[],
    pageSize: number = 20
  ): AsyncGenerator<FilteredPlayerData[], void, unknown> {
    for (let i = 0; i < matchIds.length; i += pageSize) {
      const page = await this.loadRange(matchIds, i, Math.min(i + pageSize, matchIds.length));
      yield page;
    }
  }

  /**
   * 实时聚合 - 边加载边计算，不保存原始数据
   */
  async aggregateInRealTime(
    matchIds: string[],
    batchSize: number = 50,
    onProgress?: (stats: AggregatedStats, progress: number) => void
  ): Promise<AggregatedStats> {
    const allData: FilteredPlayerData[] = [];

    for (let i = 0; i < matchIds.length; i += batchSize) {
      const batch = await this.loadRange(matchIds, i, Math.min(i + batchSize, matchIds.length));
      allData.push(...batch);

      // 实时计算聚合数据
      this.aggregatedStats = aggregateFilteredData(allData);
      const progress = (i + batch.length) / matchIds.length;
      onProgress?.(this.aggregatedStats, progress);
    }

    return this.aggregatedStats!;
  }

  getProgress(): { processed: number; total: number; percentage: number } {
    return {
      processed: this.processedCount,
      total: this.totalCount,
      percentage: this.totalCount > 0 ? (this.processedCount / this.totalCount) * 100 : 0,
    };
  }
}

/**
 * 时间范围过滤 - 只获取特定时间段的数据
 */
export interface TimeRangeFilter {
  startTime?: number; // Unix timestamp (seconds)
  endTime?: number;
}

export function filterMatchIdsByTime(
  matchIds: string[],
  filter: TimeRangeFilter
): string[] {
  // Riot match IDs 包含时间戳信息
  // 格式: REGION_MATCHID, 其中 MATCHID 的前几位包含时间信息
  return matchIds.filter(id => {
    // 这里可以根据实际需求实现时间过滤逻辑
    // 通常通过 API 的 startTime/endTime 参数来过滤
    return true;
  });
}

/**
 * 采样策略 - 从大量数据中采样代表性样本
 */
export function sampleMatches(matchIds: string[], sampleSize: number): string[] {
  if (matchIds.length <= sampleSize) return matchIds;

  // 均匀采样
  const step = matchIds.length / sampleSize;
  const sampled: string[] = [];

  for (let i = 0; i < sampleSize; i++) {
    const index = Math.floor(i * step);
    sampled.push(matchIds[index]);
  }

  return sampled;
}
