import React, { useEffect, useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
      priority?: 'low' | 'medium' | 'high'
      scheduledDate?: Date
      tags?: Array<{
        id: string
        type: string
        value: string
        displayText: string
        iconName: string
        color?: string
      }>
      originalInput?: string
      title?: string
    },
    files?: UploadedFile[],
  ) => {
    const taskListId = _groupId && _groupId !== 'default' && _groupId !== 'all' ? _groupId : undefined;
    addTask.mutate({
      title,
      taskListId,
      priority: smartData?.priority,
      scheduledDate: smartData?.scheduledDate,
      tags: smartData?.tags?.map((tag) => ({
        id: tag.id,
        // enforce union-compatible tag type
        type: tag.type as 'date' | 'time' | 'priority' | 'location' | 'person' | 'label' | 'project',
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
  const { enhancedInputVisible, setEnhancedInputVisible, enhancedInputTaskListId, setEnhancedInputTaskListId } = useSettingsStore();
  const [showEnhancedInput, setShowEnhancedInput] = useState(enhancedInputVisible);
  const handleToggleAddTaskInput = () => setShowEnhancedInput((v) => !v);
  const handleHideAddTaskInput = () => setShowEnhancedInput(false);

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
        const el = document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement | null;
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
        />
      </div>

      {/* Scheduling Drop Zones - Only visible when dragging */}
      {dragState.isDragging && (
        <div className="px-6 py-4 border-b border-border bg-muted/20 transition-all duration-200 ease-out">
          <div className="flex items-center gap-3 h-12">
            <div className="flex-1 h-11 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center hover:bg-green-100 transition-colors cursor-pointer">
              <span className="text-sm font-medium text-green-700">Today</span>
            </div>
            <div className="flex-1 h-11 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors cursor-pointer">
              <span className="text-sm font-medium text-blue-700">
                Tomorrow
              </span>
            </div>
            <div className="flex-1 h-11 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-center hover:bg-purple-100 transition-colors cursor-pointer">
              <span className="text-sm font-medium text-purple-700">
                This Week
              </span>
            </div>
            <div className="flex-1 h-11 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center hover:bg-orange-100 transition-colors cursor-pointer">
              <span className="text-sm font-medium text-orange-700">
                Next Week
              </span>
            </div>
            <div className="flex-1 h-11 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
              <span className="text-sm font-medium text-gray-700">Later</span>
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
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute inset-x-0 bottom-0 z-50 pointer-events-none"
          >
            <div className="pointer-events-auto mx-4 mb-4">
              <EnhancedTaskInput
                onAddTask={(...args) => {
                  handleAddTask(...args);
                  handleHideAddTaskInput();
                }}
                onAddTaskWithFiles={(title, groupId, smart: SmartTaskData | undefined, files) => {
                  const normalizedSmart = smart
                    ? {
                        priority: smart.priority,
                        scheduledDate: smart.scheduledDate,
                        tags: smart.tags?.map((t) => ({
                          id: t.id,
                          type: t.type,
                          value: typeof t.value === 'string' ? t.value : String(t.value),
                          displayText: t.displayText,
                          iconName: t.iconName,
                          color: t.color,
                        })),
                        originalInput: smart.originalInput,
                        title: smart.title,
                      }
                    : undefined;
                  handleAddTaskWithFiles(title, groupId, normalizedSmart, files);
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
