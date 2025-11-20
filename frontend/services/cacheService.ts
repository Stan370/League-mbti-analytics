/**
 * Multi-layer cache service for Riot API data
 * 
 * Layers:
 * 1. Memory cache (Map) - fastest, session-only
 * 2. IndexedDB - persistent client-side storage, survives page refresh
 * 
 * Future: Cloudflare KV for server-side edge caching
 */

const DB_NAME = 'riot-api-cache';
const DB_VERSION = 3;  // Bumped to trigger schema upgrade
const STORES = {
    PUUID: 'puuid',
    MATCH_IDS: 'matchIds',
    MATCH_DETAILS: 'matchDetails',
    REGION: 'region',
} as const;

// Cache TTL (Time To Live) in milliseconds
const CACHE_TTL = {
    PUUID: 7 * 24 * 60 * 60 * 1000, // 7 days (PUUIDs don't change)
    MATCH_IDS: 1 * 60 * 60 * 1000, // 1 hour (match lists can update)
    MATCH_DETAILS: 30 * 24 * 60 * 60 * 1000, // 30 days (match details never change)
    REGION: 30 * 24 * 60 * 60 * 1000, // 30 days (user region rarely changes)
} as const;

interface CacheEntry<T> {
    value: T;
    timestamp: number;
    ttl: number;
}

/**
 * Initialize IndexedDB database
 */
async function initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(STORES.PUUID)) {
                db.createObjectStore(STORES.PUUID);
            }
            if (!db.objectStoreNames.contains(STORES.MATCH_IDS)) {
                db.createObjectStore(STORES.MATCH_IDS);
            }
            if (!db.objectStoreNames.contains(STORES.MATCH_DETAILS)) {
                db.createObjectStore(STORES.MATCH_DETAILS);
            }
            if (!db.objectStoreNames.contains(STORES.REGION)) {
                db.createObjectStore(STORES.REGION);
            }
        };
    });
}

/**
 * Get value from IndexedDB
 */
async function getFromIndexedDB<T>(storeName: string, key: string): Promise<T | null> {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result as CacheEntry<T> | undefined;
                if (!result) {
                    resolve(null);
                    return;
                }

                // Check if expired
                const age = Date.now() - result.timestamp;
                if (age > result.ttl) {
                    // Expired, delete it
                    deleteFromIndexedDB(storeName, key).catch(console.warn);
                    resolve(null);
                    return;
                }

                resolve(result.value);
            };
        });
    } catch (error) {
        console.warn(`[Cache] IndexedDB get error for ${storeName}/${key}:`, error);
        return null;
    }
}

/**
 * Set value in IndexedDB
 */
async function setToIndexedDB<T>(storeName: string, key: string, value: T, ttl: number): Promise<void> {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const entry: CacheEntry<T> = {
                value,
                timestamp: Date.now(),
                ttl,
            };
            const request = store.put(entry, key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.warn(`[Cache] IndexedDB set error for ${storeName}/${key}:`, error);
    }
}

/**
 * Delete value from IndexedDB
 */
async function deleteFromIndexedDB(storeName: string, key: string): Promise<void> {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.warn(`[Cache] IndexedDB delete error for ${storeName}/${key}:`, error);
    }
}

/**
 * Clear all IndexedDB caches
 */
export async function clearIndexedDBCache(): Promise<void> {
    try {
        const db = await initDB();
        await Promise.all([
            new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([STORES.PUUID], 'readwrite');
                transaction.objectStore(STORES.PUUID).clear();
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            }),
            new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([STORES.MATCH_IDS], 'readwrite');
                transaction.objectStore(STORES.MATCH_IDS).clear();
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            }),
            new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([STORES.MATCH_DETAILS], 'readwrite');
                transaction.objectStore(STORES.MATCH_DETAILS).clear();
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            }),
            new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([STORES.REGION], 'readwrite');
                transaction.objectStore(STORES.REGION).clear();
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            }),
        ]);
        console.log('[Cache] IndexedDB cache cleared');
    } catch (error) {
        console.warn('[Cache] Error clearing IndexedDB:', error);
    }
}

// Memory cache (first layer)
const memoryCache = {
    puuid: new Map<string, string>(),
    matchIds: new Map<string, string[]>(),
    matchDetails: new Map<string, any>(),
    region: new Map<string, 'americas' | 'europe' | 'asia' | 'sea'>(),
};

/**
 * Get PUUID with multi-layer cache
 */
export async function getCachedPuuid(gameName: string, tagLine: string): Promise<string | null> {
    const key = `${gameName}#${tagLine}`;

    // Layer 1: Memory cache
    if (memoryCache.puuid.has(key)) {
        console.log(`[Cache] Memory hit: PUUID ${key}`);
        return memoryCache.puuid.get(key)!;
    }

    // Layer 2: IndexedDB
    const cached = await getFromIndexedDB<string>(STORES.PUUID, key);
    if (cached) {
        console.log(`[Cache] IndexedDB hit: PUUID ${key}`);
        memoryCache.puuid.set(key, cached); // Populate memory cache
        return cached;
    }

    return null;
}

/**
 * Set PUUID in all cache layers
 */
export async function setCachedPuuid(gameName: string, tagLine: string, puuid: string): Promise<void> {
    const key = `${gameName}#${tagLine}`;

    // Layer 1: Memory cache
    memoryCache.puuid.set(key, puuid);

    // Layer 2: IndexedDB
    await setToIndexedDB(STORES.PUUID, key, puuid, CACHE_TTL.PUUID);
}

/**
 * Get match IDs with multi-layer cache
 */
export async function getCachedMatchIds(puuid: string, queueId?: number): Promise<string[] | null> {
    const key = `${puuid}:${queueId ?? 'all'}`;

    // Layer 1: Memory cache
    if (memoryCache.matchIds.has(key)) {
        console.log(`[Cache] Memory hit: MatchIds ${key}`);
        return memoryCache.matchIds.get(key)!;
    }

    // Layer 2: IndexedDB
    const cached = await getFromIndexedDB<string[]>(STORES.MATCH_IDS, key);
    if (cached) {
        console.log(`[Cache] IndexedDB hit: MatchIds ${key}`);
        memoryCache.matchIds.set(key, cached); // Populate memory cache
        return cached;
    }

    return null;
}

/**
 * Set match IDs in all cache layers
 */
export async function setCachedMatchIds(puuid: string, queueId: number | undefined, matchIds: string[]): Promise<void> {
    const key = `${puuid}:${queueId ?? 'all'}`;

    // Layer 1: Memory cache
    memoryCache.matchIds.set(key, matchIds);

    // Layer 2: IndexedDB
    await setToIndexedDB(STORES.MATCH_IDS, key, matchIds, CACHE_TTL.MATCH_IDS);
}

/**
 * Get match details with multi-layer cache
 */
export async function getCachedMatchDetails<T>(matchId: string): Promise<T | null> {
    // Layer 1: Memory cache
    if (memoryCache.matchDetails.has(matchId)) {
        console.log(`[Cache] Memory hit: MatchDetails ${matchId}`);
        return memoryCache.matchDetails.get(matchId) as T;
    }

    // Layer 2: IndexedDB
    const cached = await getFromIndexedDB<T>(STORES.MATCH_DETAILS, matchId);
    if (cached) {
        console.log(`[Cache] IndexedDB hit: MatchDetails ${matchId}`);
        memoryCache.matchDetails.set(matchId, cached); // Populate memory cache
        return cached;
    }

    return null;
}

/**
 * Set match details in all cache layers
 */
export async function setCachedMatchDetails<T>(matchId: string, matchDetails: T): Promise<void> {
    // Layer 1: Memory cache
    memoryCache.matchDetails.set(matchId, matchDetails);

    // Layer 2: IndexedDB
    await setToIndexedDB(STORES.MATCH_DETAILS, matchId, matchDetails, CACHE_TTL.MATCH_DETAILS);
}

/**
 * Get region with multi-layer cache
 * Key format: "gameName#tagLine" to match PUUID cache pattern
 */
export async function getCachedRegion(gameName: string, tagLine: string): Promise<'americas' | 'europe' | 'asia' | 'sea' | null> {
    const key = `${gameName}#${tagLine}`;

    // Layer 1: Memory cache
    if (memoryCache.region.has(key)) {
        console.log(`[Cache] Memory hit: Region ${key}`);
        return memoryCache.region.get(key)!;
    }

    // Layer 2: IndexedDB
    const cached = await getFromIndexedDB<'americas' | 'europe' | 'asia' | 'sea'>(STORES.REGION, key);
    if (cached) {
        console.log(`[Cache] IndexedDB hit: Region ${key}`);
        memoryCache.region.set(key, cached); // Populate memory cache
        return cached;
    }

    return null;
}

/**
 * Set region in all cache layers
 */
export async function setCachedRegion(gameName: string, tagLine: string, region: 'americas' | 'europe' | 'asia' | 'sea'): Promise<void> {
    const key = `${gameName}#${tagLine}`;

    // Layer 1: Memory cache
    memoryCache.region.set(key, region);

    // Layer 2: IndexedDB
    await setToIndexedDB(STORES.REGION, key, region, CACHE_TTL.REGION);
}

/**
 * Clear all memory caches
 */
export function clearMemoryCache(): void {
    memoryCache.puuid.clear();
    memoryCache.matchIds.clear();
    memoryCache.matchDetails.clear();
    memoryCache.region.clear();
    console.log('[Cache] Memory cache cleared');
}

/**
 * Clear all caches (memory + IndexedDB)
 */
export async function clearAllCaches(): Promise<void> {
    clearMemoryCache();
    await clearIndexedDBCache();
}

