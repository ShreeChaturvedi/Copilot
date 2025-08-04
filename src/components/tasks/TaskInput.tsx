/**
 * TaskInput - Modern professional input matching screenshot
 */

import React, { useState } from 'react';
import { ArrowUp, Plus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Task group types
export interface TaskGroup {
  id: string;
  name: string;
  iconId: string;
  color: string;
  description?: string;
}

export interface TaskInputProps {
  onAddTask: (title: string, groupId?: string) => void;
  taskGroups?: TaskGroup[];
  activeTaskGroupId?: string;
  onCreateTaskGroup?: () => void;
  onSelectTaskGroup?: (groupId: string) => void;
  disabled?: boolean;
}

export const TaskInput: React.FC<TaskInputProps> = ({ 
  onAddTask,
  taskGroups = [],
  activeTaskGroupId,
  onCreateTaskGroup,
  onSelectTaskGroup,
  disabled = false 
}) => {
  const [title, setTitle] = useState('');

  // Default task group if none exist
  const defaultTaskGroup: TaskGroup = {
    id: 'default',
    name: 'Tasks',
    iconId: 'CheckSquare',
    color: '#3b82f6',
    description: 'Default task group'
  };

  // Get current active task group
  const activeTaskGroup = taskGroups.find(group => group.id === activeTaskGroupId) || 
    (taskGroups.length > 0 ? taskGroups[0] : defaultTaskGroup);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle) {
      // Capitalize first letter
      const capitalizedTitle = trimmedTitle.charAt(0).toUpperCase() + trimmedTitle.slice(1);
      onAddTask(capitalizedTitle, activeTaskGroup.id);
      setTitle('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  // Get the icon component for the active task group
  const ActiveGroupIcon = (LucideIcons as any)[activeTaskGroup.iconId] || (LucideIcons as any)['CheckSquare'];

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Task Group Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 z-10"
            aria-label={`Current task group: ${activeTaskGroup.name}`}
          >
            <ActiveGroupIcon 
              className="w-4 h-4" 
              style={{ color: activeTaskGroup.color }}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {taskGroups.map((group) => {
            const GroupIcon = (LucideIcons as any)[group.iconId] || (LucideIcons as any)['CheckSquare'];
            return (
              <DropdownMenuItem
                key={group.id}
                onClick={() => onSelectTaskGroup?.(group.id)}
                className={activeTaskGroup.id === group.id ? 'bg-accent' : ''}
              >
                <GroupIcon 
                  className="mr-2 h-4 w-4" 
                  style={{ color: group.color }}
                />
                <span>{group.name}</span>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          {/* New List Option */}
          <DropdownMenuItem
            onClick={() => onCreateTaskGroup?.()}
            className="text-success hover:text-success hover:bg-success/10 focus:text-success focus:bg-success/10"
          >
            <Plus className="mr-2 h-4 w-4 text-success" />
            <span>New List</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Input
        type="text"
        placeholder="Enter a new task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        className="pl-10 pr-10 border-input"
        aria-label="New task input"
      />
      
      <Button
        type="submit"
        disabled={disabled || !title.trim()}
        size="sm"
        variant="ghost"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        aria-label="Add task"
      >
        <ArrowUp className="w-4 h-4" />
      </Button>
    </form>
  );
};

export default TaskInput;