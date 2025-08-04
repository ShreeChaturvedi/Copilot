/**
 * LeftPane - Complete rewrite using shadcn Sidebar component
 */

import React from 'react';
import { SmartTaskInput } from '@/components/smart-input/SmartTaskInput';
import { TaskList } from '@/components/tasks/TaskList';
import { CalendarList } from '@/components/calendar/CalendarList';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useCalendarManagement } from '@/hooks/useCalendarManagement';
import { BaseSidebarPane } from './BaseSidebarPane';

export interface LeftPaneProps {
  className?: string;
}

export const LeftPane: React.FC<LeftPaneProps> = ({ className }) => {
  // Task management with task operations enabled
  const {
    tasks,
    tasksLoading,
    addTask,
    handleAddTask,
    handleToggleTask,
    handleEditTask,
    handleDeleteTask,
    handleScheduleTask,
    handleRemoveTag,
    taskGroups,
    activeTaskGroupId,
    showCreateTaskDialog,
    setShowCreateTaskDialog,
    handleCreateTaskGroup,
    handleSelectTaskGroup,
    handleUpdateTaskGroupIcon,
    handleUpdateTaskGroupColor,
    handleDeleteTaskGroup,
    handleOpenCreateTaskDialog,
  } = useTaskManagement({ includeTaskOperations: true });

  // Calendar management
  const {
    calendars,
    calendarsLoading,
    handleToggleCalendar,
    handleAddCalendar,
    handleEditCalendar,
    handleDeleteCalendar,
  } = useCalendarManagement();

  const isLoading = tasksLoading || calendarsLoading;

  // Additional header content with Smart Task Input
  const additionalHeaderContent = (
    <div className="mt-4">
      <SmartTaskInput
        onAddTask={handleAddTask}
        taskGroups={taskGroups}
        activeTaskGroupId={activeTaskGroupId}
        onCreateTaskGroup={handleOpenCreateTaskDialog}
        onSelectTaskGroup={handleSelectTaskGroup}
        disabled={isLoading || addTask.isPending}
        enableSmartParsing={true}
        showConfidence={false}
        maxDisplayTags={3}
        useInlineHighlighting={false}
        useOverlayHighlighting={false}
        useFlexInputGroup={true}
      />
    </div>
  );

  // Main content with Task List
  const mainContent = (
    <TaskList
      tasks={tasks}
      taskGroups={taskGroups}
      activeTaskGroupId={activeTaskGroupId}
      onToggleTask={handleToggleTask}
      onEditTask={handleEditTask}
      onDeleteTask={handleDeleteTask}
      onScheduleTask={handleScheduleTask}
      onRemoveTag={handleRemoveTag}
      onCreateTaskGroup={handleCreateTaskGroup}
      onSelectTaskGroup={handleSelectTaskGroup}
      onUpdateTaskGroupIcon={handleUpdateTaskGroupIcon}
      onUpdateTaskGroupColor={handleUpdateTaskGroupColor}
      onDeleteTaskGroup={handleDeleteTaskGroup}
      showCreateTaskDialog={showCreateTaskDialog}
      onShowCreateTaskDialog={setShowCreateTaskDialog}
    />
  );

  // Footer content with Calendar List
  const footerListContent = (
    <CalendarList
      calendars={calendars}
      onToggleCalendar={handleToggleCalendar}
      onAddCalendar={handleAddCalendar}
      onEditCalendar={handleEditCalendar}
      onDeleteCalendar={handleDeleteCalendar}
    />
  );

  return (
    <>
      <BaseSidebarPane
        className={className}
        additionalHeaderContent={additionalHeaderContent}
        showViewToggle={true}
        showSidebarTrigger={true}
        mainContent={mainContent}
        footerListContent={footerListContent}
      />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}
    </>
  );
};

export default LeftPane;