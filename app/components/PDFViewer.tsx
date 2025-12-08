"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { pdfjsLib } from "@/lib/pdfjs";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

interface PDFViewerProps {
  file: string;
  onDocumentLoadSuccess?: (numPages: number) => void;
  onError?: (error: Error) => void;
}

export default function PDFViewer({
  file,
  onDocumentLoadSuccess,
  onError,
}: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [renderScale] = useState<number>(2); // Fixed render scale for crisp canvas
  const [viewScale, setViewScale] = useState<number>(1); // Visual zoom scale
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        // Handle data URI format
        let pdfData: string | Uint8Array = file;
        if (file.startsWith("data:application/pdf;base64,")) {
          // Extract base64 data from data URI
          const base64Data = file.split(",")[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          pdfData = bytes;
        }

        const loadingTask = pdfjsLib.getDocument(pdfData);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        onDocumentLoadSuccess?.(pdf.numPages);
      } catch (error) {
        console.error("Error loading PDF:", error);
        onError?.(
          error instanceof Error ? error : new Error("Failed to load PDF")
        );
      }
    };

    if (file) {
      loadPDF();
    }
  }, [file, onDocumentLoadSuccess, onError]);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        // Cancel any previous render task
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {
            // Ignore cancellation errors
          }
          renderTaskRef.current = null;
        }

        const page: PDFPageProxy = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Check if dark mode is enabled
        const isDarkMode =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;

        // Set canvas background based on theme
        context.fillStyle = isDarkMode ? "#1f2937" : "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        // Store the render task so we can cancel it if needed
        renderTaskRef.current = page.render(renderContext);
        await renderTaskRef.current.promise;
        renderTaskRef.current = null;
      } catch (error) {
        if (
          error instanceof Error &&
          error.message &&
          error.message.includes("cancelled")
        ) {
          // Render was cancelled, don't treat as error
          return;
        }
        console.error("Error rendering page:", error);
        onError?.(
          error instanceof Error ? error : new Error("Failed to render page")
        );
      }
    };

    renderPage();

    // Cleanup function to cancel render when component unmounts or dependencies change
    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNumber, renderScale, onError]);

  // Reset position when page changes
  useEffect(() => {
    setPosition({ x: 0, y: 0 });
  }, [pageNumber]);

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPageNumber = prevPageNumber + offset;
      return Math.min(Math.max(1, newPageNumber), numPages);
    });
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const handleZoomIn = useCallback(() => {
    setViewScale((prev) => Math.min(prev + 0.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewScale((prev) => {
      const newScale = Math.max(prev - 0.2, 0.5);
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleReset = useCallback(() => {
    setViewScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setViewScale((prev) => {
      const newScale = Math.max(0.5, Math.min(prev + delta, 5));
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (viewScale > 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [viewScale, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && viewScale > 1) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, viewScale]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (viewScale > 1 && e.touches.length === 1) {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({
          x: touch.clientX - position.x,
          y: touch.clientY - position.y,
        });
      }
    },
    [viewScale, position]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDragging && viewScale > 1 && e.touches.length === 1) {
        const touch = e.touches[0];
        setPosition({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, viewScale]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="flex flex-col w-full h-full">
      {/* Controls Bar - Top */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Page Navigation */}
        {numPages > 1 ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="icon"
              onClick={previousPage}
              disabled={pageNumber <= 1}
              className="h-9 w-9 rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
              {pageNumber} / {numPages}
            </span>
            <Button
              variant="secondary"
              size="icon"
              onClick={nextPage}
              disabled={pageNumber >= numPages}
              className="h-9 w-9 rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div /> // Empty div to maintain flex spacing
        )}

        {/* Zoom Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomOut}
            className="h-9 w-9 rounded-full"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium min-w-[60px] text-center">
            {Math.round(viewScale * 100)}%
          </div>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleZoomIn}
            className="h-9 w-9 rounded-full"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleReset}
            className="h-9 w-9 rounded-full"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-gray-900"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: viewScale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        <canvas
          ref={canvasRef}
          className="shadow-md rounded-lg select-none"
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${viewScale})`,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
            maxWidth: "100%",
            height: "auto",
          }}
        />
      </div>
    </div>
  );
}
