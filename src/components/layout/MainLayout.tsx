import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_SETTLE, DUR_3_S } from '@/lib/motion';
const LeftPane = lazy(async () => ({
  default: (await import('./LeftPane')).LeftPane,
}));
const RightPane = lazy(async () => ({
  default: (await import('./RightPane')).RightPane,
}));
const TaskFocusPane = lazy(async () => ({
  default: (await import('./TaskFocusPane')).TaskFocusPane,
}));
import { SidebarProvider } from '@/components/ui/sidebar';
import { useSettingsStore } from '@/stores/settingsStore';
const SettingsDialog = lazy(async () => ({
  default: (await import('@/components/settings/SettingsDialog'))
    .SettingsDialog,
}));
import { useUIStore } from '@/stores/uiStore';
import { useSettingsDialog } from '@/hooks/useSettingsDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { CommandBar } from '@/components/command/CommandBar';
import { usePreferencesSync } from '@/hooks/usePreferencesSync';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import type FullCalendar from '@fullcalendar/react';

interface MainLayoutProps {
  children?: ReactNode;
}

const MainContent = ({ children }: { children?: ReactNode }) => {
  const calendarRef = useRef<FullCalendar>(null);

  return (
    <>
      {/* MAIN CONTENT - Natural flex behavior */}
      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ overscrollBehavior: 'none' }}
      >
        {/* RIGHT PANE CONTENT */}
        <div className="flex-1" style={{ overscrollBehavior: 'none' }}>
          <Suspense fallback={null}>
            <RightPane calendarRef={calendarRef} />
          </Suspense>
        </div>
      </div>

      {/* Custom children content (modals, overlays, etc.) */}
      {children}
    </>
  );
};

export const MainLayout = ({ children }: MainLayoutProps) => {
  const { currentView, dragState, setCurrentView } = useUIStore();
  const { logout } = useAuthStore();
  const { sidebarExpanded, appViewMode } = useSettingsStore();

  // Apply the user's saved preferences (theme, default view, week start) on load
  usePreferencesSync();

  // Settings dialog management
  const {
    isOpen: isSettingsOpen,
    currentSection,
    openSettings,
    closeSettings,
  } = useSettingsDialog();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenProfile: () => openSettings('profile'),
    onOpenSettings: () => openSettings('general'),
    onOpenHelp: () => openSettings('help'),
    onLogout: () => logout(),
  });

  // Cmd+K palette + single-key map (T, D/W/M/L, N) — design-brief §4.6
  useGlobalShortcuts();

  // Global event bridge so dropdown can open settings without prop drilling
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: 'general' | 'profile' | 'help' }>;
      const section = ce.detail?.section ?? 'general';
      openSettings(section);
    };
    window.addEventListener('app:open-settings', handler as EventListener);
    return () =>
      window.removeEventListener('app:open-settings', handler as EventListener);
  }, [openSettings]);

  // Initialize UI view from settings on mount
  useEffect(() => {
    if (appViewMode && currentView !== appViewMode) {
      setCurrentView(appViewMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SidebarProvider defaultOpen={sidebarExpanded}>
      <TopProgressBar />
      <div
        className={cn(
          'h-screen w-screen overflow-hidden bg-background flex',
          dragState?.isDragging && 'select-none'
        )}
        data-view={currentView}
        data-dragging={dragState?.isDragging}
        style={{ overscrollBehavior: 'none' }}
      >
        {/* LEFT SIDEBAR - Always rendered */}
        <Suspense fallback={null}>
          <LeftPane />
        </Suspense>

        {/* MAIN CONTENT - The View Settle: Calendar⟷Tasks resolves on the
            shared --ease-settle entrance curve instead of a hard cut. */}
        <AnimatePresence mode="wait" initial={false}>
          {currentView === 'task' ? (
            <motion.div
              key="task"
              className="flex-1 min-w-0 flex flex-col"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR_3_S, ease: EASE_SETTLE }}
            >
              <Suspense fallback={null}>
                <TaskFocusPane />
              </Suspense>
            </motion.div>
          ) : (
            <motion.div
              key="calendar"
              className="flex flex-col flex-1 min-w-0"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR_3_S, ease: EASE_SETTLE }}
            >
              <MainContent children={children} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cmd+K command bar */}
        <CommandBar />

        {/* Settings Dialog */}
        <Suspense fallback={null}>
          <SettingsDialog
            open={isSettingsOpen}
            onOpenChange={closeSettings}
            defaultSection={currentSection}
          />
        </Suspense>
      </div>
    </SidebarProvider>
  );
};

/**
 * TopProgressBar renders a minimal, smooth, reactive loading indicator at the very top of the page.
 * It tracks both ongoing queries and mutations from TanStack Query and derives a progress value
 * that advances smoothly while work is in flight, then completes and fades quickly.
 */
const TopProgressBar = () => {
  const fetchingCount = useIsFetching();

  // Internal state to drive progress and visibility
  const [progress, setProgress] = useState(0); // 0..1
  const [visible, setVisible] = useState(false);
  const [startInFlight, setStartInFlight] = useState(0); // frozen baseline for this cycle
  const [initialPhase, setInitialPhase] = useState(true); // only show during initial load
  const [initialStarted, setInitialStarted] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const inFlight = fetchingCount;

  // Compute a target progress based on fraction of completed units relative to the max observed in-flight work.
  // This ensures the bar is reactive to actual progress rather than purely time-based trickle.
  const targetProgress = useMemo(() => {
    if (!visible || startInFlight <= 0) return 0;
    const completed = Math.max(0, startInFlight - inFlight);
    const fraction = Math.min(1, Math.max(0, completed / startInFlight)); // 0..1
    const reservedHeadroom = 0.1; // keep 10% to finish on completion
    return reservedHeadroom + fraction * (0.9 - reservedHeadroom); // maps to [0.1 .. 0.9]
  }, [visible, startInFlight, inFlight]);

  // Start/stop visibility and manage life-cycle around work starting/ending
  useEffect(() => {
    if (!initialPhase) return;
    if (inFlight > 0) {
      // Initial work started or ongoing
      setVisible(true);
      setIsFinishing(false);
      setInitialStarted(true);
      setStartInFlight((prev) => (prev === 0 ? inFlight : prev));
      // Kick progress if it is at rest
      setProgress((prev) => (prev === 0 ? 0.04 : prev));
    } else if (visible && initialStarted) {
      // Initial work finished
      setIsFinishing(true);
      setProgress(1);
      // Fade out shortly after hitting 100%
      const fadeTimer = window.setTimeout(() => {
        setVisible(false);
        setIsFinishing(false);
        setProgress(0);
        setStartInFlight(0);
        setInitialStarted(false);
        setInitialPhase(false); // disable for subsequent API calls
      }, 220);
      return () => window.clearTimeout(fadeTimer);
    }
  }, [inFlight, visible, initialPhase, initialStarted]);

  // rAF-driven smoother with EMA towards target; monotonic, low-jitter
  useEffect(() => {
    if (!visible || !initialPhase || inFlight <= 0) return;
    let raf = 0;
    const tick = () => {
      setProgress((prev) => {
        const base = prev;
        const alpha = 0.16; // EMA smoothing factor
        let next = base + (targetProgress - base) * alpha;
        // Minimal trickle to avoid stalling when target is flat
        const minIncrement =
          base < 0.2 ? 0.008 : base < 0.5 ? 0.004 : base < 0.8 ? 0.002 : 0.001;
        if (next - base < minIncrement) next = base + minIncrement;
        // Cap while work is active to leave room for finish
        next = Math.min(next, 0.985);
        // Monotonic guard
        if (next < base) next = base;
        return next;
      });
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [visible, initialPhase, inFlight, targetProgress]);

  // Ensure we never regress on abrupt target changes
  useEffect(() => {
    if (!visible || !initialPhase) return;
    setProgress((prev) => (targetProgress > prev ? targetProgress : prev));
  }, [targetProgress, visible, initialPhase]);

  if (!visible && progress === 0) return null;

  // Aqua gradient off the accent tokens (theme-aware; aqua = live, design-brief §2.3)
  const gradient =
    'linear-gradient(90deg in oklch, var(--aqua-hover) 0%, var(--aqua) 100%)';

  // Reveal by width (monotonic, layout is trivial at 3px height)
  const widthPercent = Math.max(0, Math.min(100, progress * 100));

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[3px] z-50 pointer-events-none"
      aria-hidden
    >
      <div
        className="h-full rounded-sm relative overflow-hidden"
        style={{
          opacity: visible && !isFinishing ? 1 : 0,
          transition: 'opacity 140ms ease-out',
        }}
      >
        <div
          className="absolute top-0 left-0 bottom-0 will-change-[width]"
          style={{ width: `${widthPercent}%`, background: gradient }}
        />
      </div>
    </div>
  );
};
