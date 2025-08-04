import { ReactNode, useRef } from 'react';
import { LeftPane } from './LeftPane';
import { RightPane } from './RightPane';
import { TaskFocusLayout } from './TaskFocusLayout';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useUIStore } from '@/stores/uiStore';
import FullCalendar from '@fullcalendar/react';

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
          <RightPane calendarRef={calendarRef} />
        </div>
      </div>

      {/* Custom children content (modals, overlays, etc.) */}
      {children}
    </>
  );
};

export const MainLayout = ({ children }: MainLayoutProps) => {
  const { currentView } = useUIStore();

  // If in task view, use the new TaskFocusLayout
  if (currentView === 'task') {
    return (
      <TaskFocusLayout>
        {children}
      </TaskFocusLayout>
    );
  }

  // Otherwise, use the existing calendar layout
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen w-screen overflow-hidden bg-background flex" style={{ overscrollBehavior: 'none' }}>
        {/* LEFT SIDEBAR */}
        <LeftPane />

        <MainContent children={children} />
      </div>
    </SidebarProvider>
  );
};