// AI Storytelling Service - 参考 Vercel AI SDK 和 AWS Bedrock 最佳实践
import type { AggregatedStats } from './riotApiService';
import type { YearInReview2025 } from '../types/yearInReview';

// Prompt 工程：参考 OpenAI/Anthropic 最佳实践
export function buildStorytellingPrompt(stats: AggregatedStats, monthlyData: any[]): string {
  const winRate = ((stats.wins / stats.totalGames) * 100).toFixed(1);
  const kda = ((stats.avgKills + stats.avgAssists) / (stats.avgDeaths || 1)).toFixed(2);
  
  // 识别趋势（早期 vs 晚期表现）
  const earlyMonths = monthlyData.slice(0, 3);
  const lateMonths = monthlyData.slice(-3);
  const earlyWR = earlyMonths.reduce((sum, m) => sum + m.winRate, 0) / earlyMonths.length;
  const lateWR = lateMonths.reduce((sum, m) => sum + m.winRate, 0) / lateMonths.length;
  const improvement = lateWR - earlyWR;
  
  return `You are a League of Legends coach analyzing a player's 2025 season. Generate 3 personalized insights in a motivating, story-driven style (like Spotify Wrapped).

Player Stats:
- Games: ${stats.totalGames}, Win Rate: ${winRate}%
- KDA: ${kda} (${stats.avgKills.toFixed(1)}/${stats.avgDeaths.toFixed(1)}/${stats.avgAssists.toFixed(1)})
- Top Champions: ${Object.entries(stats.championStats).sort((a,b) => b[1].games - a[1].games).slice(0,3).map(([name]) => name).join(', ')}
- Improvement: ${improvement > 0 ? `+${improvement.toFixed(1)}%` : `${improvement.toFixed(1)}%`} win rate from early to late season

Generate exactly 3 insights in this JSON format:
{
  "playstyleEvolution": "One sentence describing how their playstyle changed over 2025",
  "standoutMoment": "One sentence highlighting their best achievement or breakthrough",
  "2026Prediction": "One motivating sentence about their potential in 2026"
}

Keep each insight under 25 words. Be specific, positive, and actionable.`;
}

// 成本优化：缓存策略（避免重复调用）
const insightCache = new Map<string, { insights: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedInsights(playerId: string): any | null {
  const cached = insightCache.get(playerId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.insights;
  }
  return null;
}

export function setCachedInsights(playerId: string, insights: any): void {
  insightCache.set(playerId, { insights, timestamp: Date.now() });
}

// Bedrock API 调用（参考 AWS 官方示例）
export async function generateAIInsights(
  stats: AggregatedStats, 
  monthlyData: any[],
  playerId: string
): Promise<YearInReview2025['aiInsights']> {
  // 检查缓存
  const cached = getCachedInsights(playerId);
  if (cached) return cached;
  
  const prompt = buildStorytellingPrompt(stats, monthlyData);
  
  // 调用 Cloudflare Function（内部使用 Bedrock）
  const response = await fetch('/api/ai/generate-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens: 200 }) // 成本控制
  });
  
  if (!response.ok) {
    throw new Error('AI insight generation failed');
  }
  
  const result = await response.json();
  
  // 解析 AI 响应
  const insights = {
    playstyle: result.playstyleEvolution || "You showed consistent growth throughout 2025",
    strengths: extractStrengths(stats),
    growthAreas: extractGrowthAreas(stats),
    prediction: result['2026Prediction'] || "You're ready to reach new heights in 2026"
  };
  
  setCachedInsights(playerId, insights);
  return insights;
}

// 辅助函数：基于数据提取优势（不依赖 AI）
function extractStrengths(stats: AggregatedStats): string[] {
  const strengths: string[] = [];
  if (stats.avgVisionScorePerMin > 1.5) strengths.push("Exceptional map awareness");
  if ((stats.avgKills + stats.avgAssists) / (stats.avgDeaths || 1) > 4) strengths.push("Elite KDA management");
  if (stats.avgDamageDealtPercentage > 28) strengths.push("Carry-level damage output");
  return strengths.slice(0, 2);
}

function extractGrowthAreas(stats: AggregatedStats): string[] {
  const areas: string[] = [];
  if (stats.avgDeaths > 6) areas.push("Reduce deaths in teamfights");
  if (Object.keys(stats.championStats).length < 5) areas.push("Expand champion pool");
  if (stats.avgGoldPerMin < 380) areas.push("Improve farming efficiency");
  return areas.slice(0, 2);
}
