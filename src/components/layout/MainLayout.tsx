import { ReactNode, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useIsFetching } from '@tanstack/react-query';
const LeftPane = lazy(async () => ({ default: (await import('./LeftPane')).LeftPane }));
const RightPane = lazy(async () => ({ default: (await import('./RightPane')).RightPane }));
const TaskFocusPane = lazy(async () => ({ default: (await import('./TaskFocusPane')).TaskFocusPane }));
import { SidebarProvider } from '@/components/ui/sidebar';
import { useSettingsStore } from '@/stores/settingsStore';
const SettingsDialog = lazy(async () => ({ default: (await import('@/components/settings/SettingsDialog')).SettingsDialog }));
import { useUIStore } from '@/stores/uiStore';
import { useSettingsDialog } from '@/hooks/useSettingsDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
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
      <div className="flex flex-col flex-1 min-w-0" style={{ overscrollBehavior: 'none' }}>
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
  
  // Settings dialog management
  const { 
    isOpen: isSettingsOpen, 
    currentSection, 
    openSettings, 
    closeSettings 
  } = useSettingsDialog();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onOpenProfile: () => openSettings('profile'),
    onOpenSettings: () => openSettings('general'),
    onOpenHelp: () => openSettings('help'),
    onLogout: () => logout(),
  });

  // Global event bridge so dropdown can open settings without prop drilling
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ section?: 'general' | 'profile' | 'help' }>;
      const section = ce.detail?.section ?? 'general';
      openSettings(section);
    };
    window.addEventListener('app:open-settings', handler as EventListener);
    return () => window.removeEventListener('app:open-settings', handler as EventListener);
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
          currentView === 'task' && 'transition-all duration-500 ease-out',
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

        {/* MAIN CONTENT - Changes based on view */}
        {currentView === 'task' ? (
          <div className="flex-1 min-w-0 transition-all duration-300 ease-out flex flex-col">
            <Suspense fallback={null}>
              <TaskFocusPane />
            </Suspense>
          </div>
        ) : (
          <MainContent children={children} />
        )}

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
      setStartInFlight(prev => (prev === 0 ? inFlight : prev));
      // Kick progress if it is at rest
      setProgress(prev => (prev === 0 ? 0.04 : prev));
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
      setProgress(prev => {
        const base = prev;
        const alpha = 0.16; // EMA smoothing factor
        let next = base + (targetProgress - base) * alpha;
        // Minimal trickle to avoid stalling when target is flat
        const minIncrement = base < 0.2 ? 0.008 : base < 0.5 ? 0.004 : base < 0.8 ? 0.002 : 0.001;
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
    setProgress(prev => (targetProgress > prev ? targetProgress : prev));
  }, [targetProgress, visible, initialPhase]);

  if (!visible && progress === 0) return null;

  // OKLCH green gradient with two stops (left-to-right) for smooth interpolation and clear contrast
  const gradient = 'linear-gradient(90deg in oklch, oklch(92% 0.26 145) 0%, oklch(60% 0.18 155) 100%)';

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