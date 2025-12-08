"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "./ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

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
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    // Normalize deltaY for different input devices (mice vs trackpads)
    // Mice typically use deltaMode 0 with larger values, trackpads use smaller values
    const normalizedDelta = e.deltaY / (e.deltaMode === 0 ? 100 : 3);
    const zoomStep = Math.sign(normalizedDelta) * Math.min(Math.abs(normalizedDelta) * 0.05, 0.15);
    setScale((prev) => {
      const newScale = Math.max(0.5, Math.min(prev - zoomStep, 5));
      if (newScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newScale;
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scale > 1) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
      }
    },
    [scale, position]
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
    [isDragging, dragStart, scale]
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
    [scale, position]
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
    [isDragging, dragStart, scale]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <>
      <div
        className="group relative bg-card hover:shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 rounded-xl border border-border/50 overflow-hidden cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg text-card-foreground leading-tight group-hover:text-primary transition-colors">
              {title}
            </h3>
            {dateRange && (
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 whitespace-nowrap">
                {dateRange}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {description}
          </p>

          <div className="pt-2 flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
            Click to view flyer →
          </div>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-screen h-[calc(100vh-2rem)] max-w-none gap-0! my-3 overflow-hidden p-0! flex flex-col bg-background/95 backdrop-blur-sm border-none shadow-2xl rounded-lg">
          <div className="px-4 py-3 border-b flex items-center justify-start gap-2 bg-background/70 backdrop-blur-md z-10 sticky top-0">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground/90 flex justify-center items-center w-full">
              {title}
            </DialogTitle>
          </div>

          <div
            ref={containerRef}
            className="overflow-hidden h-[calc(100vh-9rem)] flex items-center justify-center bg-muted"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
          >
            {imageData ? (
              <img
                src={imageData}
                alt={title}
                className="object-contain select-none"
                draggable={false}
                style={{
                  maxWidth: scale <= 1 ? "100%" : "none",
                  maxHeight: scale <= 1 ? "100%" : "none",
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
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
