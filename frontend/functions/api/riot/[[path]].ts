function tagToRegionalHost(tag: string): 'americas' | 'europe' | 'asia' | 'sea' |''{
  const t = tag.replace(/[^a-zA-Z0-9]/g, '')   // 去掉空格 / - / _
  .toUpperCase();                 

  // americas group
  if (t.startsWith('NA') || t.startsWith('BR') || t.startsWith('LA') || t.startsWith('OC')) {
    return 'americas';
  }
  // europe group
  if (t.startsWith('EU') || t.startsWith('TR') || t.startsWith('RU')) {
    return 'europe';
  }
  // asia group
  if (t.startsWith('KR') || t.startsWith('JP')) {
    return 'asia';
  }
  // sea group
  if (['PH2','SG2','TH2','TW2','VN2'].includes(t)) {
    return 'sea';
  }
  return '';
}

function extractPuuidFromPath(pathname: string): string | null {
  const byPuuidMatch = pathname.match(/\/by-puuid\/([^/?#]+)/i);
  if (byPuuidMatch && byPuuidMatch[1]) return byPuuidMatch[1];
  return null;
}

// CORS 白名单机制
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:8788',
  'https://league-mbti-analysis.pages.dev',
];

export async function onRequest(context: {
  request: Request;
  env: { RIOT_API_KEY?: string };
  params: Record<string, string>;
}) {
  const { request, env } = context;
  const url = new URL(request.url);
  const startTime = Date.now();
  const origin = request.headers.get('Origin') || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : '*';

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const apiKey = env.RIOT_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing RIOT_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin },
    });
  }

  // For Pages Functions under functions/api/riot/[[path]].ts, strip the prefix '/api'
  // Expected paths: /api/riot/account/... or /api/riot/lol/match/...
  const originalPath = url.pathname.substring('/api'.length);
  
  // Normalize path: ensure it starts with /riot/ or /lol/
  // If path is /riot/account/... or /riot/lol/match/..., use as is
  // If path is /lol/match/..., it's already correct for match endpoints
  
  const tagParam = url.searchParams.get('tag') || '';

  // Determine if this is an account endpoint or match endpoint that needs regional lookup
  const isAccountEndpoint = originalPath.startsWith('/riot/account/') || originalPath.startsWith('/account/');
  const isMatchEndpoint = originalPath.startsWith('/riot/lol/match/') || originalPath.startsWith('/lol/match/');
  
  // Check if this is a global account endpoint that doesn't need region lookup
  // /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine} is a global endpoint served from americas
  const isGlobalAccountEndpoint = originalPath.includes('/accounts/by-riot-id/');
  const hasPuuidInPath = extractPuuidFromPath(originalPath) !== null;
  const hasValidTag = tagParam && tagToRegionalHost(tagParam) !== '';
  
  const needsRegionalLookup = (isAccountEndpoint && hasPuuidInPath && !isGlobalAccountEndpoint) || 
                               (isMatchEndpoint && hasPuuidInPath && !hasValidTag);
  
  let targetHost = '';
  let finalPath = originalPath;
  
  if (needsRegionalLookup) {
    const puuid = extractPuuidFromPath(originalPath);
    
    // Validate required parameters for region lookup
    if (!puuid) {
      return new Response(JSON.stringify({ 
        error: 'Missing puuid', 
        details: 'Could not extract puuid from path. Path should contain /by-puuid/{puuid}. For match endpoints with matchId, provide ?tag=REGION parameter.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }
    
    try {
      // This endpoint is served from a regional cluster; asia hosts account for global queries reliably
      // API key MUST be in headers as X-Riot-Token, NOT in query string
      const regionLookupUrl = `https://asia.api.riotgames.com/riot/account/v1/region/by-game/lol/by-puuid/${encodeURIComponent(puuid)}`;
      const lookupResp = await fetch(regionLookupUrl, { 
        headers: { 
          'X-Riot-Token': apiKey 
        } 
      });
      
      if (lookupResp.ok) {
        const regionDto: { puuid: string; game: string; region: 'americas' | 'europe' | 'asia' | 'sea' } = await lookupResp.json();
        if (regionDto && regionDto.region) {
          // regionDto.region is already one of the regional host keys
          targetHost = `${tagToRegionalHost(regionDto.region)}.api.riotgames.com`;
          url.searchParams.delete('tag');
        } else {
          console.warn('[Functions] Region lookup response missing region field', { regionDto, originalPath });
          return new Response(JSON.stringify({ 
            error: 'Region lookup failed', 
            details: 'Region lookup response did not contain a valid region field. Please check the puuid or provide a ?tag parameter.' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
          });
        }
      } else {
        const errorText = await lookupResp.text().catch(() => 'Unknown error');
        console.error('[Functions] Failed to resolve active region', { 
          status: lookupResp.status, 
          statusText: lookupResp.statusText,
          error: errorText,
          url: regionLookupUrl,
          originalPath 
        });
        return new Response(JSON.stringify({ 
          error: 'Region lookup failed', 
          details: `Failed to resolve region for puuid. Status: ${lookupResp.status}. ${errorText}` 
        }), {
          status: lookupResp.status >= 500 ? 502 : lookupResp.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
        });
      }
    } catch (e) {
      console.error('[Functions] Error resolving active region', { 
        error: e instanceof Error ? e.message : 'Unknown',
        originalPath 
      });
      return new Response(JSON.stringify({ 
        error: 'Region lookup error', 
        details: `Error during region lookup: ${e instanceof Error ? e.message : 'Unknown error'}` 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }
  } else {
    // Handle cases where we don't need region lookup
    // 1. Global account endpoints (by-riot-id) use americas region
    if (isGlobalAccountEndpoint) {
      targetHost = 'americas.api.riotgames.com';
    }
    // 2. Use tag parameter to determine region
    else if (tagParam) {
      const regional = tagToRegionalHost(tagParam);
      if (regional) {
        targetHost = `${regional}.api.riotgames.com`;
        url.searchParams.delete('tag');
      } else {
        // Invalid tag, but we'll try to proceed with matchId extraction
        console.warn('[Functions] Invalid tag parameter, attempting to extract region from matchId', { tagParam, originalPath });
      }
    }
    // 3. For match endpoints with matchId (e.g., /lol/match/v5/matches/KR_680830235)
    // Try to extract region from matchId if no tag provided
    if (!targetHost && isMatchEndpoint) {
      const matchIdMatch = originalPath.match(/\/([A-Z]{2}_\d+)$/);
      if (matchIdMatch && matchIdMatch[1]) {
        const matchId = matchIdMatch[1];
        const regionPrefix = matchId.substring(0, 2);
        const regional = tagToRegionalHost(regionPrefix);
        if (regional) {
          targetHost = `${regional}.api.riotgames.com`;
        }
      }
    }
    
    // 4. For account endpoints without puuid and without global endpoint flag, use americas as default
    if (!targetHost && isAccountEndpoint && !hasPuuidInPath) {
      targetHost = 'americas.api.riotgames.com';
    }
    
    // If still no host determined, return error
    if (!targetHost) {
      return new Response(JSON.stringify({ 
        error: 'Missing region information', 
        details: 'Could not determine regional host. Please provide ?tag=REGION parameter (e.g., ?tag=KR, ?tag=NA1) or ensure the path contains a puuid for automatic region lookup.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
      });
    }
  }
  
  // Ensure path is in the correct format for Riot API
  // Account endpoints: /riot/account/v1/... (e.g., /riot/account/v1/accounts/by-riot-id/...)
  // Match endpoints: /lol/match/v5/... (e.g., /lol/match/v5/matches/by-puuid/... or /lol/match/v5/matches/KR_...)
  if (isAccountEndpoint) {
    // Account endpoints should have /riot/ prefix
    // If path is /riot/account/..., use as is
    // If path is /account/..., add /riot prefix
    if (originalPath.startsWith('/riot/account/')) {
      finalPath = originalPath;
    } else if (originalPath.startsWith('/account/')) {
      finalPath = `/riot${originalPath}`;
    } else {
      finalPath = originalPath.startsWith('/') ? `/riot${originalPath}` : `/riot/${originalPath}`;
    }
  } else if (isMatchEndpoint) {
    // Match endpoints should have /lol/match/ prefix (NOT /riot/lol/match/)
    // Remove /riot prefix if present: /riot/lol/match/... -> /lol/match/...
    if (originalPath.startsWith('/riot/lol/match/')) {
      finalPath = originalPath.substring('/riot'.length); // Remove /riot prefix
    } else if (originalPath.startsWith('/lol/match/')) {
      finalPath = originalPath; // Already correct
    } else {
      // Fallback: try to construct correct path
      finalPath = originalPath.startsWith('/') ? originalPath : `/${originalPath}`;
      if (!finalPath.startsWith('/lol/')) {
        finalPath = `/lol${finalPath}`;
      }
    }
  } else {
    // For other paths, use as is (might be other Riot API endpoints)
    finalPath = originalPath;
  }
  
  // At this point, targetHost should be set (either from region lookup or tag/matchId)
  // If not, it means there was an error in the logic above, which should have returned an error response
  if (!targetHost) {
    console.error('[Functions] Unexpected: targetHost is empty after all processing', { originalPath, isAccountEndpoint, isMatchEndpoint, hasPuuidInPath, tagParam });
    return new Response(JSON.stringify({ 
      error: 'Internal error', 
      details: 'Failed to determine target region. This should not happen. Please check the request path and parameters.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin }
    });
  }
  const targetUrl = `https://${targetHost}${finalPath}${url.search}`;
  console.log('targetURL', targetUrl);
  console.log('[Functions] Target URL:', targetUrl, '| Original path:', originalPath, '| Final path:', finalPath);
  const init: RequestInit = {
    method: request.method,
    headers: { 'X-Riot-Token': apiKey },
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }
  console.log('targetHost', targetHost);

  try {
    const upstream = await fetch(targetUrl, init);
    const durationMs = Date.now() - startTime;
    if (upstream.status === 403) {
      console.warn('[Functions] Forbidden from Riot API - possible invalid/expired API key', {
        status: upstream.status,
        durationMs,
        targetUrl,
      });
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          details: 'Riot API rejected the request. The API key may be invalid or expired.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } }
      );
    }
    const response = new Response(upstream.body, upstream);
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    console.log('[Functions] /api/riot', {
      status: upstream.status,
      durationMs,
      targetUrl,
    });
    return response;
  } catch (e) {
    console.error('[Functions] Proxy error', {
      targetUrl,
      error: e instanceof Error ? e.message : 'Unknown',
    });
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: e instanceof Error ? e.message : 'Unknown' }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin } }
    );
  }
}


