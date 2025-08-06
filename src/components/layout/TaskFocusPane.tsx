import React, { useState } from 'react';
import { EnhancedTaskInput } from '@/components/smart-input/EnhancedTaskInput';
import { TaskControls } from '@/components/tasks/TaskControls';
import { TaskFolderGrid } from '@/components/tasks/TaskFolderGrid';
import { TaskPaneContainer } from '@/components/tasks/TaskPaneContainer';
import { useUIStore } from '@/stores/uiStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { cn } from '@/lib/utils';

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

  return (
    <div
      className={cn(
        'bg-background text-foreground',
        'flex flex-col h-full',
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
        ) : (
          <TaskPaneContainer searchValue={searchValue} />
        )}
      </div>

      {/* Enhanced Input - Bottom Positioned */}
      <div className="border-t border-border bg-background p-6">
        <EnhancedTaskInput
          onAddTask={handleAddTask}
          taskGroups={taskGroups}
          activeTaskGroupId={activeTaskGroupId}
          onCreateTaskGroup={() => setShowCreateTaskDialog(true)}
          onSelectTaskGroup={handleSelectTaskGroup}
          disabled={tasksLoading || addTask.isPending}
          enableSmartParsing={true}
          showConfidence={false}
          maxDisplayTags={3}
          placeholder="What would you like to work on?"
        />
      </div>
    </div>
  );
};

export default TaskFocusPane;
