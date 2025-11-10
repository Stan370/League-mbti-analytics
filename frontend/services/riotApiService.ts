
import React from 'react';
import type { AnalysisResult, ChampionData, MatchData, AggregatedSummary } from '../types';
import type { MatchDto } from '../types/riotApiTypes';
import { QUEUE_NAMES, RANKED_QUEUE_IDS, CASUAL_QUEUE_IDS, ALLOWED_QUEUE_IDS } from '../types/riotApiTypes';
import { BrainCircuitIcon, CrosshairIcon, ShieldCheckIcon, SwordsIcon } from '../components/icons';
import {
    getCachedPuuid,
    setCachedPuuid,
    getCachedMatchIds,
    setCachedMatchIds,
    getCachedMatchDetails,
    setCachedMatchDetails,
    clearAllCaches,
} from './cacheService';
import pLimit from 'p-limit';
import { rateLimiter } from './rateLimiter';

// API requests are proxied through the Cloudflare Worker to keep the API key server-side
const API_BASE_ACCOUNT = '/api';
const API_BASE_MATCH = '/api/riot';
const DDRAGON_VERSION = '14.15.1';

/**
 * Clear all caches (memory + IndexedDB)
 * Useful for testing or when data needs to be refreshed
 */
export function clearCache(): Promise<void> {
    return clearAllCaches();
}

// --- HELPER: API FETCHING ---
async function apiFetch<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) throw new Error("Forbidden: Check your Riot API key.");
        if (response.status === 404) throw new Error("Player or match data not found. Please check Summoner Name and Tag.");
        if (response.status === 500 && errorData.error) {
            throw new Error(errorData.error);
        }
        throw new Error(`Riot API request failed: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

async function getPuuid(gameName: string, tagLine: string): Promise<string> {
    // Check multi-layer cache first
    const cached = await getCachedPuuid(gameName, tagLine);
    if (cached) {
        return cached;
    }
    
    // Do not pass tagLine as routing tag; proxy will default to americas for account lookups
    const data = await apiFetch<{ puuid: string }>(`${API_BASE_ACCOUNT}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
    
    // Cache the result in all layers
    await setCachedPuuid(gameName, tagLine, data.puuid);
    console.log(`[getPuuid] Fetched and cached PUUID for ${gameName}#${tagLine}`);
    
    return data.puuid;
}

async function getMatchIds(puuid: string, tagLine: string): Promise<string[]> {
    // Check multi-layer cache first (不再按 queueId 缓存)
    const cached = await getCachedMatchIds(puuid, undefined);
    if (cached) {
        return cached;
    }
    
    // Query only matches in 2025. Keep the tag so the Worker can route correctly.
    const startOf2025Sec = Math.floor(Date.UTC(2025, 0, 1, 0, 0, 0) / 1000);

    const base = `${API_BASE_MATCH}/lol/match/v5/matches/by-puuid/${puuid}/ids`;
    const params = new URLSearchParams({
        start: '0',
        count: '50',
        startTime: String(startOf2025Sec),
    });
    
    const url = `${base}?${params.toString()}`;
    console.log('[getMatchIds] params', Object.fromEntries(params.entries()));
    const matchIds = await apiFetch<string[]>(url);
    
    // Cache the result in all layers
    await setCachedMatchIds(puuid, undefined, matchIds);
    console.log(`[getMatchIds] Fetched and cached ${matchIds.length} match IDs for ${puuid}`);
    
    return matchIds;
}

async function getMatchDetails(matchId: string, tagLine: string): Promise<MatchDto> {
    // Check multi-layer cache first (matchId is globally unique)
    const cached = await getCachedMatchDetails<MatchDto>(matchId);
    if (cached) {
        return cached;
    }
    
    // Wait for rate limit availability
    await rateLimiter.waitForAvailability();
    
    // Do not pass tagLine as routing tag; proxy will resolve via puuid-derived region when needed
    const matchDetails = await apiFetch<MatchDto>(`${API_BASE_MATCH}/lol/match/v5/matches/${matchId}`);
    
    // Cache the result in all layers
    await setCachedMatchDetails(matchId, matchDetails);
    console.log(`[getMatchDetails] Fetched and cached match details for ${matchId}`);
    
    return matchDetails;
}

// --- HELPER: DATA PROCESSING & ANALYSIS ---

export interface AggregatedStats {
    totalGames: number;
    wins: number;
    avgKills: number;
    avgDeaths: number;
    avgAssists: number;
    avgVisionScorePerMin: number;
    avgDamageDealtPerMin: number;
    avgDamageDealtPercentage: number;
    avgGoldPerMin: number;
    queueBreakdown: Record<number, { games: number; wins: number }>; // queueId -> stats
    rankedStats: { games: number; wins: number }; // Ranked 统计
    casualStats: { games: number; wins: number }; // Casual 统计
    championStats: Record<string, {
        games: number;
        wins: number;
        kills: number;
        deaths: number;
        assists: number;
        playstyleAnalyses: string[];
    }>;
}


/**
 * 统一的 match 过滤逻辑
 * 检查 match 是否符合处理条件
 * 
 * 过滤顺序：
 * 1. 基础验证（info, gameType, queueId）
 * 2. 队列类型验证（ALLOWED_QUEUE_IDS）
 * 3. 玩家验证（puuid）
 */
function shouldProcessMatch(
    match: MatchDto,
    puuid: string
): { shouldProcess: boolean; reason?: string; queueId?: number } {
    // 验证 match.info 存在
    if (!match.info) {
        return { shouldProcess: false, reason: 'missing_info' };
    }

    // 只处理 MATCHED_GAME 类型
    if (match.info.gameType !== "MATCHED_GAME") {
        return { shouldProcess: false, reason: 'not_matched_game', queueId: match.info.queueId };
    }
    const queueId = match.info.queueId;
    if (queueId === undefined || queueId === null) {
        return { shouldProcess: false, reason: 'missing_queueId' };
    }

    // 只处理允许的队列类型（基础白名单）
    if (!ALLOWED_QUEUE_IDS.includes(queueId)) {
        return { shouldProcess: false, reason: 'queue_not_allowed', queueId };
    }

    // 查找指定玩家的数据
    const player = match.info.participants.find(p => p.puuid === puuid);
    if (!player) {
        return { shouldProcess: false, reason: 'player_not_found', queueId };
    }

    return { shouldProcess: true, queueId };
}

/**
 * 处理单个 match 并更新统计
 */
function processSingleMatch(
    match: MatchDto,
    puuid: string,
    stats: AggregatedStats,
    totals: {
        totalKills: number;
        totalDeaths: number;
        totalAssists: number;
        totalVisionScore: number;
        totalDamage: number;
        totalGold: number;
        totalDuration: number;
        totalTeamDamagePercent: number;
    }
): void {
    const player = match.info!.participants.find(p => p.puuid === puuid)!;
    
    // 记录 queueId 统计
    if (!stats.queueBreakdown[match.info!.queueId!]) {
        stats.queueBreakdown[match.info!.queueId!] = { games: 0, wins: 0 };
    }
    stats.queueBreakdown[match.info!.queueId!].games++;
    if (player.win) {
        stats.queueBreakdown[match.info!.queueId!].wins++;
    }

    // 区分 Ranked 和 Casual
    if (RANKED_QUEUE_IDS.includes(match.info!.queueId!)) {
        stats.rankedStats.games++;
        if (player.win) stats.rankedStats.wins++;
    } else if (CASUAL_QUEUE_IDS.includes(match.info!.queueId!)) {
        stats.casualStats.games++;
        if (player.win) stats.casualStats.wins++;
    }

    const teamTotalDamage = match.info!.participants
        .filter(p => p.teamId === player.teamId)
        .reduce((sum, p) => sum + p.totalDamageDealtToChampions, 0);

    stats.totalGames++;
    if (player.win) stats.wins++;

    const durationInMinutes = player.timePlayed / 60;
    totals.totalDuration += durationInMinutes;

    totals.totalKills += player.kills;
    totals.totalDeaths += player.deaths;
    totals.totalAssists += player.assists;
    totals.totalVisionScore += player.visionScore;
    totals.totalDamage += player.totalDamageDealtToChampions;
    totals.totalGold += player.goldEarned;
    totals.totalTeamDamagePercent += teamTotalDamage > 0 ? (player.totalDamageDealtToChampions / teamTotalDamage) : 0;

    const champName = player.championName === "FiddleSticks" ? "Fiddlesticks" : player.championName;
    if (!stats.championStats[champName]) {
        stats.championStats[champName] = { games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, playstyleAnalyses: [] };
    }
    const champ = stats.championStats[champName];
    champ.games++;
    if (player.win) champ.wins++;
    champ.kills += player.kills;
    champ.deaths += player.deaths;
    champ.assists += player.assists;

    const kda = (player.kills + player.assists) / (player.deaths || 1);
    if (kda > 5 && player.totalDamageDealtToChampions / durationInMinutes > 800) {
        champ.playstyleAnalyses.push("a dominant, high-damage carry performance");
    } else if (player.visionScore / durationInMinutes > 1.8) {
        champ.playstyleAnalyses.push("a vision-focused, controlling style");
    } else if (player.turretTakedowns > 2 && player.damageDealtToBuildings > 5000) {
        champ.playstyleAnalyses.push("an objective-focused, split-pushing style");
    } else if (player.totalHealsOnTeammates > 3000 || player.totalDamageShieldedOnTeammates > 3000) {
        champ.playstyleAnalyses.push("a protective, team-oriented role");
    } else {
        champ.playstyleAnalyses.push("a balanced contribution to the team");
    }
}

/**
 * Layer 1: Fetch - 只负责获取 match details，使用 rate limiter + p-limit 控制并发
 */
async function fetchMatches(
    matchIds: string[],
    tagLine: string
): Promise<{ matches: MatchDto[]; errors: number }> {
    console.log(`[fetchMatches] Starting to fetch ${matchIds.length} matches`);
    
    // 使用 p-limit 控制并发数（5-10 个并发请求）
    const limit = pLimit(8);
    const errors: number[] = [];
    
    // 并发获取所有 match details，但限制并发数
    const matchPromises = matchIds.map((matchId, index) => 
        limit(async () => {
            try {
                const match = await getMatchDetails(matchId, tagLine);
                if ((index + 1) % 10 === 0) {
                    const status = rateLimiter.getStatus();
                    console.log(`[fetchMatches] Progress: ${index + 1}/${matchIds.length} | Rate limit: ${status.short.count}/${status.short.limit} (short), ${status.long.count}/${status.long.limit} (long)`);
                }
                return match;
            } catch (error) {
                console.warn(`[fetchMatches] Failed to fetch match ${matchId}:`, error);
                errors.push(1);
                return null;
            }
        })
    );

    // 等待所有请求完成
    const results = await Promise.all(matchPromises);
    
    // 过滤掉 null（错误情况）
    const matches = results.filter((m): m is MatchDto => m !== null);
    
    console.log(`[fetchMatches] Completed: ${matches.length} matches fetched, ${errors.length} errors`);
    
    return { matches, errors: errors.length };
}

/**
 * Layer 2: Filter - 过滤 matches，只保留符合条件的
 */
function filterMatches(
    matches: MatchDto[],
    puuid: string
): { validMatches: MatchDto[]; skipStats: { [key: string]: number } } {
    console.log(`[filterMatches] Filtering ${matches.length} matches`);
    
    const skipStats: { [key: string]: number } = {};
    const validMatches: MatchDto[] = [];
    const queueIdDistribution: { [queueId: number]: number } = {};

    // 先统计所有 queueId 的分布
    for (const match of matches) {
        if (match.info?.queueId !== undefined && match.info.queueId !== null) {
            queueIdDistribution[match.info.queueId] = (queueIdDistribution[match.info.queueId] || 0) + 1;
        }
    }
    
    console.log(`[filterMatches] Queue ID distribution:`, Object.entries(queueIdDistribution).map(([qid, count]) => ({
        queueId: Number(qid),
        queueName: QUEUE_NAMES[Number(qid)] || `Queue ${qid}`,
        count,
    })));

    for (const match of matches) {
        const filterResult = shouldProcessMatch(match, puuid);
        
        if (filterResult.shouldProcess) {
            validMatches.push(match);
        } else {
            const reason = filterResult.reason || 'unknown';
            skipStats[reason] = (skipStats[reason] || 0) + 1;
            
            // 详细日志：记录被跳过的匹配的 queueId
            if (filterResult.queueId !== undefined) {
                const queueName = QUEUE_NAMES[filterResult.queueId] || `Queue ${filterResult.queueId}`;
                if (!skipStats[`${reason}_details`]) {
                    skipStats[`${reason}_details`] = {} as any;
                }
                const details = skipStats[`${reason}_details`] as any;
                if (!details[filterResult.queueId]) {
                    details[filterResult.queueId] = { queueId: filterResult.queueId, queueName, count: 0 };
                }
                details[filterResult.queueId].count++;
            }
        }
    }

    console.log(`[filterMatches] Filtered: ${validMatches.length} valid matches, skip stats:`, skipStats);
    
    // 如果 validMatches 为空，提供更详细的诊断信息
    if (validMatches.length === 0 && matches.length > 0) {
        const foundQueueIds = Object.keys(queueIdDistribution).map(Number);
        console.warn(`[filterMatches] WARNING: No valid matches found!`, {
            foundQueueIds,
            foundQueueNames: foundQueueIds.map(q => QUEUE_NAMES[q] || `Queue ${q}`),
            allowedQueueIds: ALLOWED_QUEUE_IDS,
            allowedQueueNames: ALLOWED_QUEUE_IDS.map(q => QUEUE_NAMES[q] || `Queue ${q}`),
            skipStats,
        });
    }
    
    return { validMatches, skipStats };
}

/**
 * Layer 3: Aggregate - 聚合统计数据
 */
function aggregateMatches(
    matches: MatchDto[],
    puuid: string
): AggregatedStats {
    console.log(`[aggregateMatches] Aggregating ${matches.length} matches`);
    
    const initialStats: AggregatedStats = {
        totalGames: 0, wins: 0, avgKills: 0, avgDeaths: 0, avgAssists: 0,
        avgVisionScorePerMin: 0, avgDamageDealtPerMin: 0, avgDamageDealtPercentage: 0,
        avgGoldPerMin: 0, queueBreakdown: {},
        rankedStats: { games: 0, wins: 0 },
        casualStats: { games: 0, wins: 0 },
        championStats: {},
    };

    const totals = {
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        totalVisionScore: 0,
        totalDamage: 0,
        totalGold: 0,
        totalDuration: 0,
        totalTeamDamagePercent: 0,
    };

    // 顺序处理，避免并发竞争
    for (const match of matches) {
        processSingleMatch(match, puuid, initialStats, totals);
    }

    // 计算平均值
    if (initialStats.totalGames > 0) {
        initialStats.avgKills = totals.totalKills / initialStats.totalGames;
        initialStats.avgDeaths = totals.totalDeaths / initialStats.totalGames;
        initialStats.avgAssists = totals.totalAssists / initialStats.totalGames;
        initialStats.avgVisionScorePerMin = totals.totalVisionScore / totals.totalDuration;
        initialStats.avgDamageDealtPerMin = totals.totalDamage / totals.totalDuration;
        initialStats.avgDamageDealtPercentage = (totals.totalTeamDamagePercent / initialStats.totalGames) * 100;
        initialStats.avgGoldPerMin = totals.totalGold / totals.totalDuration;
    }

    console.log(`[aggregateMatches] Aggregated stats: ${initialStats.totalGames} games processed`);
    
    return initialStats;
}

/**
 * 三层架构：fetch -> filter -> aggregate
 * 完全解耦，每层职责单一
 */
async function fetchFilterAndAggregateMatches(
    matchIds: string[],
    tagLine: string,
    puuid: string
): Promise<{ stats: AggregatedStats; matches: MatchDto[]; skipStats: { [key: string]: number } }> {
    // Layer 1: Fetch - 只负责获取数据，不涉及业务逻辑
    const { matches: allMatches, errors } = await fetchMatches(matchIds, tagLine);
    
    // Layer 2: Filter - 只负责过滤，不涉及聚合
    const { validMatches, skipStats } = filterMatches(allMatches, puuid);
    
    // Layer 3: Aggregate - 只负责聚合，不涉及获取和过滤
    const stats = aggregateMatches(validMatches, puuid);

    // 输出处理统计信息
    console.log('[fetchFilterAndAggregateMatches] Final summary:', {
        totalMatchIds: matchIds.length,
        fetched: allMatches.length,
        fetchErrors: errors,
        validMatches: validMatches.length,
        skipStats,
        rankedStats: {
            games: stats.rankedStats.games,
            wins: stats.rankedStats.wins,
            winRate: stats.rankedStats.games > 0
                ? ((stats.rankedStats.wins / stats.rankedStats.games) * 100).toFixed(1) + '%'
                : 'N/A',
        },
        casualStats: {
            games: stats.casualStats.games,
            wins: stats.casualStats.wins,
            winRate: stats.casualStats.games > 0
                ? ((stats.casualStats.wins / stats.casualStats.games) * 100).toFixed(1) + '%'
                : 'N/A',
        },
        queueBreakdown: Object.entries(stats.queueBreakdown).map(([queueId, queueStats]) => ({
            queueId: Number(queueId),
            queueName: QUEUE_NAMES[Number(queueId)] || `Queue ${queueId}`,
            type: RANKED_QUEUE_IDS.includes(Number(queueId)) ? 'Ranked' : 'Casual',
            games: queueStats.games,
            wins: queueStats.wins,
            winRate: ((queueStats.wins / queueStats.games) * 100).toFixed(1) + '%',
        })),
    });

    return { stats, matches: validMatches, skipStats };
}

function generateAnalysis(
    stats: AggregatedStats, 
    matches: MatchDto[], 
    puuid: string, 
    summonerName: string, 
    tag: string
): AnalysisResult {
    // Extract match data for table display
    const matchData: MatchData[] = [];
    
    for (const match of matches) {
        if (!match.info || match.info.gameType !== "MATCHED_GAME") continue;
        if (!match.info.queueId || !ALLOWED_QUEUE_IDS.includes(match.info.queueId)) continue;
        
        const player = match.info.participants.find(p => p.puuid === puuid);
        if (!player) continue;
        
        matchData.push({
            matchId: match.metadata.matchId,
            gameEndTimestamp: match.info.gameEndTimestamp,
            queueId: match.info.queueId,
            kills: player.kills,
            deaths: player.deaths,
            assists: player.assists,
            totalMinionsKilled: player.totalMinionsKilled,
            neutralMinionsKilled: player.neutralMinionsKilled,
            totalDamageDealtToChampions: player.totalDamageDealtToChampions,
            goldEarned: player.goldEarned,
            championName: player.championName,
            teamId: player.teamId,
            win: player.win,
            position: player.teamPosition || player.individualPosition,
            visionScore: player.visionScore,
            gameDuration: match.info.gameDuration,
            gameMode: match.info.gameMode,
        });
    }
    
    // Sort by most recent first
    matchData.sort((a, b) => b.gameEndTimestamp - a.gameEndTimestamp);
    
    // Calculate aggregated summary
    const totalCS = matchData.reduce((sum, m) => sum + m.totalMinionsKilled, 0);
    const totalNeutralCS = matchData.reduce((sum, m) => sum + m.neutralMinionsKilled, 0);
    const totalDamage = matchData.reduce((sum, m) => sum + m.totalDamageDealtToChampions, 0);
    const totalGold = matchData.reduce((sum, m) => sum + m.goldEarned, 0);
    const totalVision = matchData.reduce((sum, m) => sum + m.visionScore, 0);
    const totalDuration = matchData.reduce((sum, m) => sum + m.gameDuration, 0);
    const wins = matchData.filter(m => m.win).length;
    
    const aggregatedSummary: AggregatedSummary = {
        totalGames: stats.totalGames,
        wins: wins,
        winRate: stats.totalGames > 0 ? (wins / stats.totalGames) * 100 : 0,
        avgKills: stats.avgKills,
        avgDeaths: stats.avgDeaths,
        avgAssists: stats.avgAssists,
        avgKDA: (stats.avgKills + stats.avgAssists) / (stats.avgDeaths || 1),
        avgCS: stats.totalGames > 0 ? totalCS / stats.totalGames : 0,
        avgTotalCS: stats.totalGames > 0 ? (totalCS + totalNeutralCS) / stats.totalGames : 0,
        avgDamage: stats.totalGames > 0 ? totalDamage / stats.totalGames : 0,
        avgGold: stats.totalGames > 0 ? totalGold / stats.totalGames : 0,
        avgVisionScore: stats.totalGames > 0 ? totalVision / stats.totalGames : 0,
        avgDamagePerMin: stats.avgDamageDealtPerMin,
        avgGoldPerMin: stats.avgGoldPerMin,
    };
    const kda = (stats.avgKills + stats.avgAssists) / (stats.avgDeaths || 1);
    const strengths = [];
    
    // Score-based MBTI determination TODO: improve this
    let scores = { E: 0, I: 0, N: 0, S: 0, T: 0, F: 0, J: 0, P: 0 };
    if (stats.avgDamageDealtPercentage > 28) scores.E++; else scores.I++;
    if (stats.avgKills > 7) scores.E++; else scores.I++;
    
    if (stats.avgVisionScorePerMin > 1.5) scores.N++; else scores.S++;
    if (stats.avgAssists > 8) scores.N++; else scores.S++;

    if (kda > 4.0) scores.T++; else scores.F++;
    if (stats.avgDeaths < 5) scores.T++; else scores.F++;

    if (stats.avgGoldPerMin > 420) scores.J++; else scores.P++;
    if (stats.avgKills / (stats.totalGames || 1) < 0.5) scores.J++; else scores.P++;

    const mbti = `${scores.E > scores.I ? 'E' : 'I'}${scores.N > scores.S ? 'N' : 'S'}${scores.T > scores.F ? 'T' : 'F'}${scores.J > scores.P ? 'J' : 'P'}`;

    // Determine strengths
    if (stats.avgDamageDealtPercentage >= 28) {
        strengths.push({ title: "Teamfight Titan", description: `Dealing ${stats.avgDamageDealtPercentage.toFixed(0)}% of your team's damage, you are their primary threat.`, icon: React.createElement(SwordsIcon, { className: "w-8 h-8 text-[#CDA434]" }) });
    }
    if (stats.avgVisionScorePerMin >= 1.5) {
        strengths.push({ title: "Macro Mastermind", description: `With a vision score of ${stats.avgVisionScorePerMin.toFixed(1)} per minute, you control the map.`, icon: React.createElement(BrainCircuitIcon, { className: "w-8 h-8 text-[#CDA434]" }) });
    }
    if (kda >= 4.0) {
        strengths.push({ title: "Flawless Positioning", description: `Your impressive ${kda.toFixed(1)} KDA shows you know how to deal damage while staying safe.`, icon: React.createElement(ShieldCheckIcon, { className: "w-8 h-8 text-[#CDA434]" }) });
    }
    if (stats.avgGoldPerMin >= 420) {
        strengths.push({ title: "Economic Powerhouse", description: `Earning ${stats.avgGoldPerMin.toFixed(0)} gold per minute, you build an insurmountable lead.`, icon: React.createElement(CrosshairIcon, { className: "w-8 h-8 text-[#CDA434]" }) });
    }
    if (strengths.length < 3) {
        strengths.push({ title: "Adaptable Playmaker", description: "You show flexibility, adapting to the needs of the game to secure victory.", icon: React.createElement(BrainCircuitIcon, { className: "w-8 h-8 text-[#CDA434]" }) });
    }
    
    const topChampions: ChampionData[] = Object.entries(stats.championStats)
        .sort(([, a], [, b]) => b.games - a.games).slice(0, 3)
        .map(([name, champStats]) => {
            const mostCommonPlaystyle = (champStats.playstyleAnalyses
                .sort((a, b) => champStats.playstyleAnalyses.filter(v => v === a).length - champStats.playstyleAnalyses.filter(v => v === b).length)
                .pop() || "a versatile approach").replace("a ", "").replace("an ", "");
            return {
                name, gamesPlayed: champStats.games,
                winRate: Math.round((champStats.wins / champStats.games) * 100),
                kda: `${(champStats.kills / champStats.games).toFixed(1)} / ${(champStats.deaths / champStats.games).toFixed(1)} / ${(champStats.assists / champStats.games).toFixed(1)}`,
                imageUrl: `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${name}.png`,
                playstyleAnalysis: `Your ${name} is characterized by ${mostCommonPlaystyle}.`
            };
        });

    const archetypeMap: Record<string, { title: string, description: string }> = {
        'ENTJ': { title: "The Field Marshal", description: "A natural leader who commands the rift with strategic prowess and decisive action. You see the path to victory and rally your team to follow it." },
        'INTJ': { title: "The Grandmaster", description: "A strategic visionary who outthinks the opponent. Your game is a complex chess match, and you're always five moves ahead."},
        'ESTP': { title: "The Glorious Executioner", description: "An adrenaline junkie who thrives in the chaos of battle. You live for the outplay, turning skirmishes into a highlight reel."},
        'ISTP': { title: "The Blade Master", description: "A mechanical virtuoso with lightning-fast reflexes. You excel in duels, dissecting opponents with cold, calculated precision."},
        'ENFP': { title: "The Spark of Demacia", description: "An inspirational and creative force. You find unconventional paths to victory and energize your teammates with your optimistic plays."},
        'INFP': { title: "The Dream Weaver", description: "A quiet but powerful playmaker who supports the team's dream. Your timely interventions and selfless plays are the unsung key to victory."},
        'ESFJ': { title: "The Warden", description: "A protector at heart, you excel at enabling your teammates and shielding them from harm. Your presence ensures the team's core is safe."},
        'ISFJ': { title: "The Unbreakable Shield", description: "A reliable and steadfast defender, you are the rock of your team. You consistently sacrifice for the greater good."},
    };
    
    const randomArchetype = { title: "The Unseen Threat", description: "Your playstyle is a unique blend of strategies that keeps enemies guessing. You are an unpredictable and formidable force on the Rift."};
    const archetypeDetails = archetypeMap[mbti] || randomArchetype;

    return {
        summonerName, tag,
        archetype: {
            title: archetypeDetails.title, mbti, description: archetypeDetails.description,
            imageUrl: topChampions.length > 0 ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${topChampions[0].name}_0.jpg` : 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Fiddlesticks_0.jpg'
        },
        strengths: strengths.slice(0, 3),
        growthCurve: [
            { month: "Jan", winRate: 52, kda: 3.8 }, { month: "Feb", winRate: 55, kda: 4.1 },
            { month: "Mar", winRate: 54, kda: 4.0 }, { month: "Apr", winRate: 58, kda: 4.5 },
            { month: "May", winRate: 62, kda: 5.1 }, { month: "Jun", winRate: 60, kda: 4.9 },
        ],
        topChampions,
        matchData,
        aggregatedSummary,
    };
}

// --- MAIN EXPORTED FUNCTION ---
export const analyzePlayer = async (
    summonerNameWithTag: string
): Promise<AnalysisResult> => {
    const [gameName, tagLine] = summonerNameWithTag.split('#');
    if (!gameName || !tagLine) {
        throw new Error("Invalid format. Please use 'Summoner Name#Tag'.");
    }

    const puuid = await getPuuid(gameName, tagLine);
    console.log('[analyzePlayer] Resolved PUUID:', puuid, 'for', summonerNameWithTag);

    // 获取所有匹配
    const matchIds = await getMatchIds(puuid, tagLine);
    console.log('[analyzePlayer] Found match IDs:', matchIds.length, matchIds);
    
    if (matchIds.length === 0) {
        throw new Error(`No recent matches found. Try a different time range.`);
    }
    
    // 三层架构：fetch -> filter -> aggregate（完全解耦）
    const { stats: aggregatedStats, matches, skipStats } = await fetchFilterAndAggregateMatches(
        matchIds,
        tagLine,
        puuid
    );
    
    console.log('[analyzePlayer] Processed matches:', {
        totalFetched: matchIds.length,
        validMatches: aggregatedStats.totalGames,
        skipStats,
    });
    
    if (aggregatedStats.totalGames < 5) {
        const skipDetails = Object.entries(skipStats)
            .map(([reason, count]) => `${reason}: ${count}`)
            .join(', ');
        throw new Error(
            `Only found ${aggregatedStats.totalGames} valid matches (min 5 required). ` +
            `Skipped: ${skipDetails}. ` +
            `Total matches fetched: ${matchIds.length}.`
        );
    }
    
    return generateAnalysis(aggregatedStats, matches, puuid, gameName, tagLine);
};
