/**
 * LeftPane - Complete rewrite using shadcn Sidebar component
 */

import React, { useCallback, useMemo, memo } from 'react';
import { SmartTaskInput } from '@/components/smart-input/SmartTaskInput';
import { TaskList } from '@/components/tasks/TaskList';
import { CalendarList } from '@/components/calendar/CalendarList';
import { TaskGroupList } from '@/components/tasks/TaskGroupList';
import { EventOverview } from '@/components/calendar/EventOverview';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useCalendarManagement } from '@/hooks/useCalendarManagement';
import { useUIStore } from '@/stores/uiStore';
import { BaseSidebarPane } from './BaseSidebarPane';

export interface LeftPaneProps {
  className?: string;
}

const LeftPaneComponent: React.FC<LeftPaneProps> = ({ className }) => {
  const { currentView } = useUIStore();

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

  // Memoized event handlers for stable references
  const memoizedHandleAddTask = useCallback(handleAddTask, [handleAddTask]);
  const memoizedHandleSelectTaskGroup = useCallback(handleSelectTaskGroup, [
    handleSelectTaskGroup,
  ]);
  const memoizedHandleOpenCreateTaskDialog = useCallback(
    handleOpenCreateTaskDialog,
    [handleOpenCreateTaskDialog]
  );

  // Additional header content - only show SmartTaskInput in calendar view
  const additionalHeaderContent = useMemo(() => {
    return currentView === 'calendar' ? (
      <div className="mt-4">
        <SmartTaskInput
          onAddTask={memoizedHandleAddTask}
          taskGroups={taskGroups}
          activeTaskGroupId={activeTaskGroupId}
          onCreateTaskGroup={memoizedHandleOpenCreateTaskDialog}
          onSelectTaskGroup={memoizedHandleSelectTaskGroup}
          disabled={isLoading || addTask.isPending}
          enableSmartParsing={true}
          showConfidence={false}
          maxDisplayTags={3}
          useInlineHighlighting={false}
          useOverlayHighlighting={false}
          useFlexInputGroup={true}
        />
      </div>
    ) : null;
  }, [
    currentView,
    memoizedHandleAddTask,
    taskGroups,
    activeTaskGroupId,
    memoizedHandleOpenCreateTaskDialog,
    memoizedHandleSelectTaskGroup,
    isLoading,
    addTask.isPending,
  ]);

  // Memoized handlers for TaskList
  const memoizedHandleToggleTask = useCallback(handleToggleTask, [
    handleToggleTask,
  ]);
  const memoizedHandleEditTask = useCallback(handleEditTask, [handleEditTask]);
  const memoizedHandleDeleteTask = useCallback(handleDeleteTask, [
    handleDeleteTask,
  ]);
  const memoizedHandleScheduleTask = useCallback(handleScheduleTask, [
    handleScheduleTask,
  ]);
  const memoizedHandleRemoveTag = useCallback(handleRemoveTag, [
    handleRemoveTag,
  ]);
  const memoizedHandleCreateTaskGroup = useCallback(handleCreateTaskGroup, [
    handleCreateTaskGroup,
  ]);
  const memoizedHandleUpdateTaskGroupIcon = useCallback(
    handleUpdateTaskGroupIcon,
    [handleUpdateTaskGroupIcon]
  );
  const memoizedHandleUpdateTaskGroupColor = useCallback(
    handleUpdateTaskGroupColor,
    [handleUpdateTaskGroupColor]
  );
  const memoizedHandleDeleteTaskGroup = useCallback(handleDeleteTaskGroup, [
    handleDeleteTaskGroup,
  ]);
  const memoizedSetShowCreateTaskDialog = useCallback(setShowCreateTaskDialog, [
    setShowCreateTaskDialog,
  ]);

  // Main content - TaskList in calendar view, EventOverview in task view
  const mainContent = useMemo(() => {
    return currentView === 'calendar' ? (
      <TaskList
        tasks={tasks}
        taskGroups={taskGroups}
        activeTaskGroupId={activeTaskGroupId}
        onToggleTask={memoizedHandleToggleTask}
        onEditTask={memoizedHandleEditTask}
        onDeleteTask={memoizedHandleDeleteTask}
        onScheduleTask={memoizedHandleScheduleTask}
        onRemoveTag={memoizedHandleRemoveTag}
        onCreateTaskGroup={memoizedHandleCreateTaskGroup}
        onSelectTaskGroup={memoizedHandleSelectTaskGroup}
        onUpdateTaskGroupIcon={memoizedHandleUpdateTaskGroupIcon}
        onUpdateTaskGroupColor={memoizedHandleUpdateTaskGroupColor}
        onDeleteTaskGroup={memoizedHandleDeleteTaskGroup}
        showCreateTaskDialog={showCreateTaskDialog}
        onShowCreateTaskDialog={memoizedSetShowCreateTaskDialog}
        calendarMode={true}
        maxTasks={10}
      />
    ) : (
      <EventOverview maxEvents={7} />
    );
  }, [
    currentView,
    tasks,
    taskGroups,
    activeTaskGroupId,
    memoizedHandleToggleTask,
    memoizedHandleEditTask,
    memoizedHandleDeleteTask,
    memoizedHandleScheduleTask,
    memoizedHandleRemoveTag,
    memoizedHandleCreateTaskGroup,
    memoizedHandleSelectTaskGroup,
    memoizedHandleUpdateTaskGroupIcon,
    memoizedHandleUpdateTaskGroupColor,
    memoizedHandleDeleteTaskGroup,
    showCreateTaskDialog,
    memoizedSetShowCreateTaskDialog,
  ]);

  // Memoized handlers for CalendarList
  const memoizedHandleToggleCalendar = useCallback(handleToggleCalendar, [
    handleToggleCalendar,
  ]);
  const memoizedHandleAddCalendar = useCallback(handleAddCalendar, [
    handleAddCalendar,
  ]);
  const memoizedHandleEditCalendar = useCallback(handleEditCalendar, [
    handleEditCalendar,
  ]);
  const memoizedHandleDeleteCalendar = useCallback(handleDeleteCalendar, [
    handleDeleteCalendar,
  ]);

  // Memoized handlers for TaskGroupList
  const memoizedHandleAddTaskGroupForList = useCallback(
    (data: {
      name: string;
      iconId: string;
      color: string;
      description?: string;
    }) => handleCreateTaskGroup({
      name: data.name,
      description: data.description || '',
      iconId: data.iconId,
      color: data.color,
    }),
    [handleCreateTaskGroup]
  );
  const memoizedHandleEditTaskGroupForList = useCallback(
    (
      id: string,
      updates: {
        name: string;
        iconId: string;
        color: string;
        description?: string;
      }
    ) => handleUpdateTaskGroupIcon(id, updates.iconId),
    [handleUpdateTaskGroupIcon]
  );

  // Footer content - CalendarList in calendar view, TaskGroupList in task view
  const footerListContent = useMemo(() => {
    return currentView === 'calendar' ? (
      <CalendarList
        calendars={calendars}
        onToggleCalendar={memoizedHandleToggleCalendar}
        onAddCalendar={memoizedHandleAddCalendar}
        onEditCalendar={memoizedHandleEditCalendar}
        onDeleteCalendar={memoizedHandleDeleteCalendar}
      />
    ) : (
      <TaskGroupList
        taskGroups={taskGroups}
        activeTaskGroupId={activeTaskGroupId}
        onAddTaskGroup={memoizedHandleAddTaskGroupForList}
        onEditTaskGroup={memoizedHandleEditTaskGroupForList}
        onDeleteTaskGroup={memoizedHandleDeleteTaskGroup}
        onSelectTaskGroup={memoizedHandleSelectTaskGroup}
      />
    );
  }, [
    currentView,
    calendars,
    memoizedHandleToggleCalendar,
    memoizedHandleAddCalendar,
    memoizedHandleEditCalendar,
    memoizedHandleDeleteCalendar,
    taskGroups,
    activeTaskGroupId,
    memoizedHandleAddTaskGroupForList,
    memoizedHandleEditTaskGroupForList,
    memoizedHandleDeleteTaskGroup,
    memoizedHandleSelectTaskGroup,
  ]);

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

// Custom comparison function for LeftPane
const LeftPaneMemoComparison = (
  prevProps: LeftPaneProps,
  nextProps: LeftPaneProps
) => {
  // Only compare className since that's the only prop
  return prevProps.className === nextProps.className;
};

// Memoized LeftPane component - prevents re-render when only internal state changes
export const LeftPane = memo(LeftPaneComponent, LeftPaneMemoComparison);

export default LeftPane;
