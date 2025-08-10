// no default React import needed with automatic JSX runtime
import { LoginForm } from '@/components/login-form';
import { useEffect, useRef } from 'react';

export function LoginPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let rafId: number | null = null;

    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;

      // Update all buttons with cursor-glow-border so the glow follows anywhere on screen
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
    <div ref={containerRef} className="flex min-h-svh w-full items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-md rounded-xl frosted-panel p-4 sm:p-6 md:p-8">
        <LoginForm />
      </div>
    </div>
  );
}