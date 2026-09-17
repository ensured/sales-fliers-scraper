import { NextRequest, NextResponse } from "next/server";
import {
  getCache,
  updateCacheSection,
  isSectionStale,
} from "@/lib/cache";
import { probeShopNKart } from "@/lib/probes";

// Download image and return as base64
async function downloadImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const isJpeg =
        url.toLowerCase().includes(".jpg") ||
        url.toLowerCase().includes(".jpeg");
      const mimeType = isJpeg ? "image/jpeg" : "image/png";
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    }
  } catch (error) {
    console.error("Failed to download image:", error);
  }
  return null;
}

export async function POST() {
  try {
    console.log("=== Shop N Kart Flyers API ===");

    // Get cached data from unified cache
    const cache = getCache();
    const cachedShopNKart = cache?.shopNKart;
    const cachedIon = cache?.ion;
    console.log("Cache status:", cache ? "exists" : "empty");

    // Fetch dates from page (single HTTP request)
    const { shopNKartDate, ionDate } = await probeShopNKart();

    // Update needed when the date marker changed, the section is too old
    // (flyers are frequently updated in place, so age alone must trigger a
    // re-download), or the cache holds no usable flyer data.
    const shopNKartNeedsUpdate =
      isSectionStale(cachedShopNKart) ||
      !cachedShopNKart?.flyerData ||
      (!!shopNKartDate && cachedShopNKart.dateRange !== shopNKartDate);
    const ionNeedsUpdate =
      isSectionStale(cachedIon) ||
      !cachedIon?.flyerData ||
      (!!ionDate && cachedIon.dateRange !== ionDate);

    console.log(
      "Shop N Kart needs update:",
      shopNKartNeedsUpdate,
      "| Ion needs update:",
      ionNeedsUpdate
    );

    // Prepare response data from cache first
    let shopNKartData = cachedShopNKart?.flyerData || null;
    let ionData = cachedIon?.flyerData || null;
    let shopNKartDateRange =
      cachedShopNKart?.dateRange || shopNKartDate || "";
    let ionDateRange = cachedIon?.dateRange || ionDate || "";

    // Download Shop N Kart flyer if needed
    let shopNKartDownloaded = false;
    if (shopNKartNeedsUpdate) {
      console.log("Downloading Shop N Kart flyer...");
      const fresh = await downloadImage(
        "https://ashlandshopnkart.com/index_htm_files/Ad%20Flyer.png"
      );
      if (fresh) {
        shopNKartData = fresh;
        // If the date couldn't be extracted this time, keep the cached marker
        // so we don't thrash the cache. Only a successful download updates it.
        shopNKartDateRange = shopNKartDate || cachedShopNKart?.dateRange || "";
        shopNKartDownloaded = true;
        updateCacheSection("shopNKart", {
          dateRange: shopNKartDateRange,
          flyerData: fresh,
        });
        console.log("Shop N Kart cache updated");
      } else {
        // Never overwrite a good cached flyer with empty data on a transient
        // failure - keep serving the last known good copy.
        console.warn(
          "Shop N Kart re-download failed; serving last good cache"
        );
      }
    } else {
      console.log("✓ Shop N Kart flyer - serving from cache");
    }

    // Download Ion flyer if needed
    let ionDownloaded = false;
    if (ionNeedsUpdate) {
      console.log("Downloading Ion flyer...");
      const fresh = await downloadImage(
        "https://ashlandshopnkart.com/index_htm_files/Ion%20Flyer.jpg"
      );
      if (fresh) {
        ionData = fresh;
        ionDateRange = ionDate || cachedIon?.dateRange || "";
        ionDownloaded = true;
        updateCacheSection("ion", {
          dateRange: ionDateRange,
          flyerData: fresh,
        });
        console.log("Ion cache updated");
      } else {
        console.warn("Ion re-download failed; serving last good cache");
      }
    } else {
      console.log("✓ Ion flyer - serving from cache");
    }

    return NextResponse.json({
      success: true,
      message: "Flyers fetched successfully",
      timestamp: new Date().toISOString(),
      // Shop N Kart flyer
      flyerData: shopNKartData,
      flyerFileName: "ashland-shop-n-kart-flyer.png",
      flyerUrl: "https://ashlandshopnkart.com/index_htm_files/Ad%20Flyer.png",
      dateRange: shopNKartDateRange,
      shopNKartCached: !shopNKartDownloaded,
      // Ion flyer
      ionFlyerData: ionData,
      ionFileName: "Ion%20Flyer.jpg",
      ionUrl: "https://ashlandshopnkart.com/index_htm_files/Ion%20Flyer.jpg",
      ionDateRange: ionDateRange,
      ionCached: !ionDownloaded,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch flyers",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
