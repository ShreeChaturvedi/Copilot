import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE_SETTLE, EASE_OUT, DUR_3_S } from '@/lib/motion';
import { EnhancedTaskInput } from '@/components/smart-input/EnhancedTaskInput';
import type { UploadedFile } from '@/components/smart-input/components/FileUploadZone';
import { TaskControls } from '@/components/tasks/TaskControls';
import { TaskFolderGrid } from '@/components/tasks/TaskFolderGrid';
import { TaskPaneContainer } from '@/components/tasks/TaskPaneContainer';
import { useUIStore } from '@/stores/uiStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { cn } from '@/lib/utils';
import type { SmartTaskData } from '@/components/smart-input/SmartTaskInput';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCommandBarStore } from '@/stores/commandBarStore';

// Floating layers the quick-add panel should never fight with: Radix
// popover/dropdown/select portals (all share this wrapper attribute) plus
// any Dialog/AlertDialog/Sheet content (all render role="(alert)dialog").
// A click or Escape that lands inside one of these is that layer's to
// handle, not the panel's.
const NESTED_OVERLAY_SELECTOR =
  '[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"]';
const KanbanBoard = lazy(() => import('@/components/tasks/TaskKanbanBoard'));

interface TaskFocusPaneProps {
  className?: string;
}

export const TaskFocusPane: React.FC<TaskFocusPaneProps> = ({ className }) => {
  const {
    dragState,
    taskViewMode,
    globalShowCompleted,
    taskPanes,
    maxTaskPanes,
    addTaskPane,
    selectedKanbanTaskListId,
  } = useUIStore();
  const [searchValue, setSearchValue] = useState('');

  // Task management with task operations enabled
  const {
    tasks,
    tasksLoading,
    addTask,
    handleAddTask,
    taskGroups,
    activeTaskGroupId,
    setShowCreateTaskDialog,
    handleSelectTaskGroup,
  } = useTaskManagement({ includeTaskOperations: true });

  // Wrapper to pass attached files to backend via taskApi
  const handleAddTaskWithFiles = (
    title: string,
    _groupId?: string,
    smartData?: {
      description?: string;
      priority?: 'low' | 'medium' | 'high';
      scheduledDate?: Date;
      tags?: Array<{
        id: string;
        type: string;
        value: string;
        displayText: string;
        iconName: string;
        color?: string;
      }>;
      originalInput?: string;
      title?: string;
    },
    files?: UploadedFile[]
  ) => {
    const taskListId =
      _groupId && _groupId !== 'default' && _groupId !== 'all'
        ? _groupId
        : undefined;
    addTask.mutate({
      title,
      description: smartData?.description,
      taskListId,
      priority: smartData?.priority,
      scheduledDate: smartData?.scheduledDate,
      tags: smartData?.tags?.map((tag) => ({
        id: tag.id,
        // enforce union-compatible tag type
        type: tag.type as
          | 'date'
          | 'time'
          | 'priority'
          | 'location'
          | 'person'
          | 'label'
          | 'project',
        value: typeof tag.value === 'string' ? tag.value : String(tag.value),
        displayText: tag.displayText,
        iconName: tag.iconName,
        color: tag.color,
      })),
      parsedMetadata:
        smartData?.originalInput && smartData?.title
          ? {
              originalInput: smartData.originalInput,
              cleanTitle: smartData.title,
            }
          : undefined,
      attachments: files?.map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        url: f.preview || '',
      })),
    });
  };

  // Calculate task counts for TaskControls
  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  // Add pane functionality
  const handleAddPane = () => {
    if (taskPanes.length < maxTaskPanes) {
      addTaskPane();
    }
  };

  const canAddPane = taskPanes.length < maxTaskPanes && taskViewMode === 'list';

  // Show/Hide enhanced input on demand
  const {
    enhancedInputVisible,
    setEnhancedInputVisible,
    enhancedInputTaskListId,
    setEnhancedInputTaskListId,
  } = useSettingsStore();
  const [showEnhancedInput, setShowEnhancedInput] =
    useState(enhancedInputVisible);
  const handleToggleAddTaskInput = () => setShowEnhancedInput((v) => !v);
  const handleHideAddTaskInput = () => setShowEnhancedInput(false);
  const enhancedInputRef = useRef<HTMLDivElement>(null);

  // Follow external toggles too (e.g. the kanban board's "+ New task" ghost
  // row sets enhancedInputVisible in the settings store)
  useEffect(() => {
    setShowEnhancedInput(enhancedInputVisible);
  }, [enhancedInputVisible]);

  // Cmd+K "New task" / global N open the enhanced input (design-brief §4.6)
  useEffect(() => {
    const onNewTask = () => setShowEnhancedInput(true);
    window.addEventListener('app:new-task', onNewTask);
    return () => window.removeEventListener('app:new-task', onNewTask);
  }, []);

  // Escape dismisses the panel — but only when it's the topmost layer. If a
  // popover/dropdown/dialog spawned from within it (task-group picker,
  // attach-files dialog, ...) is open, let that layer handle Escape first.
  useEffect(() => {
    if (!showEnhancedInput) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector(NESTED_OVERLAY_SELECTOR)) return;
      setShowEnhancedInput(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showEnhancedInput]);

  // Click-outside dismisses the panel too. Clicks inside the panel itself,
  // inside a nested overlay it spawned, or on the header toggle button
  // (which already has its own open/close handling) are not "outside".
  useEffect(() => {
    if (!showEnhancedInput) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (enhancedInputRef.current?.contains(target)) return;
      if (target.closest('[data-slot="add-task-toggle"]')) return;
      if (target.closest(NESTED_OVERLAY_SELECTOR)) return;
      setShowEnhancedInput(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showEnhancedInput]);

  // Close the panel when the Cmd+K command bar opens on top of it, instead
  // of leaving it lingering behind the scrim.
  const commandBarOpen = useCommandBarStore((s) => s.open);
  useEffect(() => {
    if (commandBarOpen) setShowEnhancedInput(false);
  }, [commandBarOpen]);

  // Close the panel on List/Board/Folder switches so it doesn't linger over
  // a view it wasn't opened in (skip the initial mount).
  const didMountTaskViewMode = useRef(false);
  useEffect(() => {
    if (!didMountTaskViewMode.current) {
      didMountTaskViewMode.current = true;
      return;
    }
    setShowEnhancedInput(false);
  }, [taskViewMode]);

  // Clear the persisted visibility flag on unmount (e.g. switching from
  // Tasks to Calendar) so a later remount doesn't resurrect a stale open
  // panel from before.
  useEffect(() => {
    return () => {
      setEnhancedInputVisible(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Board scope for the back chevron label (#56)
  const kanbanListId = selectedKanbanTaskListId ?? activeTaskGroupId;
  const kanbanListName =
    taskGroups.find((g) => g.id === kanbanListId)?.name ?? 'Tasks';

  // Autofocus inner input when panel becomes visible
  useEffect(() => {
    if (!showEnhancedInput) return;

    const focusTargets = [
      'enhanced-task-input-textarea',
      'enhanced-task-input-textarea-fallback',
      'smart-task-input-highlighted',
      'highlighted-task-input',
      'smart-task-input-fallback',
    ];

    const tryFocus = () => {
      for (const id of focusTargets) {
        const el = document.getElementById(id) as
          | HTMLTextAreaElement
          | HTMLInputElement
          | null;
        if (el) {
          el.focus();
          if ('select' in el && typeof el.select === 'function') {
            el.select();
          }
          return true;
        }
      }
      return false;
    };

    // Attempt now, then again on next frame and microtask to handle mount/animation timing
    if (!tryFocus()) {
      requestAnimationFrame(() => {
        if (!tryFocus()) {
          setTimeout(tryFocus, 0);
        }
      });
    }
  }, [showEnhancedInput]);

  // Persist enhanced input visibility to settings
  useEffect(() => {
    setEnhancedInputVisible(showEnhancedInput);
  }, [showEnhancedInput, setEnhancedInputVisible]);

  return (
    <div
      className={cn(
        'bg-background text-foreground',
        'flex flex-col h-full relative',
        className
      )}
      data-slot="task-focus-pane"
    >
      {/* Task Controls Header */}
      <div className="border-b border-border bg-background p-4">
        <TaskControls
          taskCount={globalShowCompleted ? tasks.length : activeTasks.length}
          completedCount={completedTasks.length}
          onAddPane={handleAddPane}
          canAddPane={canAddPane}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onToggleAddTaskInput={handleToggleAddTaskInput}
          isAddTaskInputVisible={showEnhancedInput}
          paneCount={taskPanes.length}
          boardListName={kanbanListName}
        />
      </div>

      {/* Scheduling Drop Zones - Only visible when dragging. One bordered,
          internally-divided frame (Factory's "one container, internal
          hairlines" pattern) instead of 5 independent boxes on a tinted
          band — the border + hairline dividers carry the structure, so no
          extra wash is needed under the header. Today keeps the sanctioned
          aqua film (§1.6 rule 3, "live/immediate"); the rest are neutral
          hover wells, Later muted to rank it last (drop-target *behavior*
          here is Tasks-owned; this is visual/structural only). */}
      {dragState.isDragging && (
        <div className="px-4 py-3 border-b border-hairline">
          <div className="flex items-stretch h-11 rounded-btn border border-hairline overflow-hidden divide-x divide-hairline">
            <div className="flex-1 flex items-center justify-center bg-aqua-film-08 cursor-pointer transition-colors duration-150 ease-out">
              <span className="text-sm font-medium text-primary">Today</span>
            </div>
            <div className="flex-1 flex items-center justify-center hover:bg-surface-hover cursor-pointer transition-colors duration-150 ease-out">
              <span className="text-sm font-medium text-ink">Tomorrow</span>
            </div>
            <div className="flex-1 flex items-center justify-center hover:bg-surface-hover cursor-pointer transition-colors duration-150 ease-out">
              <span className="text-sm font-medium text-ink">This Week</span>
            </div>
            <div className="flex-1 flex items-center justify-center hover:bg-surface-hover cursor-pointer transition-colors duration-150 ease-out">
              <span className="text-sm font-medium text-ink">Next Week</span>
            </div>
            <div className="flex-1 flex items-center justify-center hover:bg-surface-hover cursor-pointer transition-colors duration-150 ease-out">
              <span className="text-sm font-medium text-ink-muted">Later</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Task Display Area */}
      <div className="flex-1 overflow-hidden">
        {taskViewMode === 'folder' ? (
          <TaskFolderGrid />
        ) : taskViewMode === 'kanban' ? (
          <Suspense fallback={null}>
            <KanbanBoard />
          </Suspense>
        ) : (
          <TaskPaneContainer searchValue={searchValue} />
        )}
      </div>

      {/* Enhanced Input - overlayed at the bottom above content */}
      <AnimatePresence mode="wait">
        {showEnhancedInput && (
          <motion.div
            key="enhanced-input"
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: DUR_3_S, ease: EASE_SETTLE },
            }}
            exit={{
              opacity: 0,
              y: 12,
              transition: { duration: 0.16, ease: EASE_OUT },
            }}
            className="absolute inset-x-0 bottom-0 z-50 pointer-events-none"
          >
            <div
              ref={enhancedInputRef}
              className="pointer-events-auto mx-4 mb-4"
            >
              <EnhancedTaskInput
                onAddTask={(...args) => {
                  handleAddTask(...args);
                  handleHideAddTaskInput();
                }}
                onAddTaskWithFiles={(
                  title,
                  groupId,
                  smart: SmartTaskData | undefined,
                  files
                ) => {
                  const normalizedSmart = smart
                    ? {
                        description: smart.description,
                        priority: smart.priority,
                        scheduledDate: smart.scheduledDate,
                        tags: smart.tags?.map((t) => ({
                          id: t.id,
                          type: t.type,
                          value:
                            typeof t.value === 'string'
                              ? t.value
                              : String(t.value),
                          displayText: t.displayText,
                          iconName: t.iconName,
                          color: t.color,
                        })),
                        originalInput: smart.originalInput,
                        title: smart.title,
                      }
                    : undefined;
                  handleAddTaskWithFiles(
                    title,
                    groupId,
                    normalizedSmart,
                    files
                  );
                  handleHideAddTaskInput();
                }}
                taskGroups={taskGroups}
                activeTaskGroupId={enhancedInputTaskListId || activeTaskGroupId}
                onCreateTaskGroup={() => setShowCreateTaskDialog(true)}
                onSelectTaskGroup={(groupId) => {
                  setEnhancedInputTaskListId(groupId);
                  handleSelectTaskGroup(groupId);
                }}
                disabled={tasksLoading || addTask.isPending}
                enableSmartParsing={true}
                showConfidence={false}
                maxDisplayTags={3}
                placeholder="What would you like to work on?"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskFocusPane;
