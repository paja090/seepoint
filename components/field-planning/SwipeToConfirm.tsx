'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronsRight, Check, Loader2, Camera, AlertCircle } from 'lucide-react';

export interface SwipeToConfirmProps {
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
  confirmedLabel?: string;
  photosCount?: number;
  hasPhotoWarning?: boolean;
  className?: string;
  resetKey?: string | number;
}

export function SwipeToConfirm({
  onConfirm,
  disabled = false,
  busy = false,
  label = 'Přejeďte pro hotovo ➔',
  confirmedLabel = 'Dokončeno ✓',
  photosCount,
  hasPhotoWarning = false,
  className = '',
  resetKey,
}: SwipeToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // References for touch/mouse drag calculations without stale state closures
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    maxDistance: 0,
    isSwipeDecided: false,
    hasPassedThreshold: false,
  });

  // Reset slider position & confirmed state when resetKey changes or when busy finishes while not confirmed
  useEffect(() => {
    setDragX(0);
    setIsDragging(false);
    setIsConfirmed(false);
  }, [resetKey]);

  useEffect(() => {
    if (!busy && !isConfirmed) {
      setDragX(0);
      setIsDragging(false);
    }
  }, [busy, isConfirmed]);

  // Compute maximum draggable distance inside track
  const measureTrack = useCallback(() => {
    const track = trackRef.current;
    const knob = knobRef.current;
    if (!track || !knob) return 200;
    const trackRect = track.getBoundingClientRect();
    const knobRect = knob.getBoundingClientRect();
    // 4px padding on each side
    const max = Math.max(50, trackRect.width - knobRect.width - 8);
    dragRef.current.maxDistance = max;
    return max;
  }, []);

  const triggerConfirm = useCallback(() => {
    const max = measureTrack();
    setDragX(max);
    setIsConfirmed(true);
    setIsDragging(false);

    // Haptic feedback for tactile satisfaction on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([20, 30, 40]);
      } catch {
        // Silently ignore if not supported or permitted
      }
    }

    try {
      void onConfirm();
    } catch {
      // Revert if synchronously throws
      setDragX(0);
      setIsConfirmed(false);
    }
  }, [measureTrack, onConfirm]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || busy || isConfirmed) return;
    const touch = e.touches[0];
    measureTrack();
    dragRef.current.startX = touch.clientX;
    dragRef.current.startY = touch.clientY;
    dragRef.current.isSwipeDecided = false;
    dragRef.current.hasPassedThreshold = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || busy || isConfirmed || !isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;

    // Disambiguate vertical page scrolling vs horizontal slider drag
    if (!dragRef.current.isSwipeDecided) {
      if (Math.abs(dy) > Math.abs(dx) + 4) {
        // User is scrolling the route page vertically; let native scroll handle it
        setIsDragging(false);
        setDragX(0);
        return;
      }
      if (Math.abs(dx) > 6) {
        dragRef.current.isSwipeDecided = true;
      }
    }

    if (dragRef.current.isSwipeDecided) {
      const max = dragRef.current.maxDistance;
      const clamped = Math.max(0, Math.min(dx, max));
      setDragX(clamped);

      // Light vibration tick when user crosses threshold (70%)
      const threshold = max * 0.7;
      if (clamped >= threshold && !dragRef.current.hasPassedThreshold) {
        dragRef.current.hasPassedThreshold = true;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(12);
          } catch {
            // ignore
          }
        }
      } else if (clamped < threshold) {
        dragRef.current.hasPassedThreshold = false;
      }
    }
  };

  const handleTouchEnd = () => {
    if (disabled || busy || isConfirmed || !isDragging) return;
    const max = dragRef.current.maxDistance;
    const threshold = max * 0.7;

    if (dragX >= threshold) {
      triggerConfirm();
    } else {
      // Spring smoothly back to 0
      setIsDragging(false);
      setDragX(0);
    }
  };

  // Mouse drag event handlers (desktop support)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || busy || isConfirmed || e.button !== 0) return;
    const startX = e.clientX;
    const max = measureTrack();
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const clamped = Math.max(0, Math.min(dx, max));
      setDragX(clamped);
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setIsDragging(false);

      const dx = upEvent.clientX - startX;
      if (dx >= max * 0.7) {
        triggerConfirm();
      } else {
        setDragX(0);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || busy || isConfirmed) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerConfirm();
    }
  };

  // Progress metrics (0 to 1)
  const maxDistance = dragRef.current.maxDistance || 200;
  const progress = maxDistance > 0 ? Math.min(1, dragX / maxDistance) : 0;
  const isPastThreshold = progress >= 0.7;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ touchAction: 'pan-y' }}
      className={`relative flex items-center h-12 w-full rounded-2xl overflow-hidden select-none border transition-colors shadow-2xs ${
        disabled
          ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
          : isConfirmed
          ? 'bg-emerald-600 border-emerald-700 text-white'
          : hasPhotoWarning
          ? 'bg-linear-to-r from-amber-50/70 via-emerald-50/40 to-teal-50/60 border-amber-300/80 hover:border-emerald-400'
          : 'bg-linear-to-r from-emerald-50/80 via-teal-50/50 to-emerald-100/60 border-emerald-300 hover:border-emerald-400'
      } ${className}`}
    >
      {/* Dynamic sliding fill behind the knob */}
      {!isConfirmed && (
        <div
          className={`absolute inset-y-0 left-0 bg-linear-to-r ${
            hasPhotoWarning
              ? 'from-amber-500 via-emerald-600 to-emerald-500'
              : 'from-emerald-700 via-emerald-600 to-teal-600'
          } rounded-2xl ${
            isDragging ? '' : 'transition-[width] duration-250 ease-out'
          }`}
          style={{
            width: dragX > 0 ? `calc(${dragX}px + 2.75rem)` : '0px',
          }}
        />
      )}

      {/* Center Label Text (fades as knob moves across) */}
      <div
        className={`absolute inset-0 flex items-center justify-center gap-2 pointer-events-none px-12 text-xs font-extrabold tracking-wide ${
          isConfirmed
            ? 'text-white'
            : isPastThreshold
            ? 'text-emerald-950 font-black'
            : hasPhotoWarning
            ? 'text-amber-950'
            : 'text-emerald-950'
        } ${isDragging ? '' : 'transition-opacity duration-200'}`}
        style={{
          opacity: isConfirmed ? 1 : Math.max(0.08, 1 - progress * 1.4),
        }}
      >
        {isConfirmed || busy ? (
          <span className="flex items-center gap-1.5 animate-pulse">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} />}
            <span>{busy ? 'Ukládám…' : confirmedLabel}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span>{isPastThreshold ? 'Uvolněte pro potvrzení ✓' : label}</span>
          </span>
        )}
      </div>

      {/* Optional Photo Hint Badge on the right */}
      {!isConfirmed && !busy && photosCount !== undefined && (
        <div
          className={`absolute right-2.5 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg border pointer-events-none transition-opacity ${
            isDragging && progress > 0.4 ? 'opacity-0' : 'opacity-100'
          } ${
            photosCount > 0
              ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300'
              : 'bg-amber-100/90 text-amber-900 border-amber-300 animate-pulse'
          }`}
          title={photosCount > 0 ? `Pořízeno ${photosCount} fotografií` : 'Zatím chybí fotografie'}
        >
          {photosCount > 0 ? (
            <>
              <Camera size={11} className="text-emerald-700" />
              <span>{photosCount}</span>
            </>
          ) : (
            <>
              <AlertCircle size={11} className="text-amber-600" />
              <span>Bez fotky</span>
            </>
          )}
        </div>
      )}

      {/* Draggable Knob (Thumb) */}
      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        className={`relative z-10 ml-1 flex items-center justify-center h-10 w-11 rounded-xl shadow-md transition-transform cursor-grab active:cursor-grabbing ${
          disabled
            ? 'bg-slate-200 text-slate-400'
            : isConfirmed
            ? 'bg-white text-emerald-700'
            : isPastThreshold
            ? 'bg-white text-emerald-700 shadow-emerald-700/30 ring-2 ring-emerald-500 scale-105'
            : 'bg-white text-emerald-800 hover:bg-emerald-50'
        } ${isDragging ? '' : 'transition-all duration-250 ease-out'}`}
        style={{
          transform: `translateX(${dragX}px)`,
        }}
        title="Přetažením doprava označíte zastávku jako hotovou"
      >
        {busy ? (
          <Loader2 size={17} className="animate-spin text-emerald-700" />
        ) : isConfirmed ? (
          <Check size={18} className="text-emerald-700" />
        ) : (
          <ChevronsRight
            size={18}
            className={`transition-transform ${
              isPastThreshold ? 'translate-x-0.5 text-emerald-600' : 'text-emerald-700'
            }`}
          />
        )}
      </div>
    </div>
  );
}
