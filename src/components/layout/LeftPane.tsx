/**
 * LeftPane - Complete rewrite using shadcn Sidebar component
 */

import React, {
  useCallback,
  useMemo,
  memo,
  useEffect,
  useState,
  lazy,
  Suspense,
} from 'react';
import type { SmartTaskData } from '@/components/smart-input/SmartTaskInput';
// Lazy load SmartTaskInput to code-split the 405KB bundle
const SmartTaskInput = lazy(async () => ({
  default: (await import('@/components/smart-input/SmartTaskInput'))
    .SmartTaskInput,
}));
// Lazy load TaskList to code-split 160KB bundle
const TaskList = lazy(async () => ({
  default: (await import('@/components/tasks/TaskList')).TaskList,
}));
import { CalendarList } from '@/components/calendar/CalendarList';
import { TaskGroupList } from '@/components/tasks/TaskGroupList';
// Lazy load TaskAnalyticsSummary to code-split recharts dependency
const TaskAnalyticsSummary = lazy(async () => ({
  default: (await import('@/components/tasks/TaskAnalyticsSummary'))
    .TaskAnalyticsSummary,
}));
import { EventOverview } from '@/components/calendar/EventOverview';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useCalendarManagement } from '@/hooks/useCalendarManagement';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { BaseSidebarPane } from './BaseSidebarPane';
import { Button } from '@/components/ui/Button';
import {
  CalendarArrowDown,
  CalendarArrowUp,
  ArrowUpToLine,
  ArrowDownToLine,
} from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Calendar as MiniCalendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';

export interface LeftPaneProps {
  className?: string;
}

const LeftPaneComponent: React.FC<LeftPaneProps> = ({ className }) => {
  const { currentView } = useUIStore();

  // Track today so the mini calendar keeps today's highlight updated without reload
  const [today, setToday] = useState<Date>(() => new Date());
  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const scheduleNext = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      timeoutId = window.setTimeout(
        () => {
          if (cancelled) return;
          setToday(new Date());
          scheduleNext();
        },
        Math.max(1000, msUntilMidnight)
      );
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

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
    handleAddTaskGroup,
    handleEditTaskGroup,
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

  // State and controls for collapsible SmartTaskInput (shown in calendar view)
  const {
    calendarViewInputExpanded,
    toggleCalendarViewInput,
    taskViewMiniCalendarExpanded,
    toggleTaskViewMiniCalendar,
    leftSmartInputTaskListId,
    setLeftSmartInputTaskListId,
    showSidebarTaskAnalytics,
  } = useSettingsStore();

  // Sync persisted SmartTaskInput list selection to TaskList active selection on load
  useEffect(() => {
    if (!taskGroups || taskGroups.length === 0) return;
    if (!leftSmartInputTaskListId) return;
    const exists =
      taskGroups.some((g) => g.id === leftSmartInputTaskListId) ||
      leftSmartInputTaskListId === 'all' ||
      leftSmartInputTaskListId === 'default';
    if (!exists) return;
    if (leftSmartInputTaskListId !== activeTaskGroupId) {
      handleSelectTaskGroup(leftSmartInputTaskListId);
    }
  }, [
    taskGroups,
    leftSmartInputTaskListId,
    activeTaskGroupId,
    handleSelectTaskGroup,
  ]);
  const [hasUserToggledSmartInput, setHasUserToggledSmartInput] =
    useState<boolean>(false);

  // Disable animation on initial mount and when switching tabs; enable only after explicit user toggle
  useEffect(() => {
    setHasUserToggledSmartInput(false);
  }, [currentView]);

  const handleToggleSmartInput = useCallback(() => {
    setHasUserToggledSmartInput(true);
    toggleCalendarViewInput();
  }, [toggleCalendarViewInput]);

  // Additional header content - SmartTaskInput wrapped in Collapsible in calendar view
  const additionalHeaderContent = useMemo(() => {
    if (currentView !== 'calendar') return null;
    return (
      <Collapsible open={calendarViewInputExpanded}>
        <CollapsibleContent
          className={
            'overflow-hidden ' +
            (hasUserToggledSmartInput
              ? 'data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up'
              : '')
          }
        >
          <div
            className={hasUserToggledSmartInput ? 'calendar-item' : undefined}
          >
            <div className="mt-4 text-sm">
              <Suspense
                fallback={
                  <div className="h-10 animate-pulse bg-muted rounded-md" />
                }
              >
                <SmartTaskInput
                  onAddTask={(
                    title: string,
                    groupId?: string,
                    smartData?: SmartTaskData
                  ) => {
                    memoizedHandleAddTask(title, groupId, smartData);
                  }}
                  taskGroups={taskGroups}
                  activeTaskGroupId={
                    leftSmartInputTaskListId || activeTaskGroupId
                  }
                  onCreateTaskGroup={memoizedHandleOpenCreateTaskDialog}
                  onSelectTaskGroup={(groupId) => {
                    setLeftSmartInputTaskListId(groupId);
                    memoizedHandleSelectTaskGroup(groupId);
                  }}
                  disabled={isLoading || addTask.isPending}
                  enableSmartParsing={true}
                  showConfidence={false}
                  maxDisplayTags={3}
                  useInlineHighlighting={false}
                  useOverlayHighlighting={false}
                  useFlexInputGroup={true}
                  hideFocusOutline={true}
                />
              </Suspense>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }, [
    currentView,
    calendarViewInputExpanded,
    hasUserToggledSmartInput,
    memoizedHandleAddTask,
    taskGroups,
    activeTaskGroupId,
    memoizedHandleOpenCreateTaskDialog,
    memoizedHandleSelectTaskGroup,
    leftSmartInputTaskListId,
    setLeftSmartInputTaskListId,
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
  const memoizedHandleEditTaskGroup = useCallback(handleEditTaskGroup, [
    handleEditTaskGroup,
  ]);
  // In calendar view TaskList, ensure creation persists via API, not local-only
  const memoizedHandleAddTaskGroupForTaskList = useCallback(
    (data: {
      name: string;
      description: string;
      emoji: string;
      color: string;
    }) => {
      handleAddTaskGroup({
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        description: data.description,
      });
    },
    [handleAddTaskGroup]
  );
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

  const [hasUserToggledMiniCalendar, setHasUserToggledMiniCalendar] =
    useState<boolean>(false);

  // Disable animation on initial mount and when switching tabs; enable only after explicit user toggle
  useEffect(() => {
    setHasUserToggledMiniCalendar(false);
  }, [currentView]);

  const handleToggleMiniCalendar = useCallback(() => {
    setHasUserToggledMiniCalendar(true);
    toggleTaskViewMiniCalendar();
  }, [toggleTaskViewMiniCalendar]);

  // Header controls: collapse toggle button (identical styling/behavior) per view
  const rightHeaderControls = useMemo(() => {
    if (currentView === 'task') {
      return (
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            taskViewMiniCalendarExpanded
              ? 'Hide mini calendar'
              : 'Show mini calendar'
          }
          className="h-8 w-8"
          onClick={handleToggleMiniCalendar}
        >
          {taskViewMiniCalendarExpanded ? (
            <CalendarArrowUp className="h-4 w-4" />
          ) : (
            <CalendarArrowDown className="h-4 w-4" />
          )}
        </Button>
      );
    }
    if (currentView === 'calendar') {
      return (
        <Button
          variant="ghost"
          size="icon"
          aria-label={calendarViewInputExpanded ? 'Hide input' : 'Show input'}
          className="h-8 w-8"
          onClick={handleToggleSmartInput}
        >
          {calendarViewInputExpanded ? (
            <ArrowUpToLine className="h-4 w-4" />
          ) : (
            <ArrowDownToLine className="h-4 w-4" />
          )}
        </Button>
      );
    }
    return null;
  }, [
    currentView,
    taskViewMiniCalendarExpanded,
    handleToggleMiniCalendar,
    calendarViewInputExpanded,
    handleToggleSmartInput,
  ]);

  // Main content - TaskList in calendar view, EventOverview in task view
  const mainContent = useMemo(() => {
    return currentView === 'calendar' ? (
      <Suspense
        fallback={<div className="h-40 animate-pulse bg-muted rounded-md" />}
      >
        <TaskList
          tasks={tasks}
          taskGroups={taskGroups}
          activeTaskGroupId={activeTaskGroupId}
          onToggleTask={memoizedHandleToggleTask}
          onEditTask={memoizedHandleEditTask}
          onDeleteTask={memoizedHandleDeleteTask}
          onScheduleTask={memoizedHandleScheduleTask}
          onRemoveTag={memoizedHandleRemoveTag}
          onCreateTaskGroup={memoizedHandleAddTaskGroupForTaskList}
          onEditTaskGroup={memoizedHandleEditTaskGroup}
          onSelectTaskGroup={memoizedHandleSelectTaskGroup}
          onUpdateTaskGroupIcon={memoizedHandleUpdateTaskGroupIcon}
          onUpdateTaskGroupColor={memoizedHandleUpdateTaskGroupColor}
          onDeleteTaskGroup={memoizedHandleDeleteTaskGroup}
          showCreateTaskDialog={showCreateTaskDialog}
          onShowCreateTaskDialog={memoizedSetShowCreateTaskDialog}
          calendarMode={true}
          maxTasks={10}
        />
      </Suspense>
    ) : (
      <div className="space-y-3">
        <Collapsible open={taskViewMiniCalendarExpanded}>
          <CollapsibleContent
            className={
              'overflow-hidden ' +
              (hasUserToggledMiniCalendar
                ? 'data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up'
                : '')
            }
          >
            <div
              className={
                hasUserToggledMiniCalendar ? 'calendar-item' : undefined
              }
            >
              <div className="pt-1">
                <MiniCalendar
                  className="w-full rounded-md bg-card [--cell-size:--spacing(7)]"
                  classNames={{
                    root: 'w-full',
                    months: 'flex flex-col gap-2 md:flex-row relative',
                    month: 'flex flex-col w-full gap-2',
                    week: 'flex w-full',
                  }}
                  captionLayout="label"
                  showOutsideDays
                  mode="single"
                  selected={today}
                />
                <div className="h-2" />
              </div>
            </div>
            <div
              className={
                hasUserToggledMiniCalendar ? 'calendar-item' : undefined
              }
            >
              <Separator />
            </div>
          </CollapsibleContent>
        </Collapsible>
        <EventOverview maxEvents={7} showHeader={false} />
      </div>
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
    memoizedHandleSelectTaskGroup,
    memoizedHandleUpdateTaskGroupIcon,
    memoizedHandleUpdateTaskGroupColor,
    memoizedHandleDeleteTaskGroup,
    memoizedHandleAddTaskGroupForTaskList,
    memoizedHandleEditTaskGroup,
    showCreateTaskDialog,
    memoizedSetShowCreateTaskDialog,
    today,
    taskViewMiniCalendarExpanded,
    hasUserToggledMiniCalendar,
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
      emoji: string;
      color: string;
      description?: string;
    }) =>
      handleAddTaskGroup({
        name: data.name,
        emoji: data.emoji,
        color: data.color,
        description: data.description || '',
      }),
    [handleAddTaskGroup]
  );
  const memoizedHandleEditTaskGroupForList = useCallback(
    (
      id: string,
      updates: {
        name: string;
        emoji: string;
        color: string;
        description?: string;
      }
    ) =>
      handleEditTaskGroup(id, {
        name: updates.name,
        color: updates.color,
        emoji: updates.emoji,
        description: updates.description,
      }),
    [handleEditTaskGroup]
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
      <div className="space-y-2">
        <TaskGroupList
          taskGroups={taskGroups}
          activeTaskGroupId={activeTaskGroupId}
          onAddTaskGroup={memoizedHandleAddTaskGroupForList}
          onEditTaskGroup={memoizedHandleEditTaskGroupForList}
          onDeleteTaskGroup={memoizedHandleDeleteTaskGroup}
          onSelectTaskGroup={memoizedHandleSelectTaskGroup}
        />
        {showSidebarTaskAnalytics && (
          <Suspense
            fallback={
              <div className="h-20 animate-pulse bg-muted rounded-md" />
            }
          >
            <TaskAnalyticsSummary />
          </Suspense>
        )}
      </div>
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
    showSidebarTaskAnalytics,
  ]);

  return (
    <>
      <BaseSidebarPane
        className={className}
        additionalHeaderContent={additionalHeaderContent}
        showViewToggle={true}
        showSidebarTrigger={true}
        rightHeaderControls={rightHeaderControls}
        mainContent={mainContent}
        footerListContent={footerListContent}
      />
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
