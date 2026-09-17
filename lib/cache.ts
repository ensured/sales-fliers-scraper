import fs from "fs";
import path from "path";

// Unified cache structure for all flyers
// Every section carries its own `lastUpdated` timestamp so we can
// revalidate by age (TTL), not only by URL/date-marker changes.
export interface UnifiedCache {
  shopNKart?: {
    dateRange: string;
    flyerData: string;
    lastUpdated?: string;
  };
  ion?: {
    dateRange: string;
    flyerData: string;
    lastUpdated?: string;
  };
  marketOfChoice?: {
    pdfDate: string;
    dateRange: string;
    pdfData: string;
    lastUpdated?: string;
  };
  ashlandCoop?: {
    pdfData: string | null;
    pdfFileName: string | null;
    nationalCoopPdfData: string | null;
    nationalCoopPdfFileName: string | null;
    mainFlyerLink: string | null;
    nationalCoopLink: string | null;
    lastUpdated: string;
  };
  albertsons?: {
    flyers: Array<{
      title: string;
      dateRange: string;
      imageUrl: string;
    }>;
    lastUpdated: string;
  };
  timestamp: string;
}

// How long a cached flyer is trusted before it is re-downloaded, even if its
// URL/date marker hasn't changed. Stores frequently update a flyer in place
// (same file, same date text on the page) mid-week, so age is the only
// reliable way to pick up those updates.
export const FLYER_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// True when a cached section has no timestamp or is older than the TTL.
// Sections written before this fix (or corrupted to empty data) have no
// timestamp, so they are treated as stale and refreshed on the next request.
export function isSectionStale(
  section: { lastUpdated?: string } | null | undefined,
  ttlMs: number = FLYER_CACHE_TTL_MS
): boolean {
  if (!section) {
    return true;
  }
  const lastUpdated = section.lastUpdated;
  if (!lastUpdated) {
    return true;
  }
  const updatedAt = new Date(lastUpdated).getTime();
  if (Number.isNaN(updatedAt)) {
    return true;
  }
  return Date.now() - updatedAt > ttlMs;
}

const CACHE_FILE = "flyers-cache.json";

// Get cache file path
export function getCachePath(): string {
  return path.join(process.cwd(), "public", "downloads", CACHE_FILE);
}

// Get the downloads directory path
export function getDownloadsDir(): string {
  return path.join(process.cwd(), "public", "downloads");
}

// Ensure downloads directory exists
export function ensureDownloadsDir(): void {
  const dir = getDownloadsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Get all cached data
export function getCache(): UnifiedCache | null {
  try {
    const cachePath = getCachePath();
    if (fs.existsSync(cachePath)) {
      const cacheData = fs.readFileSync(cachePath, "utf-8");
      return JSON.parse(cacheData);
    }
  } catch (error) {
    console.error("Failed to read cache:", error);
  }
  return null;
}

// Save entire cache
export function saveCache(data: UnifiedCache): void {
  try {
    ensureDownloadsDir();
    const cachePath = getCachePath();
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save cache:", error);
  }
}

// Update a specific section of the cache
// Always stamps `lastUpdated` so TTL revalidation works for every section,
// including ones (like shopNKart/ion) that don't set it themselves.
export function updateCacheSection<K extends keyof UnifiedCache>(
  section: K,
  data: UnifiedCache[K]
): void {
  const cache = getCache() || { timestamp: "" };
  if (data && typeof data === "object" && !("lastUpdated" in data)) {
    (data as { lastUpdated: string }).lastUpdated = new Date().toISOString();
  }
  cache[section] = data;
  cache.timestamp = new Date().toISOString();
  saveCache(cache);
}

// Get a specific section of the cache
export function getCacheSection<K extends keyof UnifiedCache>(
  section: K
): UnifiedCache[K] | null {
  const cache = getCache();
  return cache?.[section] ?? null;
}
