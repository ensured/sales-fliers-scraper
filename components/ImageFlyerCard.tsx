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
    setScale((prev) => Math.min(prev + 0.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const newScale = Math.max(prev - 0.5, 0.5);
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
        className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-900 rounded-sm p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {title}
          </h3>
          {imageData && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              View
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {description}
        </p>
        {dateRange && (
          <p className="text-xs text-gray-300 dark:text-gray-600 font-medium">
            {dateRange}
          </p>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none overflow-hidden p-0">
          <DialogHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-medium text-gray-900 dark:text-white">
                {title}
              </DialogTitle>
              {/* Zoom Controls - Horizontal */}
              <div className="flex items-center gap-2 mr-8">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleZoomOut}
                  className="h-9 w-9 rounded-full shadow-sm"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <div className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm font-medium min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleZoomIn}
                  className="h-9 w-9 rounded-full shadow-sm"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleReset}
                  className="h-9 w-9 rounded-full shadow-sm"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div
            ref={containerRef}
            className="overflow-hidden h-[calc(100vh-60px)] flex items-center justify-center bg-gray-100 dark:bg-gray-900"
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
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                Flyer not available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
