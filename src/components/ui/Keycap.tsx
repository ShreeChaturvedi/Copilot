import { cn } from '@/lib/utils';

/**
 * Keycap — a machined keyboard-key hint (design-brief §4.6).
 *
 * 18px tall, `--surface-2` fill, machined edge, 11px Spline Sans Mono.
 * Reused by the Cmd+K palette, header tooltips, and the landing keycap
 * cluster (brief §6.4). Numerals and key glyphs are mono by law (§3).
 */
export function Keycap({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-[5px]',
        'font-mono text-[11px] leading-none text-ink-2',
        'bg-surface-2 [box-shadow:var(--edge-machined)]',
        className
      )}
    >
      {children}
    </kbd>
  );
}
