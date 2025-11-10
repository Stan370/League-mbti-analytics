
// A simplified version of the Riot API Match-v5 DTO
// Based on the provided JSON and common usage

export interface MatchDto {
    metadata: MetadataDto;
    info: InfoDto;
}

export interface MetadataDto {
    matchId: string;
    participants: string[]; // List of PUUIDs
}

export interface InfoDto {
    gameDuration: number;
    gameEndTimestamp: number;
    gameMode: string;
    gameType?: string;
    queueId: number; // 420 = Ranked Solo/Duo, 440 = Ranked Flex, etc.
    participants: ParticipantDto[];
    teams: TeamDto[];
}

export interface ParticipantDto {
    assists: number;
    championName: string;
    deaths: number;
    goldEarned: number;
    individualPosition: string; // "TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"
    kills: number;
    lane: string;
    puuid: string;
    riotIdGameName: string;
    riotIdTagline: string;
    teamId: number;
    teamPosition: string;
    timePlayed: number;
    totalDamageDealtToChampions: number;
    totalDamageShieldedOnTeammates: number;
    totalHeal: number;
    totalHealsOnTeammates: number;
    totalMinionsKilled: number;
    neutralMinionsKilled: number;
    turretKills: number;
    turretTakedowns: number;
    damageDealtToBuildings: number;
    visionScore: number;
    wardsKilled: number;
    wardsPlaced: number;
    win: boolean;
}

export interface TeamDto {
    teamId: number;
    win: boolean;
    objectives: ObjectivesDto;
}

export interface ObjectivesDto {
    baron: ObjectiveDto;
    champion: ObjectiveDto;
    dragon: ObjectiveDto;
    inhibitor: ObjectiveDto;
    riftHerald: ObjectiveDto;
    tower: ObjectiveDto;
}

export interface ObjectiveDto {
    first: boolean;
    kills: number;
}

// Queue ID constants
/**
 * Queue ID to name mapping
 */
export const QUEUE_NAMES: Record<number, string> = {
    400: '5v5 Draft Pick games',
    420: '5v5 Ranked Solo games',
    430: '5v5 Blind Pick games',
    440: '5v5 Ranked Flex games',
    450: '5v5 ARAM games',
    490: '5v5 quickplay',
};

/**
 * Ranked queue IDs
 */
export const RANKED_QUEUE_IDS: number[] = [420, 440];

/**
 * Casual queue IDs
 */
export const CASUAL_QUEUE_IDS: number[] = [400, 430, 450, 490];

/**
 * All allowed queue IDs (union of ranked and casual)
 */
export const ALLOWED_QUEUE_IDS: number[] = [...RANKED_QUEUE_IDS, ...CASUAL_QUEUE_IDS];
