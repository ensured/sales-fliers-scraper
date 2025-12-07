import fs from "fs";
import path from "path";

// Unified cache structure for all flyers
export interface UnifiedCache {
  shopNKart?: {
    dateRange: string;
    flyerData: string;
  };
  ion?: {
    dateRange: string;
    flyerData: string;
  };
  marketOfChoice?: {
    pdfDate: string;
    dateRange: string;
    pdfData: string;
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
export function updateCacheSection<K extends keyof UnifiedCache>(
  section: K,
  data: UnifiedCache[K]
): void {
  const cache = getCache() || { timestamp: "" };
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
