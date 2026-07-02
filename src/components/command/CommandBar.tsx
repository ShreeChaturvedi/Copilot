import { lazy, Suspense, useEffect, useState } from 'react';
import { useCommandBarStore } from '@/stores/commandBarStore';

const CommandBarPanel = lazy(() => import('./CommandBarPanel'));

/**
 * Cmd+K command bar mount (design-brief §4.6). The panel (cmdk + the date
 * grammar's chrono chunk) loads lazily on first open and stays mounted so
 * re-opens are instant and exit animations play.
 */
export function CommandBar() {
  const open = useCommandBarStore((s) => s.open);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open) setLoaded(true);
  }, [open]);

  if (!loaded) return null;

  return (
    <Suspense fallback={null}>
      <CommandBarPanel />
    </Suspense>
  );
}
