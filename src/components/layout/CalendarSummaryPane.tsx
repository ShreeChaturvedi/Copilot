import React from 'react';
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

  // Main content with EventOverview only
  const mainContent = (
    <EventOverview 
      maxEvents={7}
    />
  );

  // Footer content with conditional lists
  const footerListContent = currentView === 'task' ? (
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
  );

  return (
    <BaseSidebarPane
      className={className}
      showViewToggle={true}
      showSidebarTrigger={true}
      mainContent={mainContent}
      footerListContent={footerListContent}
      onViewToggle={handleViewToggle}
      useMinimalMode={false}
    />
  );
};

export default CalendarSummaryPane;