import React from 'react';
import './range-slider.css';
import { cn } from '@/lib/utils';

export interface RangeSliderProps {
  min?: number;
  max?: number;
  step?: number;
  values: [number, number];
  onChange: (values: [number, number]) => void;
  className?: string;
  ariaLabel?: [string, string];
}

/**
 * A simple double-thumb range slider built using two synced <input type="range"> elements.
 * Accessible and keyboard-friendly; styles the selected range via background.
 */
export const RangeSlider: React.FC<RangeSliderProps> = ({
  min = 0,
  max = 24,
  step = 1,
  values,
  onChange,
  className,
  ariaLabel = ['Start', 'End'],
}) => {
  const [start, end] = values;
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = React.useState<'start' | 'end' | null>(
    null
  );
  // No measuring – keep layout simple and robust

  const clamp = React.useCallback(
    (n: number) => Math.min(max, Math.max(min, n)),
    [max, min]
  );

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = clamp(Number(e.target.value));
    const adjustedStart = Math.min(newStart, end - step);
    onChange([adjustedStart, end]);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = clamp(Number(e.target.value));
    const adjustedEnd = Math.max(newEnd, start + step);
    onChange([start, adjustedEnd]);
  };

  // Reserved for future enhancements; left defined for API symmetry

  const positionToValue = React.useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const ratio = (clientX - rect.left) / rect.width;
      const raw = min + ratio * (max - min);
      const rounded = Math.round(raw / step) * step;
      return clamp(rounded);
    },
    [clamp, max, min, step]
  );

  const onPointerMoveValue = React.useCallback(
    (clientX: number) => {
      const value = positionToValue(clientX);
      if (value == null) return;
      if (activeThumb === 'start') {
        const adjusted = Math.min(value, end - step);
        onChange([adjusted, end]);
      } else if (activeThumb === 'end') {
        const adjusted = Math.max(value, start + step);
        onChange([start, adjusted]);
      }
    },
    [activeThumb, end, onChange, positionToValue, start, step]
  );
  const onHandlePointerDown =
    (thumb: 'start' | 'end') => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setActiveThumb(thumb);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      onPointerMoveValue(e.clientX);
    };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    onPointerMoveValue(e.clientX);
  };
  const onHandlePointerUp = () => setActiveThumb(null);

  // Compute background gradient to show selected range
  const percent = (n: number) => ((n - min) / (max - min)) * 100;
  const startPct = percent(start);
  const endPct = percent(end);

  // Keep handles inside by clamping against a fixed half-width
  const LABEL_HALF_PX = 20; // half of min visible label width
  const clampLeftCss = (percent: number) =>
    `calc(max(${LABEL_HALF_PX}px, min(100% - ${LABEL_HALF_PX}px, ${percent}%)))`;

  return (
    <div className={cn('rc-range relative w-full select-none py-2', className)}>
      {/* Edge labels */}
      <div className="mb-2 flex justify-between text-[11px] text-muted-foreground">
        <span>12 AM</span>
        <span>11:59 PM</span>
      </div>
      <div ref={trackRef} className="relative h-2 overflow-visible">
        {/* Track bar with rounded ends; acts as a mask */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Passive (inactive) bar */}
          <div
            className="absolute inset-0 bg-muted/60 pointer-events-none"
            aria-hidden
          />
          {/* Active range segment */}
          <div
            className="absolute top-0 h-full bg-primary pointer-events-none"
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
            aria-hidden
          />
        </div>
        {/* Start hidden native thumb (keyboard support) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={start}
          onChange={handleStartChange}
          aria-label={ariaLabel[0]}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 appearance-none bg-transparent thumb-invisible z-10 pointer-events-none'
          )}
          style={{ left: `calc(${startPct}% - 12px)`, width: '24px' }}
        />
        {/* End hidden native thumb (keyboard support) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={end}
          onChange={handleEndChange}
          aria-label={ariaLabel[1]}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 appearance-none bg-transparent thumb-invisible z-10 pointer-events-none'
          )}
          style={{ left: `calc(${endPct}% - 12px)`, width: '24px' }}
        />
        {/* Visible draggable labels/handles, OVER the track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 min-w-[40px] text-center text-[11px] px-2 py-1 rounded-md border bg-card text-foreground shadow-sm whitespace-nowrap -translate-x-1/2 cursor-grab active:cursor-grabbing z-50 select-none"
          style={{ left: clampLeftCss(startPct), touchAction: 'none' }}
          role="slider"
          aria-label={ariaLabel[0]}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={start}
          onPointerDown={onHandlePointerDown('start')}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          {formatHour(start)}
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 min-w-[40px] text-center text-[11px] px-2 py-1 rounded-md border bg-card text-foreground shadow-sm whitespace-nowrap -translate-x-1/2 cursor-grab active:cursor-grabbing z-50 select-none"
          style={{ left: clampLeftCss(endPct), touchAction: 'none' }}
          role="slider"
          aria-label={ariaLabel[1]}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={end}
          onPointerDown={onHandlePointerDown('end')}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          {formatHour(end)}
        </div>
      </div>
    </div>
  );
};

function formatHour(hour: number): string {
  const clamped = Math.round(hour);
  if (clamped === 0) return '12 AM';
  if (clamped === 12) return '12 PM';
  if (clamped === 24) return '12 AM';
  const suffix = clamped < 12 ? 'AM' : 'PM';
  const h12 = clamped % 12;
  return `${h12 === 0 ? 12 : h12} ${suffix}`;
}

export default RangeSlider;
