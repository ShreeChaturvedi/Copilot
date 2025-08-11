import { ReactNode, useEffect, useRef, lazy, Suspense } from 'react';
const LeftPane = lazy(async () => ({ default: (await import('./LeftPane')).LeftPane }));
const RightPane = lazy(async () => ({ default: (await import('./RightPane')).RightPane }));
const TaskFocusPane = lazy(async () => ({ default: (await import('./TaskFocusPane')).TaskFocusPane }));
import { SidebarProvider } from '@/components/ui/sidebar';
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
  const { currentView, dragState } = useUIStore();
  const { logout } = useAuthStore();
  
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

  return (
    <SidebarProvider defaultOpen={true}>
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