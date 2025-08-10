import React, { useEffect, useRef } from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Persistent auth background and global cursor glow tracker for Login/Signup.
 * Keeps the animated gradient mounted between route transitions to avoid snaps.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rafId: number | null = null;
    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        const targets = el.querySelectorAll<HTMLElement>('.cursor-glow-border');
        targets.forEach((btn) => {
          const rect = btn.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          btn.style.setProperty('--glow-x', `${x}%`);
          btn.style.setProperty('--glow-y', `${y}%`);
        });
      };
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };
    window.addEventListener('mousemove', handleMove);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="auth-gradient-bg min-h-svh w-full flex items-center justify-center p-4 sm:p-6 md:p-10">
      {children}
    </div>
  );
}

