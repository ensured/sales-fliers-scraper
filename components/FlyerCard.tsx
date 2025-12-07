"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PDFViewer from "@/app/components/PDFViewer";
import { Button } from "./ui/button";

interface FlyerCardProps {
  title: string;
  description: string;
  pdfData?: string;
  pdfFileName?: string;
  url?: string;
  onDocumentLoadSuccess?: (numPages: number) => void;
  onPdfError?: (error: Error) => void;
}

export default function FlyerCard({
  title,
  description,
  pdfData,
  pdfFileName,
  url,
  onDocumentLoadSuccess,
  onPdfError,
}: FlyerCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Extract date from URL or filename
  const extractDateFromUrl = (url?: string): string | null => {
    if (!url) return null;

    // Handle "Month X to Month Y" pattern (e.g., "December%203%20to%20December%209")
    const monthRangePattern =
      /(January|February|March|April|May|June|July|August|September|October|November|December)%20(\d{1,2})%20to%20(January|February|March|April|May|June|July|August|September|October|November|December)%20(\d{1,2})/;
    const monthRangeMatch = url.match(monthRangePattern);
    if (monthRangeMatch) {
      const [, startMonth, startDay, endMonth, endDay] = monthRangeMatch;
      const startMonthAbbr = startMonth.slice(0, 3);
      const endMonthAbbr = endMonth.slice(0, 3);
      return `${startMonthAbbr} ${startDay} – ${endMonthAbbr} ${endDay}`;
    }

    // Handle single month with range (e.g., "December%203%20to%209")
    const singleMonthRangePattern =
      /(January|February|March|April|May|June|July|August|September|October|November|December)%20(\d{1,2})%20to%20(\d{1,2})/;
    const singleMonthRangeMatch = url.match(singleMonthRangePattern);
    if (singleMonthRangeMatch) {
      const [, month, startDay, endDay] = singleMonthRangeMatch;
      const monthAbbr = month.slice(0, 3);
      return `${monthAbbr} ${startDay} – ${monthAbbr} ${endDay}`;
    }

    // Common date patterns in URLs
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /\d{2}-\d{2}-\d{4}/, // MM-DD-YYYY
      /\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
      /\d{8}/, // YYYYMMDD
    ];

    for (const pattern of datePatterns) {
      const match = url.match(pattern);
      if (match) {
        const dateStr = match[0];
        // Try to parse and format the date
        let formattedDate: string;

        if (dateStr.includes("-")) {
          formattedDate = dateStr; // Already in readable format
        } else if (dateStr.includes("/")) {
          formattedDate = dateStr; // Already in readable format
        } else if (dateStr.length === 8) {
          // YYYYMMDD format
          formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(
            4,
            6
          )}-${dateStr.slice(6, 8)}`;
        } else {
          formattedDate = dateStr;
        }

        return formattedDate;
      }
    }

    return null;
  };

  // Extract date from filename as fallback
  const extractDateFromFilename = (filename?: string): string | null => {
    if (!filename) return null;

    // Decode URL-encoded filename
    const decodedFilename = decodeURIComponent(filename);

    // Handle "Month X to Month Y" pattern in filename (e.g., "December 3 to December 9")
    const monthRangePattern =
      /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}) to (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})/i;
    const monthRangeMatch = decodedFilename.match(monthRangePattern);
    if (monthRangeMatch) {
      const [, startMonth, startDay, endMonth, endDay] = monthRangeMatch;
      const startMonthAbbr = startMonth.slice(0, 3);
      const endMonthAbbr = endMonth.slice(0, 3);
      return `${startMonthAbbr} ${startDay} – ${endMonthAbbr} ${endDay}`;
    }

    // Handle single month with range (e.g., "December 3 to 9")
    const singleMonthRangePattern =
      /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}) to (\d{1,2})/i;
    const singleMonthRangeMatch = decodedFilename.match(
      singleMonthRangePattern
    );
    if (singleMonthRangeMatch) {
      const [, month, startDay, endDay] = singleMonthRangeMatch;
      const monthAbbr = month.slice(0, 3);
      return `${monthAbbr} ${startDay} – ${monthAbbr} ${endDay}`;
    }

    // Common date patterns in filenames
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /\d{2}-\d{2}-\d{4}/, // MM-DD-YYYY
      /\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /\d{4}\/\d{2}\/\d{2}/, // YYYY/MM/DD
      /\d{8}/, // YYYYMMDD
    ];

    for (const pattern of datePatterns) {
      const match = decodedFilename.match(pattern);
      if (match) {
        const dateStr = match[0];
        // Try to parse and format the date
        let formattedDate: string;

        if (dateStr.includes("-")) {
          formattedDate = dateStr; // Already in readable format
        } else if (dateStr.includes("/")) {
          formattedDate = dateStr; // Already in readable format
        } else if (dateStr.length === 8) {
          // YYYYMMDD format
          formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(
            4,
            6
          )}-${dateStr.slice(6, 8)}`;
        } else {
          formattedDate = dateStr;
        }

        return formattedDate;
      }
    }

    return null;
  };

  const extractedDate =
    extractDateFromUrl(url) || extractDateFromFilename(pdfFileName);

  return (
    <>
      <div
        className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:bg-accent transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-card-foreground truncate">
            {title}
          </h3>
          {pdfData && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2"
            >
              View
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-1">
          {description}
        </p>
        {extractedDate && (
          <p className="text-xs text-muted-foreground/70 font-medium mt-1">
            {extractedDate}
          </p>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none overflow-hidden p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-lg font-medium">
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="h-[calc(100vh-80px)]">
            {pdfData ? (
              <PDFViewer
                file={pdfData}
                onDocumentLoadSuccess={onDocumentLoadSuccess}
                onError={onPdfError}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                PDF not available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
