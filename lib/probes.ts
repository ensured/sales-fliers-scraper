// Lightweight "is there a new flyer?" probes. These only fetch the small
// HTML pages / issue cheap HEAD requests to extract the current version
// markers (date strings, PDF filenames) - they NEVER download the flyers
// themselves. The client uses them to decide whether a cached flyer is
// still current, so page reloads don't re-download multi-MB flyers.
const PROBE_TIMEOUT_MS = 10_000;

async function probeFetch(
  url: string,
  init?: RequestInit
): Promise<Response | null> {
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Probe fetch failed:", url, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shop N Kart (weekly) + Ion (monthly) flyers on ashlandshopnkart.com
// ---------------------------------------------------------------------------

export function extractShopNKartDates(html: string): {
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

export async function probeShopNKart(): Promise<{
  shopNKartDate: string | null;
  ionDate: string | null;
}> {
  const response = await probeFetch("https://ashlandshopnkart.com/");
  if (!response || !response.ok) {
    return { shopNKartDate: null, ionDate: null };
  }
  return extractShopNKartDates(await response.text());
}

// ---------------------------------------------------------------------------
// Market of Choice weekly PDF
// ---------------------------------------------------------------------------

// Extract date from PDF URL like:
// https://static.marketofchoice.com/uploads/2025/12/2025-12-05-MoC-Weekly-Specials.pdf
export function extractMoCDateFromUrl(url: string): string | null {
  const match = url.match(/(\d{4}-\d{2}-\d{2})-MoC/);
  return match ? match[1] : null;
}

export async function probeMarketOfChoice(): Promise<{
  pdfDate: string | null;
}> {
  // HEAD request - cheap, no body. We compare the date in the final
  // redirect URL to the marker stored with the cached flyer.
  const response = await probeFetch(
    "https://marketofchoice.com/download-weekly-specials",
    { method: "HEAD", redirect: "follow" }
  );
  if (!response || !response.ok) {
    return { pdfDate: null };
  }
  return { pdfDate: extractMoCDateFromUrl(response.url) };
}

// ---------------------------------------------------------------------------
// Ashland Food Co-op PDFs
// ---------------------------------------------------------------------------

const COOP_BASE_URL = "https://ashlandfood.coop";

export function extractCoopPdfLinks(html: string): {
  mainFlyerLink: string | null;
} {
  // Main flyer is in /sites/default/files/sales-flyers/
  // Can be absolute or relative URL
  const mainFlyerMatch = html.match(
    /href="((?:https:\/\/ashlandfood\.coop)?\/sites\/default\/files\/sales-flyers\/[^"]+\.pdf)"/i
  );
  let mainFlyerLink = mainFlyerMatch ? mainFlyerMatch[1] : null;
  if (mainFlyerLink && !mainFlyerLink.startsWith("http")) {
    mainFlyerLink = COOP_BASE_URL + mainFlyerLink;
  }

  return { mainFlyerLink };
}

export function extractFilename(url: string): string {
  const urlFileName = url.split("/").pop() || "flyer.pdf";
  return decodeURIComponent(urlFileName);
}

export async function probeAshlandCoop(): Promise<{
  mainFlyerLink: string | null;
  mainFlyerFileName: string | null;
}> {
  const response = await probeFetch(`${COOP_BASE_URL}/sales-flyer`);
  if (!response || !response.ok) {
    return { mainFlyerLink: null, mainFlyerFileName: null };
  }
  const { mainFlyerLink } = extractCoopPdfLinks(await response.text());
  return {
    mainFlyerLink,
    mainFlyerFileName: mainFlyerLink ? extractFilename(mainFlyerLink) : null,
  };
}