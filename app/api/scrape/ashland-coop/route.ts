import { NextResponse } from "next/server";
import {
  getCache,
  updateCacheSection,
  ensureDownloadsDir,
  isSectionStale,
} from "@/lib/cache";
import { probeAshlandCoop } from "@/lib/probes";

// Download PDF and return as base64
async function downloadPdf(url: string): Promise<string | null> {
  try {
    console.log("Downloading PDF:", url);
    const response = await fetch(url);
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer.toString("base64");
    }
    console.error("PDF download failed, status:", response.status);
  } catch (error) {
    console.error("Failed to download PDF:", error);
  }
  return null;
}

// Helper function to create response
function createResponse(
  success: boolean,
  message: string,
  pdfData?: string | null,
  pdfFileName?: string | null,
  mainFlyerLink?: string | null,
  error?: string
) {
  return NextResponse.json(
    {
      success,
      message,
      timestamp: new Date().toISOString(),
      pdfData: pdfData ? `data:application/pdf;base64,${pdfData}` : null,
      pdfFileName,
      mainFlyerLink,
      error,
    },
    error ? { status: 500 } : undefined
  );
}

export async function POST() {
  try {
    console.log("=== Ashland Food Coop Flyer API ===");
    ensureDownloadsDir();

    // Get cached data
    const cache = getCache();
    const cachedCoop = cache?.ashlandCoop;
    console.log("Cache status:", cache ? "exists" : "empty");

    // Probe the sales flyer page for the current PDF link (cheap)
    const { mainFlyerLink, mainFlyerFileName } = await probeAshlandCoop();

    if (!mainFlyerLink) {
      throw new Error("Failed to find flyer PDF link on the sales-flyer page");
    }

    // Update needed when the flyer filename changed, the section is older
    // than the TTL (flyers are sometimes replaced at the same filename), or
    // the cache holds no usable data. Failed downloads keep the last good
    // cached copy instead of overwriting it with nothing.
    const cacheTooOld = isSectionStale(cachedCoop);
    const needsMainUpdate =
      !cachedCoop?.pdfData ||
      cacheTooOld ||
      cachedCoop.pdfFileName !== mainFlyerFileName;

    console.log("Main flyer needs update:", needsMainUpdate);

    // Prepare data from cache
    let pdfData = cachedCoop?.pdfData || null;
    let pdfFileName = cachedCoop?.pdfFileName || null;

    // Download main flyer if needed
    if (needsMainUpdate) {
      console.log("Downloading main flyer...");
      const data = await downloadPdf(mainFlyerLink);
      if (data) {
        pdfData = data;
        pdfFileName = mainFlyerFileName;
      }
    } else {
      console.log("✓ Main flyer - serving from cache");
    }

    // Update cache if anything changed
    if (needsMainUpdate && pdfData) {
      updateCacheSection("ashlandCoop", {
        pdfData,
        pdfFileName,
        mainFlyerLink,
        lastUpdated: new Date().toISOString(),
      });
      console.log("Cache updated");
    }

    return createResponse(
      true,
      pdfData ? "Successfully downloaded Ashland Food Coop flyer" : "No flyer found",
      pdfData,
      pdfFileName,
      mainFlyerLink
    );
  } catch (error) {
    console.error("API error:", error);
    return createResponse(
      false,
      "Failed to fetch Ashland Food Coop flyer",
      undefined,
      undefined,
      undefined,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
