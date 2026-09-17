"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";

interface ImageFlyerCardProps {
  title: string;
  description: string;
  imageData?: string;
  imageFileName?: string;
  url?: string;
  dateRange?: string;
}

export default function ImageFlyerCard({
  title,
  description,
  imageData,
  imageFileName,
  url,
  dateRange,
}: ImageFlyerCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(
    null,
  );

  // Reset zoom and position when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.2, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.2, 0.5);
      // Reset position if zooming back to 1 or below
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Use native non-passive listener to properly preventDefault (fixes "zoom too much" browser interference)
  useEffect(() => {
    const container = containerNode;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const normalizedDelta = e.deltaY / (e.deltaMode === 0 ? 100 : 3);
      // Tuned clamp: max 4% change per event (doubled from ultra-conservative 2%)
      const zoomStep =
        Math.sign(normalizedDelta) *
        Math.min(Math.abs(normalizedDelta) * 0.4, 0.5);

      setScale((prev) => {
        const newScale = Math.max(0.5, Math.min(prev - zoomStep, 5));
        if (newScale <= 1 && prev > 1) {
          setPosition({ x: 0, y: 0 });
        }
        return newScale;
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [containerNode]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale > 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [scale, position],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && scale > 1) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, scale],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (scale > 1 && e.touches.length === 1) {
        const touch = e.touches[0];
        setIsDragging(true);
        setDragStart({
          x: touch.clientX - position.x,
          y: touch.clientY - position.y,
        });
      }
    },
    [scale, position],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDragging && scale > 1 && e.touches.length === 1) {
        const touch = e.touches[0];
        setPosition({
          x: touch.clientX - dragStart.x,
          y: touch.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, scale],
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <>
      <div
        className="group relative bg-card hover:shadow-xl hover:shadow-black/3 dark:hover:shadow-black/15 transition-all duration-300 ease-out hover:-translate-y-1 rounded-xl border border-border/50 overflow-hidden cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-base text-card-foreground leading-snug group-hover:text-primary transition-colors">
              {title}
            </h3>
            {dateRange && (
              <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground whitespace-nowrap shrink-0">
                {dateRange}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>

          <div className="pt-1 flex items-center gap-1.5 text-xs font-medium text-primary/70 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 duration-300">
            <span>Click to view</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-screen h-[calc(100vh-2rem)] max-w-none gap-0! my-3 overflow-hidden p-0! flex flex-col bg-background/95 backdrop-blur-sm border-none shadow-2xl rounded-xl"
        >
          <div className="px-5 py-3.5 border-b border-border/60 flex items-center gap-3 bg-background/70 backdrop-blur-md z-10 sticky top-0">
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground/90 truncate flex-1">
              {title}
            </DialogTitle>
            {dateRange && (
              <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md shrink-0">
                {dateRange}
              </span>
            )}
            <DialogClose asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full shadow-sm hover:bg-accent"
                aria-label="Close flyer"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogClose>
          </div>

          <div
            ref={setContainerNode}
            className="relative overflow-hidden h-[calc(100vh-9rem)] flex items-center justify-center bg-muted/50"
            // Native wheel listener attached in useEffect
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              cursor:
                scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            }}
          >
            {/* Floating controls on the image itself - zoom left, Close right */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 z-10 pointer-events-none">
              <div className="pointer-events-auto flex items-center gap-1 bg-secondary/50 rounded-full p-1 border border-border/50 backdrop-blur-sm shadow-sm">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-accent"
                  onClick={handleZoomOut}
                  disabled={scale <= 0.5}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                  <span className="sr-only">Zoom Out</span>
                </Button>
                <div className="flex items-center justify-center min-w-10 px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground select-none">
                  {Math.round(scale * 100)}%
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-accent"
                  onClick={handleZoomIn}
                  disabled={scale >= 5}
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                  <span className="sr-only">Zoom In</span>
                </Button>
                <div className="w-px h-4 bg-border mx-0.5" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="hover:bg-accent"
                  onClick={handleReset}
                  disabled={scale === 1 && position.x === 0 && position.y === 0}
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="sr-only">Reset</span>
                </Button>
              </div>
              <DialogClose asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="pointer-events-auto h-8 rounded-full gap-1 px-3 shadow-sm hover:bg-accent"
                  aria-label="Close flyer"
                  title="Close flyer (Esc)"
                >
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </DialogClose>
            </div>

            {imageData ? (
              <img
                src={imageData}
                alt={title}
                className="object-contain select-none block"
                draggable={false}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: "auto",
                  height: "auto",
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  // Removing transition to prevent lag/jumps during mouse wheel zooming
                  transition: "none",
                }}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Flyer not available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
