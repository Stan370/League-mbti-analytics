
import React from 'react';
import type { AnalysisResult } from '../types';
import { BrainCircuitIcon, CrosshairIcon, SwordsIcon } from '../components/icons';

export const analyzePlayerMock = (summonerNameWithTag: string): Promise<AnalysisResult> => {
  const [summonerName, tag] = (summonerNameWithTag || "Prototype#NA1").split('#');
  
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        summonerName: summonerName,
        tag: tag,
        archetype: {
          title: "The Grandmaster",
          mbti: "INTJ",
          description: "A strategic visionary who outthinks the opponent. Your game is a complex chess match, and you're always five moves ahead, controlling the flow of the game through superior macro play and calculated decisions.",
          imageUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Azir_0.jpg',
        },
        strengths: [
          {
            title: "Macro Mastermind",
            description: "Your superior map awareness and vision control give your team a significant strategic advantage.",
            icon: React.createElement(BrainCircuitIcon, { className: "w-8 h-8 text-[#CDA434]" }),
          },
          {
            title: "Economic Powerhouse",
            description: "You are a master of resource acquisition, consistently out-farming opponents to build an insurmountable lead.",
            icon: React.createElement(CrosshairIcon, { className: "w-8 h-8 text-[#CDA434]" }),
          },
          {
            title: "Teamfight Titan",
            description: "You consistently top the damage charts, acting as your team's primary damage threat in every fight.",
            icon: React.createElement(SwordsIcon, { className: "w-8 h-8 text-[#CDA434]" }),
          },
        ],
        growthCurve: [
          { month: "Jan", winRate: 52, kda: 3.8 },
          { month: "Feb", winRate: 55, kda: 4.1 },
          { month: "Mar", winRate: 54, kda: 4.0 },
          { month: "Apr", winRate: 58, kda: 4.5 },
          { month: "May", winRate: 62, kda: 5.1 },
          { month: "Jun", winRate: 60, kda: 4.9 },
        ],
        topChampions: [
          {
            name: 'Azir',
            gamesPlayed: 12,
            winRate: 75,
            kda: '6.2 / 2.1 / 7.8',
            imageUrl: 'https://ddragon.leagueoflegends.com/cdn/14.15.1/img/champion/Azir.png',
            playstyleAnalysis: 'Your Azir shows a dominant, control-mage performance, focusing on zoning and massive teamfight damage.',
          },
          {
            name: 'Jhin',
            gamesPlayed: 5,
            winRate: 60,
            kda: '8.1 / 3.4 / 9.2',
            imageUrl: 'https://ddragon.leagueoflegends.com/cdn/14.15.1/img/champion/Jhin.png',
            playstyleAnalysis: 'Your Jhin is a masterpiece of long-range devastation, executing enemies with calculated precision.',
          },
          {
            name: 'LeeSin',
            gamesPlayed: 3,
            winRate: 33,
            kda: '4.5 / 5.8 / 6.1',
            imageUrl: 'https://ddragon.leagueoflegends.com/cdn/14.15.1/img/champion/LeeSin.png',
            playstyleAnalysis: 'Your Lee Sin displays an aggressive, early-game ganking style, aiming for highlight-reel plays.',
          },
        ],
        matchData: [
          {
            matchId: 'MOCK_001',
            gameEndTimestamp: Date.now() - 86400000,
            queueId: 420,
            kills: 8,
            deaths: 2,
            assists: 12,
            totalMinionsKilled: 180,
            neutralMinionsKilled: 15,
            totalDamageDealtToChampions: 25000,
            goldEarned: 12000,
            championName: 'Azir',
            teamId: 100,
            win: true,
            position: 'MIDDLE',
            visionScore: 25,
            gameDuration: 1800,
            gameMode: 'CLASSIC',
          },
          {
            matchId: 'MOCK_002',
            gameEndTimestamp: Date.now() - 172800000,
            queueId: 420,
            kills: 12,
            deaths: 4,
            assists: 8,
            totalMinionsKilled: 200,
            neutralMinionsKilled: 8,
            totalDamageDealtToChampions: 32000,
            goldEarned: 15000,
            championName: 'Jhin',
            teamId: 200,
            win: true,
            position: 'BOTTOM',
            visionScore: 18,
            gameDuration: 2100,
            gameMode: 'CLASSIC',
          },
        ],
        aggregatedSummary: {
          totalGames: 20,
          wins: 12,
          winRate: 60,
          avgKills: 7.5,
          avgDeaths: 3.2,
          avgAssists: 9.8,
          avgKDA: 5.4,
          avgCS: 185,
          avgTotalCS: 198,
          avgDamage: 28000,
          avgGold: 13000,
          avgVisionScore: 22,
          avgDamagePerMin: 650,
          avgGoldPerMin: 420,
        },
      });
    }, 2500);
  });
};
