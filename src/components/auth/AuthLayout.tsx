import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Auth = the room (design-brief §4.8): the app canvas, a quiet wordmark, and
 * one centered machined card supplied by each page. No gradients, no glows;
 * both themes come straight from the token system.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-svh w-full bg-background flex flex-col items-center justify-center gap-6 p-4 sm:p-6">
      <span
        className="text-sm font-semibold tracking-[-0.01em] text-ink select-none"
        aria-hidden="true"
      >
        Taskflow
      </span>
      {children}
    </div>
  );
}
