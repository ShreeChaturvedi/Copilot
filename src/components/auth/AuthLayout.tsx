import React from 'react';
import '@/styles/auth.css';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Auth = the room (design-brief §4.8): the app canvas, a quiet brand lockup, and
 * one centered machined card supplied by each page. No rainbow, no cursor glow,
 * no frosted glass. Depth comes from the app's own language — a faint schematic
 * grid (the calendar etched behind, §2.5) and a soft aqua light — quiet in either
 * theme. The card settles in on load, the way a chip settles onto the grid.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-room min-h-svh w-full flex flex-col items-center justify-center gap-7 p-4 sm:p-6">
      {/* Ambient room: schematic grid + soft aqua light. Purely decorative. */}
      <div className="auth-room__bg" aria-hidden="true" />
      <div className="auth-brand flex items-center gap-2 select-none">
        {/* The mark is the thesis: three cells at rest, one settled in aqua */}
        <span className="auth-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <rect
              x="2.75"
              y="2.75"
              width="7.5"
              height="7.5"
              rx="2.25"
              className="stroke-hairline-strong"
              strokeWidth="1.5"
            />
            <rect
              x="13.75"
              y="2.75"
              width="7.5"
              height="7.5"
              rx="2.25"
              className="stroke-hairline-strong"
              strokeWidth="1.5"
            />
            <rect
              x="2.75"
              y="13.75"
              width="7.5"
              height="7.5"
              rx="2.25"
              className="stroke-hairline-strong"
              strokeWidth="1.5"
            />
            <rect
              x="13.75"
              y="13.75"
              width="7.5"
              height="7.5"
              rx="2.25"
              className="fill-aqua auth-mark-settle"
            />
          </svg>
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          Taskflow
        </span>
      </div>
      {children}
    </div>
  );
}
