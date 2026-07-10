/**
 * Settings > About — version and environment only.
 * Fake external help links were removed; no product docs URL ships yet.
 */
export function AboutSettings() {
  return (
    <div className="pt-1">
      <p className="text-[0.8125rem] text-ink-muted leading-relaxed max-w-[36ch]">
        Taskflow Calendar — plan tasks and events on one grid.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-4 font-mono text-[0.6875rem] tracking-[0.04em] uppercase text-ink-muted">
        <span>v1.0.0</span>
        <span aria-hidden="true">·</span>
        <span>{import.meta.env.DEV ? 'Development' : 'Production'}</span>
      </div>
    </div>
  );
}

/** @deprecated Use AboutSettings */
export { AboutSettings as HelpSettings };
