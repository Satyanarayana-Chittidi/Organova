'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Move } from 'lucide-react';

interface AvatarCropperModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => Promise<void>;
  isUploading?: boolean;
}

export default function AvatarCropperModal({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
  isUploading = false,
}: AvatarCropperModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const [imgSize, setImgSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 360, height: 360 });
  const [processing, setProcessing] = useState<boolean>(false);

  const circleDiameter = Math.min(containerSize.width * 0.72, 260);

  useEffect(() => {
    if (!imageSrc || !isOpen) {
      setImgElement(null);
      setImgSize({ width: 0, height: 0 });
      setPan({ x: 0, y: 0 });
      setZoom(1);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImgElement(img);
      setImgSize({ width: img.naturalWidth, height: img.naturalHeight });
      setPan({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const measure = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };

    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !processing && !isUploading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, processing, isUploading, onClose]);

  const baseScale =
    imgSize.width && imgSize.height
      ? Math.min(containerSize.width / imgSize.width, containerSize.height / imgSize.height)
      : 1;

  const currentScale = baseScale * zoom;

  const clampPan = useCallback(
    (targetPan: { x: number; y: number }, scale: number) => {
      if (!imgSize.width || !imgSize.height) return targetPan;

      const dispW = imgSize.width * scale;
      const dispH = imgSize.height * scale;

      let maxPanX: number;
      if (dispW >= circleDiameter) {
        maxPanX = (dispW - circleDiameter) / 2;
      } else {
        maxPanX = Math.max(0, (containerSize.width - dispW) / 2);
      }

      let maxPanY: number;
      if (dispH >= circleDiameter) {
        maxPanY = (dispH - circleDiameter) / 2;
      } else {
        maxPanY = Math.max(0, (containerSize.height - dispH) / 2);
      }

      return {
        x: Math.min(maxPanX, Math.max(-maxPanX, targetPan.x)),
        y: Math.min(maxPanY, Math.max(-maxPanY, targetPan.y)),
      };
    },
    [imgSize, circleDiameter, containerSize]
  );

  useEffect(() => {
    setPan((prev) => clampPan(prev, baseScale * zoom));
  }, [zoom, baseScale, clampPan]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (processing || isUploading) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...pan };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const targetPan = {
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    };
    setPan(clampPan(targetPan, currentScale));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    const nextZoom = Math.min(3.5, Math.max(0.8, Number((zoom + delta).toFixed(2))));
    setZoom(nextZoom);
    setPan((prev) => clampPan(prev, baseScale * nextZoom));
  };

  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);
    setPan((prev) => clampPan(prev, baseScale * newZoom));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCropAndApply = useCallback(async () => {
    if (!imgElement || !imgSize.width || !imgSize.height || processing || isUploading) return;
    setProcessing(true);

    try {
      const destSize = 512;
      const canvas = document.createElement('canvas');
      canvas.width = destSize;
      canvas.height = destSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, destSize, destSize);

      const M = destSize / circleDiameter;

      const canvasImgW = imgSize.width * currentScale * M;
      const canvasImgH = imgSize.height * currentScale * M;

      const canvasImgX = destSize / 2 + pan.x * M - canvasImgW / 2;
      const canvasImgY = destSize / 2 + pan.y * M - canvasImgH / 2;

      ctx.drawImage(imgElement, canvasImgX, canvasImgY, canvasImgW, canvasImgH);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setProcessing(false);
            return;
          }
          try {
            await onCropComplete(blob);
          } finally {
            setProcessing(false);
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('Failed to crop avatar:', err);
      setProcessing(false);
    }
  }, [
    imgElement,
    imgSize,
    circleDiameter,
    currentScale,
    pan,
    onCropComplete,
    processing,
    isUploading,
  ]);

  if (!isOpen || !imageSrc) return null;

  const isBusy = processing || isUploading;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200"
      onClick={() => !isBusy && onClose()}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-sm sm:max-w-md w-full shadow-2xl flex flex-col items-center gap-5 text-white animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Adjust Profile Photo</h3>
            <p className="text-xs text-slate-400 mt-0.5">Drag and zoom to fit inside the circle</p>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="relative w-80 h-80 sm:w-96 sm:h-96 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 cursor-grab active:cursor-grabbing touch-none select-none flex items-center justify-center shadow-inner"
        >
          {imgElement && imgSize.width > 0 && (
            <img
              src={imageSrc}
              alt="Avatar crop target"
              draggable={false}
              style={{
                position: 'absolute',
                width: `${imgSize.width * currentScale}px`,
                height: `${imgSize.height * currentScale}px`,
                left: `calc(50% + ${pan.x}px)`,
                top: `calc(50% + ${pan.y}px)`,
                transform: 'translate(-50%, -50%)',
                maxWidth: 'none',
                maxHeight: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              style={{
                width: `${circleDiameter}px`,
                height: `${circleDiameter}px`,
              }}
              className="rounded-full border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] relative"
            >
              <div className="absolute inset-0 rounded-full border border-white/20" />
            </div>
          </div>

          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] text-slate-300 font-medium pointer-events-none flex items-center gap-1.5 shadow-sm border border-white/10">
            <Move className="w-3 h-3 text-rose-400" />
            Drag to reposition
          </div>
        </div>

        <div className="flex items-center gap-3 w-full px-2">
          <button
            type="button"
            disabled={isBusy || zoom <= 0.8}
            onClick={() => handleZoomChange(Math.max(0.8, Number((zoom - 0.15).toFixed(2))))}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <input
            type="range"
            min="0.8"
            max="3.5"
            step="0.02"
            value={zoom}
            disabled={isBusy}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="flex-1 accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />

          <button
            type="button"
            disabled={isBusy || zoom >= 3.5}
            onClick={() => handleZoomChange(Math.min(3.5, Number((zoom + 0.15).toFixed(2))))}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono text-slate-400 w-10 text-right">
            {zoom.toFixed(1)}x
          </span>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleReset}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
            title="Reset position and zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 w-full pt-1 border-t border-slate-800">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleCropAndApply}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs shadow-lg shadow-rose-950/40 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isBusy ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Applying...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Profile Photo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
