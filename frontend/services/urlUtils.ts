/**
 * URL utility functions for encoding/decoding summoner names and regions
 */

/**
 * Extract platform from tag line (e.g., "KR1" -> "KR", "NA1" -> "NA1")
 * Platform is the tag line itself (e.g., "KR1", "NA1", "EUW1")
 */
export function extractPlatformFromTag(tagLine: string): string {
  return tagLine.toUpperCase();
}

/**
 * Convert platform to regional host for match-v5 API
 * KR, JP -> asia
 * NA, BR, LA, OC -> americas
 * EU, TR, RU -> europe
 * PH2, SG2, TH2, TW2, VN2 -> sea
 */
export function platformToRegionalHost(platform: string): 'americas' | 'europe' | 'asia' | 'sea' {
  const p = platform.toUpperCase().replace(/[0-9]/g, '');
  
  if (p.startsWith('KR') || p.startsWith('JP')) {
    return 'asia';
  }
  if (p.startsWith('NA') || p.startsWith('BR') || p.startsWith('LA') || p.startsWith('OC')) {
    return 'americas';
  }
  if (p.startsWith('EU') || p.startsWith('TR') || p.startsWith('RU')) {
    return 'europe';
  }
  if (['PH2', 'SG2', 'TH2', 'TW2', 'VN2'].includes(platform.toUpperCase())) {
    return 'sea';
  }
  
  // Default to americas
  return 'americas';
}

/**
 * Convert summoner name with tag to URL-safe format
 * e.g., "faker#KR2" -> "faker-KR2"
 */
export function encodeSummonerForUrl(summonerName: string, tagLine: string): string {
  // Replace # with - for URL safety
  return `${summonerName}-${tagLine}`;
}

/**
 * Convert URL-safe format back to summoner name with tag
 * e.g., "faker-KR2" -> { summonerName: "faker", tagLine: "KR2" }
 */
export function decodeSummonerFromUrl(summonerId: string): { summonerName: string; tagLine: string } | null {
  // Find the last occurrence of - followed by uppercase letters and numbers (tag format)
  // This handles cases like "faker-KR2" or "summoner-name-NA1"
  const match = summonerId.match(/^(.+)-([A-Z0-9]+)$/);
  if (!match) {
    return null;
  }
  
  const [, summonerName, tagLine] = match;
  return { summonerName, tagLine };
}

/**
 * Generate profile URL path
 * e.g., { platform: "KR", summonerName: "Faker", tagLine: "KR1" } -> "/profile/kr/Faker-KR1"
 * Note: URL uses lowercase platform for consistency
 */
export function generateProfileUrl(platform: string, summonerName: string, tagLine: string): string {
  const summonerId = encodeSummonerForUrl(summonerName, tagLine);
  const platformLower = platform.toLowerCase().replace(/[0-9]/g, '');
  return `/profile/${platformLower}/${summonerId}`;
}

/**
 * Parse profile URL path
 * e.g., "/profile/kr/Faker-KR1" -> { platform: "KR1", summonerName: "Faker", tagLine: "KR1" }
 */
export function parseProfileUrl(pathname: string) {
    const match = pathname.match(/^\/profile\/([^/]+)\/([^/]+)$/);
    if (!match) return null;
  
    const platformPath = match[1]; // "kr"
    const nameTag = match[2];      // "Faker-KR1"
  
    const [summonerName, tagLineRaw] = nameTag.split('-');
    if (!summonerName || !tagLineRaw) return null;
  
    const tagLine = tagLineRaw.toUpperCase(); // "KR1"
  
    return {
      platformPath,    // UI 使用
      summonerName,    // "Faker"
      tagLine,         // "KR1" → 用这个去查 Riot Account API
    };
  }

