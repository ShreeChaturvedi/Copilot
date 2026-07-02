import React from 'react';
import { cn } from '@/lib/utils';

export interface StatusRingProps {
  /** Visual state: rest (open ring), in-progress (amber arc), done (list-color fill + check) */
  status: 'rest' | 'in-progress' | 'done';
  /** True while the completion keyframes should play (click -> done) */
  animating?: boolean;
  /** aria-checked for the checkbox role */
  checked: boolean;
  /** The row's list color; drives hover stroke, done fill, draw stroke */
  listColor?: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  'aria-label': string;
  className?: string;
}

/**
 * The 16px status ring (design-brief §4.1) — the row's completion control.
 * 1.5px stroke; rest = --hairline-strong; hover = list color at 60%;
 * in-progress = amber 270° arc; done = filled with the LIST color + white
 * check. Completion belongs to the chip system, not a borrowed brand glyph.
 * All draw/pop/check motion is CSS keyframes in task-item.css, keyed off
 * data-anim, so the Draggable row root itself never animates.
 */
export const StatusRing: React.FC<StatusRingProps> = ({
  status,
  animating = false,
  checked,
  listColor,
  onClick,
  'aria-label': ariaLabel,
  className,
}) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={cn('ti-ring', className)}
      data-status={status}
      data-anim={animating || undefined}
      style={
        listColor
          ? ({ '--ti-list-c': listColor } as React.CSSProperties)
          : undefined
      }
      onClick={onClick}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle className="ti-ring-base" cx="8" cy="8" r="7.25" />
        <circle className="ti-ring-arc" cx="8" cy="8" r="7.25" />
        <circle className="ti-ring-draw" cx="8" cy="8" r="7.25" />
        <g className="ti-ring-done">
          <circle className="ti-ring-fill" cx="8" cy="8" r="8" />
          <path className="ti-ring-check" d="M4.6 8.4 L7 10.8 L11.5 5.6" />
        </g>
      </svg>
    </button>
  );
};

export default StatusRing;
