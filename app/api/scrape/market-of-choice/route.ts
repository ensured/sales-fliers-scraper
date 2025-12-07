import { NextResponse } from "next/server";
import { getCache, updateCacheSection } from "@/lib/cache";

// Extract date from PDF URL like: https://static.marketofchoice.com/uploads/2025/12/2025-12-05-MoC-Weekly-Specials.pdf
function extractDateFromUrl(url: string): string | null {
  // Match pattern: YYYY-MM-DD in the filename
  const match = url.match(/(\d{4}-\d{2}-\d{2})-MoC/);
  if (match) {
    return match[1]; // Returns e.g., "2025-12-05"
  }
  return null;
}

// Calculate a 7-day date range string from a YYYY-MM-DD date
// e.g., "2025-12-05" -> "Dec 5 – Dec 11, 2025"
function calculateDateRange(pdfDate: string): string {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const startDate = new Date(pdfDate + "T00:00:00");
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6); // 7 days total (including start)

  const startMonth = monthNames[startDate.getMonth()];
  const startDay = startDate.getDate();
  const endMonth = monthNames[endDate.getMonth()];
  const endDay = endDate.getDate();
  const year = endDate.getFullYear();

  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
}

// Check the current PDF date without downloading the full file
async function getCurrentPdfDate(): Promise<string | null> {
  try {
    console.log("Checking current PDF date...");
    const response = await fetch(
      "https://marketofchoice.com/download-weekly-specials",
      {
        method: "HEAD",
        redirect: "follow",
      }
    );

    if (response.ok) {
      const finalUrl = response.url;
      console.log("Current PDF URL:", finalUrl);
      return extractDateFromUrl(finalUrl);
    }
  } catch (error) {
    console.error("Failed to check PDF date:", error);
  }
  return null;
}

// Download PDF and calculate date range from URL date
async function downloadPdf(): Promise<{
  pdfData: string;
  pdfDate: string;
  dateRange: string;
} | null> {
  try {
    console.log("Downloading Market of Choice PDF...");
    const response = await fetch(
      "https://marketofchoice.com/download-weekly-specials",
      {
        redirect: "follow",
      }
    );

    if (response.ok) {
      // Get the final URL after redirects to extract the date
      const finalUrl = response.url;
      console.log("Final PDF URL:", finalUrl);

      const pdfDate = extractDateFromUrl(finalUrl);
      console.log("Extracted PDF date from URL:", pdfDate);

      const buffer = Buffer.from(await response.arrayBuffer());

      // Calculate date range from URL date (7-day week starting from that date)
      const dateRange = pdfDate ? calculateDateRange(pdfDate) : "Current Week";
      console.log("Calculated date range:", dateRange);

      const pdfDataBase64 = `data:application/pdf;base64,${buffer.toString(
        "base64"
      )}`;

      return {
        pdfData: pdfDataBase64,
        pdfDate: pdfDate || new Date().toISOString().split("T")[0],
        dateRange,
      };
    } else {
      console.error("Failed to download PDF, status:", response.status);
    }
  } catch (error) {
    console.error("Failed to download PDF:", error);
  }
  return null;
}

export async function POST() {
  try {
    console.log("=== Market of Choice Flyer API ===");

    // Get cached data from unified cache
    const cache = getCache();
    const cachedMoc = cache?.marketOfChoice;
    console.log("Cache status:", cache ? "exists" : "empty");
    console.log("Cached PDF date:", cachedMoc?.pdfDate);

    // Check current PDF date from the redirect URL
    const currentPdfDate = await getCurrentPdfDate();
    console.log("Current PDF date:", currentPdfDate);

    // Check if cache is still valid (same PDF date)
    const needsUpdate =
      !cachedMoc || !currentPdfDate || cachedMoc.pdfDate !== currentPdfDate;

    console.log("Needs update:", needsUpdate);

    let pdfData = cachedMoc?.pdfData || null;
    let pdfDate = cachedMoc?.pdfDate || null;
    let dateRange = cachedMoc?.dateRange || "Current Week";

    if (needsUpdate) {
      console.log("Downloading new flyer...");
      const downloadResult = await downloadPdf();

      if (downloadResult) {
        pdfData = downloadResult.pdfData;
        pdfDate = downloadResult.pdfDate;
        dateRange = downloadResult.dateRange;

        // Update cache section
        updateCacheSection("marketOfChoice", {
          pdfDate: pdfDate,
          dateRange: dateRange,
          pdfData: pdfData,
        });
        console.log("Cache updated");
      }
    } else {
      console.log("✓ Market of Choice flyer - serving from cache");
    }

    return NextResponse.json({
      success: true,
      message: "Flyer fetched successfully",
      timestamp: new Date().toISOString(),
      pdfData: pdfData,
      pdfFileName: "market-of-choice-weekly.pdf",
      dateRange: dateRange,
      pdfDate: pdfDate,
      cached: !needsUpdate,
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch flyer",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
