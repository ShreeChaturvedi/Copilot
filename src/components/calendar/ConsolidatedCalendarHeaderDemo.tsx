import React, { useState } from 'react';
import { ConsolidatedCalendarHeader, CalendarViewType } from './ConsolidatedCalendarHeader';
import { SidebarProvider } from '@/components/ui/sidebar';

/**
 * Demo component showing how ConsolidatedCalendarHeader would be used in RightPane
 */
export const ConsolidatedCalendarHeaderDemo: React.FC = () => {
  const [currentView, setCurrentView] = useState<CalendarViewType>('timeGridWeek');

  const handleViewChange = (view: CalendarViewType) => {
    console.log('View changed to:', view);
    setCurrentView(view);
  };

  const handleTodayClick = () => {
    console.log('Today clicked');
  };

  const handlePrevClick = () => {
    console.log('Previous clicked');
  };

  const handleNextClick = () => {
    console.log('Next clicked');
  };

  const handleCreateEvent = () => {
    console.log('Create event clicked');
  };

  return (
    <SidebarProvider>
      <div className="h-screen flex flex-col bg-background">
        <ConsolidatedCalendarHeader
          currentView={currentView}
          onViewChange={handleViewChange}
          onTodayClick={handleTodayClick}
          onPrevClick={handlePrevClick}
          onNextClick={handleNextClick}
          onCreateEvent={handleCreateEvent}
        />
        <div className="flex-1 p-4 bg-muted/20">
          <div className="h-full border-2 border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <h3 className="text-lg font-semibold mb-2">Calendar Content Area</h3>
              <p>Current view: <span className="font-mono">{currentView}</span></p>
              <p className="text-sm mt-2">This is where the FullCalendar component would be rendered</p>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};