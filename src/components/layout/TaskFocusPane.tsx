import React from 'react';
import { FolderOpen, List, MoreVertical } from 'lucide-react';
import { EnhancedTaskInput } from '@/components/smart-input/EnhancedTaskInput';
import { TaskList } from '@/components/tasks/TaskList';
import { Button } from '@/components/ui/Button';
import { useUIStore, type TaskGrouping } from '@/stores/uiStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { cn } from '@/lib/utils';

interface TaskFocusPaneProps {
  className?: string;
}

export const TaskFocusPane: React.FC<TaskFocusPaneProps> = ({
  className
}) => {
  const { dragState, taskGrouping, taskViewMode, setTaskGrouping, setTaskViewMode } = useUIStore();

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
  } = useTaskManagement({ includeTaskOperations: true });

  return (
    <div 
      className={cn(
        'bg-background text-foreground',
        'flex flex-col h-full',
        className
      )}
      data-slot="task-focus-pane"
    >
      {/* Task Focus Header */}
      <div className="border-b border-border bg-background">
        {/* Enhanced Task Input - Chat-interface style */}
        <div className="p-6">
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

        {/* Scheduling Drop Zones - Only visible when dragging */}
        {dragState.isDragging && (
          <div className="px-6 pb-4 transition-all duration-200 ease-out">
            <div className="flex items-center gap-3 h-15">
              <div className="flex-1 h-11 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center hover:bg-green-100 transition-colors cursor-pointer">
                <span className="text-sm font-medium text-green-700">Today</span>
              </div>
              <div className="flex-1 h-11 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors cursor-pointer">
                <span className="text-sm font-medium text-blue-700">Tomorrow</span>
              </div>
              <div className="flex-1 h-11 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-center hover:bg-purple-100 transition-colors cursor-pointer">
                <span className="text-sm font-medium text-purple-700">This Week</span>
              </div>
              <div className="flex-1 h-11 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center hover:bg-orange-100 transition-colors cursor-pointer">
                <span className="text-sm font-medium text-orange-700">Next Week</span>
              </div>
              <div className="flex-1 h-11 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Later</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task Display Area */}
      <div className="flex-1 overflow-auto">
        {/* Task Grouping Controls */}
        <div className="p-4 border-b border-border bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select 
                className="text-sm bg-background border border-border rounded-md px-3 py-1.5"
                value={taskGrouping}
                onChange={(e) => setTaskGrouping(e.target.value as TaskGrouping)}
              >
                <option value="taskList">By Task List</option>
                <option value="dueDate">By Due Date</option>
                <option value="priority">By Priority</option>
              </select>
              
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                <Button
                  variant={taskViewMode === 'folder' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTaskViewMode('folder')}
                  className="h-7 px-2 text-xs"
                >
                  <FolderOpen className="w-3 h-3 mr-1" />
                  Folder
                </Button>
                <Button
                  variant={taskViewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTaskViewMode('list')}
                  className="h-7 px-2 text-xs"
                >
                  <List className="w-3 h-3 mr-1" />
                  List
                </Button>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Real Task List Component */}
        <div className="p-4">
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
        </div>
      </div>
    </div>
  );
};

export default TaskFocusPane;