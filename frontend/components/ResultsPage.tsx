
import React, { useMemo } from 'react';
import type { AnalysisResult } from '../types';
import GrowthChart from './GrowthChart';
import { QUEUE_NAMES, RANKED_QUEUE_IDS } from '../types/riotApiTypes';

interface ResultsPageProps {
  analysis: AnalysisResult;
  onReset: () => void;
}

const Section: React.FC<{title: string; children: React.ReactNode; className?: string}> = ({ title, children, className = '' }) => (
    <div className={`w-full max-w-7xl mx-auto py-16 px-4 md:px-8 bg-[#0A1428]/50 border border-[#2D899B]/30 backdrop-blur-sm mb-8 ${className}`}>
        <h2 className="text-5xl font-bold text-center mb-12 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-cyan-500">{title}</h2>
        {children}
    </div>
);

const ResultsPage: React.FC<ResultsPageProps> = ({ analysis, onReset }) => {
  // Helper function to calculate statistics from matches
  const calculateStats = (matches: typeof analysis.matchData) => {
    if (matches.length === 0) {
      return {
        totalGames: 0,
        wins: 0,
        winRate: 0,
        avgKills: 0,
        avgDeaths: 0,
        avgAssists: 0,
        avgKDA: 0,
        avgCS: 0,
        avgTotalCS: 0,
        avgDamage: 0,
        avgGold: 0,
        avgVisionScore: 0,
        avgDamagePerMin: 0,
        avgGoldPerMin: 0,
      };
    }

    const totalCS = matches.reduce((sum, m) => sum + m.totalMinionsKilled, 0);
    const totalNeutralCS = matches.reduce((sum, m) => sum + m.neutralMinionsKilled, 0);
    const totalDamage = matches.reduce((sum, m) => sum + m.totalDamageDealtToChampions, 0);
    const totalGold = matches.reduce((sum, m) => sum + m.goldEarned, 0);
    const totalVision = matches.reduce((sum, m) => sum + m.visionScore, 0);
    const totalDuration = matches.reduce((sum, m) => sum + m.gameDuration, 0);
    const totalKills = matches.reduce((sum, m) => sum + m.kills, 0);
    const totalDeaths = matches.reduce((sum, m) => sum + m.deaths, 0);
    const totalAssists = matches.reduce((sum, m) => sum + m.assists, 0);
    const wins = matches.filter(m => m.win).length;

    return {
      totalGames: matches.length,
      wins: wins,
      winRate: matches.length > 0 ? (wins / matches.length) * 100 : 0,
      avgKills: matches.length > 0 ? totalKills / matches.length : 0,
      avgDeaths: matches.length > 0 ? totalDeaths / matches.length : 0,
      avgAssists: matches.length > 0 ? totalAssists / matches.length : 0,
      avgKDA: totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : totalKills + totalAssists,
      avgCS: matches.length > 0 ? totalCS / matches.length : 0,
      avgTotalCS: matches.length > 0 ? (totalCS + totalNeutralCS) / matches.length : 0,
      avgDamage: matches.length > 0 ? totalDamage / matches.length : 0,
      avgGold: matches.length > 0 ? totalGold / matches.length : 0,
      avgVisionScore: matches.length > 0 ? totalVision / matches.length : 0,
      avgDamagePerMin: totalDuration > 0 ? (totalDamage / totalDuration) * 60 : 0,
      avgGoldPerMin: totalDuration > 0 ? (totalGold / totalDuration) * 60 : 0,
    };
  };

  // Separate matches into ranked, casual, and queueId 420
  const { rankedMatches, casualMatches, rankedSoloMatches } = useMemo(() => {
    const ranked: typeof analysis.matchData = [];
    const casual: typeof analysis.matchData = [];
    const rankedSolo: typeof analysis.matchData = [];
    
    analysis.matchData.forEach(match => {
      if (RANKED_QUEUE_IDS.includes(match.queueId)) {
        ranked.push(match);
        if (match.queueId === 420) {
          rankedSolo.push(match);
        }
      } else {
        casual.push(match);
      }
    });
    
    return { rankedMatches: ranked, casualMatches: casual, rankedSoloMatches: rankedSolo };
  }, [analysis.matchData]);

  // Calculate statistics for each category
  const rankedStats = useMemo(() => calculateStats(rankedMatches), [rankedMatches]);
  const casualStats = useMemo(() => calculateStats(casualMatches), [casualMatches]);
  const rankedSoloStats = useMemo(() => calculateStats(rankedSoloMatches), [rankedSoloMatches]);

  // Helper function to get game type name
  const getGameTypeName = (queueId: number): string => {
    if (queueId === 450) return 'ARAM';
    // For ranked queues, show the queue name
    if (QUEUE_NAMES[queueId]) {
      return QUEUE_NAMES[queueId].replace('5v5 ', '').replace(' games', '');
    }
    // For other casual queues, show as Classic
    if (queueId === 400 || queueId === 430 || queueId === 490) return 'Classic';
    return `Queue ${queueId}`;
  };

  // Helper function to check if match is ARAM
  const isARAM = (queueId: number): boolean => queueId === 450;

  // Helper component to render a match table
  const renderMatchTable = (matches: typeof analysis.matchData, title: string) => {
    if (matches.length === 0) return null;

    // Check if any match in this section is ARAM
    const hasARAM = matches.some(m => isARAM(m.queueId));
    const hasNonARAM = matches.some(m => !isARAM(m.queueId));
    
    // Determine which columns to show
    const showVision = hasNonARAM;
    const showPosition = hasNonARAM;

    return (
      <div className="mb-8">
        <h3 className="text-3xl font-bold text-[#CDA434] mb-4">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-[#010A13]/70">
            <thead>
              <tr className="border-b-2 border-[#CDA434]/50">
                <th className="px-4 py-3 text-left text-[#CDA434] font-bold sticky left-0 bg-[#010A13]/95 z-10">Date</th>
                <th className="px-4 py-3 text-left text-[#CDA434] font-bold sticky left-20 bg-[#010A13]/95 z-10">Champion</th>
                <th className="px-4 py-3 text-center text-[#CDA434] font-bold">Game Type</th>
                <th className="px-4 py-3 text-center text-[#CDA434] font-bold">Result</th>
                <th className="px-4 py-3 text-center text-[#CDA434] font-bold">K/D/A</th>
                <th className="px-4 py-3 text-center text-[#CDA434] font-bold">KDA</th>
                <th className="px-4 py-3 text-center text-[#CDA434] font-bold">CS</th>
                <th className="px-4 py-3 text-center text-[#CDA434] font-bold">Total CS</th>
                <th className="px-4 py-3 text-center text-[#CDA434] font-bold">Damage</th>
                <th className="px-4 py-3 text-center text-[#CDA434] font-bold">Gold</th>
                {showVision && <th className="px-4 py-3 text-center text-[#CDA434] font-bold">Vision</th>}
                {showPosition && <th className="px-4 py-3 text-center text-[#CDA434] font-bold">Position</th>}
              </tr>
            </thead>
            <tbody>
              {matches.map((match) => {
                const kda = (match.kills + match.assists) / (match.deaths || 1);
                const totalCS = match.totalMinionsKilled + match.neutralMinionsKilled;
                const date = new Date(match.gameEndTimestamp);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const gameType = getGameTypeName(match.queueId);
                const isAramMatch = isARAM(match.queueId);
                
                return (
                  <tr 
                    key={match.matchId} 
                    className={`border-b border-[#2D899B]/20 hover:bg-[#0A1428]/50 transition-colors ${
                      match.win ? 'bg-green-900/10' : 'bg-red-900/10'
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-300 sticky left-0 bg-[#010A13]/95 z-10">{dateStr}</td>
                    <td className="px-4 py-3 sticky left-20 bg-[#010A13]/95 z-10">
                      <div className="flex items-center gap-2">
                        <img 
                          src={`https://ddragon.leagueoflegends.com/cdn/14.15.1/img/champion/${match.championName}.png`}
                          alt={match.championName}
                          className="w-8 h-8 rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://ddragon.leagueoflegends.com/cdn/14.15.1/img/champion/Fiddlesticks.png';
                          }}
                        />
                        <span className="text-white font-semibold">{match.championName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-blue-400 font-semibold">
                      {gameType}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${match.win ? 'text-green-400' : 'text-red-400'}`}>
                        {match.win ? 'WIN' : 'LOSS'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-white">
                      {match.kills}/{match.deaths}/{match.assists}
                    </td>
                    <td className="px-4 py-3 text-center text-cyan-400 font-semibold">
                      {kda.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">
                      {match.totalMinionsKilled}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-300">
                      {totalCS}
                    </td>
                    <td className="px-4 py-3 text-center text-orange-400">
                      {match.totalDamageDealtToChampions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center text-yellow-400">
                      {match.goldEarned.toLocaleString()}
                    </td>
                    {showVision && (
                      <td className="px-4 py-3 text-center text-purple-400">
                        {isAramMatch ? '-' : match.visionScore}
                      </td>
                    )}
                    {showPosition && (
                      <td className="px-4 py-3 text-center text-gray-400">
                        {isAramMatch ? '-' : match.position}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 pt-24 animate-fade-in">
        <button 
          onClick={onReset} 
          className="fixed top-4 left-4 z-50 bg-[#CDA434] text-[#010A13] font-bold py-2 px-4 text-xl hover:bg-transparent hover:text-[#CDA434] border-2 border-[#CDA434] transition-all duration-300"
        >
            Analyze Another
        </button>

      {/* Archetype Section */}
      <header className="text-center mb-16">
        <h1 className="text-6xl md:text-8xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">{analysis.summonerName}</h1>
        <p className="text-4xl text-[#CDA434] mt-2">{analysis.archetype.title} - {analysis.archetype.mbti}</p>
      </header>

      <Section title="Your Archetype">
        <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2">
                <img src={analysis.archetype.imageUrl} alt={analysis.archetype.title} className="w-full h-auto border-4 border-[#CDA434]/50" />
            </div>
            <div className="md:w-1/2">
                <p className="text-2xl text-gray-300 leading-relaxed">{analysis.archetype.description}</p>
            </div>
        </div>
      </Section>
      
      {/* Strengths Section */}
      <Section title="Core Strengths">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {analysis.strengths.map((strength, index) => (
                <div key={index} className="bg-[#010A13]/70 p-6 border border-[#CDA434]/30 text-center">
                    <div className="flex justify-center mb-4">{strength.icon}</div>
                    <h3 className="text-3xl font-semibold text-[#CDA434] mb-2">{strength.title}</h3>
                    <p className="text-xl text-gray-400">{strength.description}</p>
                </div>
            ))}
        </div>
      </Section>

      {/* Growth Curve Section */}
      <Section title="Your Growth Curve">
          <div className="h-96">
            <GrowthChart data={analysis.growthCurve} />
          </div>
      </Section>

      {/* Top Champions Section */}
      <Section title="Champion Mastery">
        <div className="space-y-8">
            {analysis.topChampions.map(champ => (
                <div key={champ.name} className="flex flex-col md:flex-row items-center gap-6 bg-[#010A13]/70 p-6 border border-[#2D899B]/20">
                    <img src={champ.imageUrl} alt={champ.name} className="w-24 h-24 border-2 border-[#CDA434]"/>
                    <div className="flex-1 text-center md:text-left">
                        <h3 className="text-4xl font-bold text-white">{champ.name}</h3>
                        <p className="text-xl text-gray-400">{champ.playstyleAnalysis}</p>
                    </div>
                    <div className="flex gap-4 md:gap-8 text-center">
                        <div>
                            <p className="text-3xl font-bold text-cyan-400">{champ.gamesPlayed}</p>
                            <p className="text-lg text-gray-500">Games</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold text-cyan-400">{champ.winRate}%</p>
                            <p className="text-lg text-gray-500">Winrate</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-cyan-400">{champ.kda.split('/')[0].trim()}</p>
                            <p className="text-lg text-gray-500">KDA</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </Section>

       {/* Match Data Table Section */}
      <Section title="Match History & Statistics">
        <div className="space-y-8">
          {/* Overall Summary */}
          <div className="bg-[#010A13]/70 p-6 border border-[#CDA434]/30">
            <h3 className="text-3xl font-bold text-[#CDA434] mb-6 text-center">Overall Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">{analysis.aggregatedSummary.totalGames}</p>
                <p className="text-sm text-gray-400">Total Games</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{analysis.aggregatedSummary.wins}</p>
                <p className="text-sm text-gray-400">Wins</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">{analysis.aggregatedSummary.winRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-400">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">{analysis.aggregatedSummary.avgKDA.toFixed(2)}</p>
                <p className="text-sm text-gray-400">Avg KDA</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">{analysis.aggregatedSummary.avgTotalCS.toFixed(1)}</p>
                <p className="text-sm text-gray-400">Avg Total CS</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-400">{analysis.aggregatedSummary.avgDamagePerMin.toFixed(0)}</p>
                <p className="text-sm text-gray-400">Dmg/Min</p>
              </div>
            </div>
          </div>

          {/* Ranked Summary */}
          {rankedMatches.length > 0 && (
            <div className="bg-[#010A13]/70 p-6 border border-[#CDA434]/30">
              <h3 className="text-3xl font-bold text-[#CDA434] mb-6 text-center">Ranked Matches Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{rankedStats.totalGames}</p>
                  <p className="text-sm text-gray-400">Total Games</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{rankedStats.wins}</p>
                  <p className="text-sm text-gray-400">Wins</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{rankedStats.winRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-400">Win Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{rankedStats.avgKDA.toFixed(2)}</p>
                  <p className="text-sm text-gray-400">Avg KDA</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{rankedStats.avgTotalCS.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Total CS</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{rankedStats.avgDamagePerMin.toFixed(0)}</p>
                  <p className="text-sm text-gray-400">Dmg/Min</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedStats.avgKills.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Kills</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedStats.avgDeaths.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Deaths</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedStats.avgAssists.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Assists</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedStats.avgCS.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg CS</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedStats.avgGold.toFixed(0)}</p>
                  <p className="text-sm text-gray-400">Avg Gold</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedStats.avgVisionScore.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Vision</p>
                </div>
              </div>
            </div>
          )}

          {/* Ranked Solo (Queue 420) Summary - Competitive Gamer Focus */}
          {rankedSoloMatches.length > 0 && (
            <div className="bg-[#010A13]/70 p-6 border-2 border-[#CDA434]">
              <h3 className="text-3xl font-bold text-[#CDA434] mb-2 text-center">Ranked Solo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{rankedSoloStats.totalGames}</p>
                  <p className="text-sm text-gray-400">Total Games</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{rankedSoloStats.wins}</p>
                  <p className="text-sm text-gray-400">Wins</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{rankedSoloStats.winRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-400">Win Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{rankedSoloStats.avgKDA.toFixed(2)}</p>
                  <p className="text-sm text-gray-400">Avg KDA</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{rankedSoloStats.avgTotalCS.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Total CS</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{rankedSoloStats.avgDamagePerMin.toFixed(0)}</p>
                  <p className="text-sm text-gray-400">Dmg/Min</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedSoloStats.avgKills.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Kills</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedSoloStats.avgDeaths.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Deaths</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedSoloStats.avgAssists.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Assists</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedSoloStats.avgCS.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg CS</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedSoloStats.avgGold.toFixed(0)}</p>
                  <p className="text-sm text-gray-400">Avg Gold</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{rankedSoloStats.avgVisionScore.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Vision</p>
                </div>
              </div>
            </div>
          )}

          {/* Casual Summary */}
          {casualMatches.length > 0 && (
            <div className="bg-[#010A13]/70 p-6 border border-[#CDA434]/30">
              <h3 className="text-3xl font-bold text-[#CDA434] mb-6 text-center">Casual Matches Statistics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{casualStats.totalGames}</p>
                  <p className="text-sm text-gray-400">Total Games</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">{casualStats.wins}</p>
                  <p className="text-sm text-gray-400">Wins</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-400">{casualStats.winRate.toFixed(1)}%</p>
                  <p className="text-sm text-gray-400">Win Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{casualStats.avgKDA.toFixed(2)}</p>
                  <p className="text-sm text-gray-400">Avg KDA</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{casualStats.avgTotalCS.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Total CS</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-cyan-400">{casualStats.avgDamagePerMin.toFixed(0)}</p>
                  <p className="text-sm text-gray-400">Dmg/Min</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{casualStats.avgKills.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Kills</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{casualStats.avgDeaths.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Deaths</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{casualStats.avgAssists.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Assists</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{casualStats.avgCS.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg CS</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{casualStats.avgGold.toFixed(0)}</p>
                  <p className="text-sm text-gray-400">Avg Gold</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-white">{casualStats.avgVisionScore.toFixed(1)}</p>
                  <p className="text-sm text-gray-400">Avg Vision</p>
                </div>
              </div>
            </div>
          )}

          {/* Match Data Tables - Separated by Ranked and Casual */}
          {renderMatchTable(rankedMatches, 'Ranked Matches')}
          {renderMatchTable(casualMatches, 'Casual Matches')}
        </div>
      </Section>

      {/* Shareable Card */}
      <Section title="Share Your Legend">
        <div className="bg-gradient-to-br from-[#0A1428] to-[#010A13] border-2 border-[#CDA434] p-8 max-w-3xl mx-auto">
            <p className="text-center text-2xl text-gray-400">Your 2025 Season Story</p>
            <h3 className="text-center text-5xl font-bold text-white mt-2">{analysis.summonerName}</h3>
            <div className="mt-6 border-t-2 border-[#CDA434]/50 pt-6 flex justify-around items-center text-center">
                <div>
                    <p className="text-xl text-gray-400">Archetype</p>
                    <p className="text-3xl font-bold text-[#CDA434]">{analysis.archetype.title}</p>
                    <p className="text-2xl text-cyan-400">{analysis.archetype.mbti}</p>
                </div>
                <div>
                     <p className="text-xl text-gray-400">Top Champion</p>
                    <p className="text-3xl font-bold text-white">{analysis.topChampions[0].name}</p>
                    <p className="text-2xl text-cyan-400">{analysis.topChampions[0].winRate}% WR</p>
                </div>
            </div>
            <button className="mt-8 w-full text-2xl font-bold uppercase tracking-widest text-[#010A13] bg-[#CDA434] px-8 py-3 border-2 border-[#CDA434] hover:bg-transparent hover:text-[#CDA434] transition-all duration-300">
                Share
            </button>
        </div>
      </Section>
    </div>
  );
};

export default ResultsPage;
