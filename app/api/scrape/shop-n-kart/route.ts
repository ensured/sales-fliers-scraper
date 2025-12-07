import { NextRequest, NextResponse } from "next/server";
import { getCache, updateCacheSection, UnifiedCache } from "@/lib/cache";

// Extract both dates from HTML content
function extractDatesFromHtml(html: string): {
  shopNKartDate: string | null;
  ionDate: string | null;
} {
  // Shop N Kart weekly date: "December 3-9 2025"
  const weeklyPattern =
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})-(\d{1,2})\s+(\d{4})/i;
  const weeklyMatch = html.match(weeklyPattern);
  let shopNKartDate = null;
  if (weeklyMatch) {
    const [, month, startDay, endDay] = weeklyMatch;
    const monthAbbr = month.slice(0, 3);
    shopNKartDate = `${monthAbbr} ${startDay} – ${monthAbbr} ${endDay}`;
  }

  // Ion monthly date: "December 2025" from xr_s36 span
  const monthlyPattern =
    /<span class="Normal_text xr_s36"[^>]*>([A-Za-z]+\s+\d{4})<\/span>/;
  const monthlyMatch = html.match(monthlyPattern);
  let ionDate = monthlyMatch ? monthlyMatch[1] : null;

  // Fallback for ion date
  if (!ionDate) {
    const fallbackPattern =
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/g;
    const allMatches = html.match(fallbackPattern);
    if (allMatches && allMatches.length > 0) {
      ionDate = allMatches[allMatches.length - 1];
    }
  }

  return { shopNKartDate, ionDate };
}

// Fetch page and extract both dates
async function checkDatesFromPage(): Promise<{
  shopNKartDate: string | null;
  ionDate: string | null;
}> {
  try {
    console.log("Fetching dates from ashlandshopnkart.com...");
    const response = await fetch("https://ashlandshopnkart.com/", {
      cache: "no-store",
    });

    if (!response.ok) {
      return { shopNKartDate: null, ionDate: null };
    }

    const html = await response.text();
    const dates = extractDatesFromHtml(html);
    console.log(
      "Extracted dates - Shop N Kart:",
      dates.shopNKartDate,
      "| Ion:",
      dates.ionDate
    );
    return dates;
  } catch (error) {
    console.error("Failed to check dates:", error);
    return { shopNKartDate: null, ionDate: null };
  }
}

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
    const { shopNKartDate, ionDate } = await checkDatesFromPage();

    // Check what needs updating
    const shopNKartNeedsUpdate =
      !cachedShopNKart || cachedShopNKart.dateRange !== shopNKartDate;
    const ionNeedsUpdate = !cachedIon || cachedIon.dateRange !== ionDate;

    console.log(
      "Shop N Kart needs update:",
      shopNKartNeedsUpdate,
      "| Ion needs update:",
      ionNeedsUpdate
    );

    // Prepare response data from cache first
    let shopNKartData = cachedShopNKart?.flyerData || null;
    let ionData = cachedIon?.flyerData || null;
    let shopNKartDateRange = cachedShopNKart?.dateRange || shopNKartDate;
    let ionDateRange = cachedIon?.dateRange || ionDate;

    // Download Shop N Kart flyer if needed
    if (shopNKartNeedsUpdate) {
      console.log("Downloading Shop N Kart flyer...");
      shopNKartData = await downloadImage(
        "https://ashlandshopnkart.com/index_htm_files/Ad%20Flyer.png"
      );
      shopNKartDateRange = shopNKartDate;
      // Update cache section
      updateCacheSection("shopNKart", {
        dateRange: shopNKartDateRange || "",
        flyerData: shopNKartData || "",
      });
      console.log("Shop N Kart cache updated");
    } else {
      console.log("✓ Shop N Kart flyer - serving from cache");
    }

    // Download Ion flyer if needed
    if (ionNeedsUpdate) {
      console.log("Downloading Ion flyer...");
      ionData = await downloadImage(
        "https://ashlandshopnkart.com/index_htm_files/Ion%20Flyer.jpg"
      );
      ionDateRange = ionDate;
      // Update cache section
      updateCacheSection("ion", {
        dateRange: ionDateRange || "",
        flyerData: ionData || "",
      });
      console.log("Ion cache updated");
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
      shopNKartCached: !shopNKartNeedsUpdate,
      // Ion flyer
      ionFlyerData: ionData,
      ionFileName: "Ion%20Flyer.jpg",
      ionUrl: "https://ashlandshopnkart.com/index_htm_files/Ion%20Flyer.jpg",
      ionDateRange: ionDateRange,
      ionCached: !ionNeedsUpdate,
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
