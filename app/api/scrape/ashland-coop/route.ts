import { NextResponse } from "next/server";
import { getCache, updateCacheSection, ensureDownloadsDir } from "@/lib/cache";

// Helper function to extract PDF links from HTML
function extractPdfLinks(html: string): {
  mainFlyerLink: string | null;
  nationalCoopLink: string | null;
} {
  // Look for main flyer link (sales-flyers directory, not Co+op_Deals)
  const mainFlyerMatch = html.match(
    /href="(https:\/\/ashlandfood\.coop\/wp-content\/uploads\/sales-flyers\/[^"]+\.pdf)"/i
  );
  let mainFlyerLink = mainFlyerMatch ? mainFlyerMatch[1] : null;

  // Look for National Co-op link (contains Co+op_Deals or Co%2Bop_Deals)
  const coopMatch = html.match(
    /href="(https:\/\/ashlandfood\.coop\/wp-content\/uploads\/sales-flyers\/[^"]*Co(?:\+|%2B)op_Deals[^"]*\.pdf)"/i
  );
  const nationalCoopLink = coopMatch ? coopMatch[1] : null;

  // If mainFlyerLink is actually the coop link, try to find another
  if (mainFlyerLink && nationalCoopLink && mainFlyerLink === nationalCoopLink) {
    // Find all PDF links and pick the first non-coop one
    const allLinks = html.matchAll(
      /href="(https:\/\/ashlandfood\.coop\/wp-content\/uploads\/sales-flyers\/[^"]+\.pdf)"/gi
    );
    for (const match of allLinks) {
      const link = match[1];
      if (!link.includes("Co+op") && !link.includes("Co%2Bop")) {
        mainFlyerLink = link;
        break;
      }
    }
  }

  console.log("Extracted PDF links:", { mainFlyerLink, nationalCoopLink });
  return { mainFlyerLink, nationalCoopLink };
}

// Extract filename from URL
function extractFilename(url: string): string {
  const urlFileName = url.split("/").pop() || "flyer.pdf";
  return decodeURIComponent(urlFileName);
}

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
  nationalCoopPdfData?: string | null,
  nationalCoopPdfFileName?: string | null,
  mainFlyerLink?: string | null,
  nationalCoopLink?: string | null,
  error?: string
) {
  return NextResponse.json(
    {
      success,
      message,
      timestamp: new Date().toISOString(),
      pdfData: pdfData ? `data:application/pdf;base64,${pdfData}` : null,
      pdfFileName,
      nationalCoopPdfData: nationalCoopPdfData
        ? `data:application/pdf;base64,${nationalCoopPdfData}`
        : null,
      nationalCoopPdfFileName,
      mainFlyerLink,
      nationalCoopLink,
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

    // Fetch the sales flyer page to get current PDF links
    console.log("Fetching ashlandfood.coop/sales-flyer...");
    const response = await fetch("https://ashlandfood.coop/sales-flyer", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const html = await response.text();
    const { mainFlyerLink, nationalCoopLink } = extractPdfLinks(html);

    // Check if we need to update based on links changing
    const mainFlyerFileName = mainFlyerLink
      ? extractFilename(mainFlyerLink)
      : null;
    const nationalCoopFileName = nationalCoopLink
      ? extractFilename(nationalCoopLink)
      : null;

    const needsMainUpdate =
      !cachedCoop?.pdfData || cachedCoop.pdfFileName !== mainFlyerFileName;
    const needsCoopUpdate =
      !cachedCoop?.nationalCoopPdfData ||
      cachedCoop.nationalCoopPdfFileName !== nationalCoopFileName;

    console.log(
      "Main flyer needs update:",
      needsMainUpdate,
      "| National Co-op needs update:",
      needsCoopUpdate
    );

    // Prepare data from cache
    let pdfData = cachedCoop?.pdfData || null;
    let pdfFileName = cachedCoop?.pdfFileName || null;
    let nationalCoopPdfData = cachedCoop?.nationalCoopPdfData || null;
    let nationalCoopPdfFileName = cachedCoop?.nationalCoopPdfFileName || null;

    // Download main flyer if needed
    if (needsMainUpdate && mainFlyerLink) {
      console.log("Downloading main flyer...");
      const data = await downloadPdf(mainFlyerLink);
      if (data) {
        pdfData = data;
        pdfFileName = mainFlyerFileName;
      }
    } else if (!needsMainUpdate) {
      console.log("✓ Main flyer - serving from cache");
    }

    // Download National Co-op flyer if needed
    if (needsCoopUpdate && nationalCoopLink) {
      console.log("Downloading National Co-op flyer...");
      const data = await downloadPdf(nationalCoopLink);
      if (data) {
        nationalCoopPdfData = data;
        nationalCoopPdfFileName = nationalCoopFileName;
      }
    } else if (!needsCoopUpdate) {
      console.log("✓ National Co-op flyer - serving from cache");
    }

    // Update cache if anything changed
    if (needsMainUpdate || needsCoopUpdate) {
      updateCacheSection("ashlandCoop", {
        pdfData,
        pdfFileName,
        nationalCoopPdfData,
        nationalCoopPdfFileName,
        mainFlyerLink,
        nationalCoopLink,
        lastUpdated: new Date().toISOString(),
      });
      console.log("Cache updated");
    }

    return createResponse(
      true,
      pdfData || nationalCoopPdfData
        ? "Successfully downloaded Ashland Food Coop flyers"
        : "No flyers found",
      pdfData,
      pdfFileName,
      nationalCoopPdfData,
      nationalCoopPdfFileName,
      mainFlyerLink,
      nationalCoopLink
    );
  } catch (error) {
    console.error("API error:", error);
    return createResponse(
      false,
      "Failed to fetch Ashland Food Coop flyers",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
