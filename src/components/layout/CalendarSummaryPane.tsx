import React from 'react';
import { SidebarSeparator } from '@/components/ui/sidebar';
import { EventOverview } from '@/components/calendar/EventOverview';
import { CalendarList } from '@/components/calendar/CalendarList';
import { TaskGroupList } from '@/components/tasks/TaskGroupList';
import { useUIStore } from '@/stores/uiStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useCalendarManagement } from '@/hooks/useCalendarManagement';
import { BaseSidebarPane } from './BaseSidebarPane';

interface CalendarSummaryPaneProps {
  className?: string;
}

export const CalendarSummaryPane: React.FC<CalendarSummaryPaneProps> = ({
  className
}) => {
  const { currentView } = useUIStore();

  // Calendar management
  const {
    calendars,
    handleToggleCalendar,
    handleAddCalendar,
    handleEditCalendar,
    handleDeleteCalendar,
  } = useCalendarManagement();

  // Task management without task operations (just task groups)
  const {
    taskGroups,
    activeTaskGroupId,
    handleAddTaskGroup,
    handleEditTaskGroup,
    handleDeleteTaskGroup,
    handleSelectTaskGroup,
  } = useTaskManagement({ includeTaskOperations: false });

  const handleViewToggle = () => {
    // View toggle handled by BaseSidebarPane
  };

  // Main content with EventOverview and conditional lists
  const mainContent = (
    <>
      {/* Event Overview Section */}
      <EventOverview 
        maxEvents={5}
        showCurrentWeekOnly={true}
      />

      <SidebarSeparator className="my-4" />

      {/* Conditional List Section - Task Lists for task view, Calendars for calendar view */}
      {currentView === 'task' ? (
        <TaskGroupList
          taskGroups={taskGroups}
          activeTaskGroupId={activeTaskGroupId}
          onAddTaskGroup={handleAddTaskGroup}
          onEditTaskGroup={handleEditTaskGroup}
          onDeleteTaskGroup={handleDeleteTaskGroup}
          onSelectTaskGroup={handleSelectTaskGroup}
        />
      ) : (
        <CalendarList
          calendars={calendars}
          onToggleCalendar={handleToggleCalendar}
          onAddCalendar={handleAddCalendar}
          onEditCalendar={handleEditCalendar}
          onDeleteCalendar={handleDeleteCalendar}
        />
      )}
    </>
  );

  return (
    <BaseSidebarPane
      className={className}
      showViewToggle={true}
      showSidebarTrigger={false}
      mainContent={mainContent}
      onViewToggle={handleViewToggle}
      useMinimalMode={true}
    />
  );
};

export default CalendarSummaryPane;