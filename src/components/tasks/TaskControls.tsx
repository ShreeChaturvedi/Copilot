/**
 * TaskControls - Modern task controls with sort, filter, and view options
 */

import React from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  FolderOpen,
  List,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useUIStore,
  type TaskViewMode,
  type SortBy,
  type SortOrder,
} from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export interface TaskControlsProps {
  className?: string;
  taskCount?: number;
  completedCount?: number;
}

/**
 * Sort options configuration
 */
const SORT_OPTIONS: Array<{
  value: SortBy;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'title', label: 'Title', icon: ArrowUpDown },
  { value: 'dueDate', label: 'Due Date', icon: ArrowUpDown },
  { value: 'priority', label: 'Priority', icon: ArrowUpDown },
  { value: 'createdAt', label: 'Created Date', icon: ArrowUpDown },
];

/**
 * Get sort icon based on current sort and order
 */
function getSortIcon(
  sortBy: SortBy,
  currentSort: SortBy,
  sortOrder: SortOrder
) {
  if (sortBy !== currentSort) return ArrowUpDown;
  return sortOrder === 'asc' ? ArrowUp : ArrowDown;
}

/**
 * Main TaskControls component
 */
export const TaskControls: React.FC<TaskControlsProps> = ({
  className,
  taskCount = 0,
  completedCount = 0,
}) => {
  const {
    taskViewMode,
    setTaskViewMode,
    globalShowCompleted,
    setGlobalShowCompleted,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
  } = useUIStore();

  // Handle view mode toggle
  const handleViewModeChange = (mode: TaskViewMode) => {
    setTaskViewMode(mode);
  };

  // Handle sort selection
  const handleSortChange = (newSortBy: SortBy) => {
    if (newSortBy === sortBy) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field with default order
      setSortBy(newSortBy);
      setSortOrder(newSortBy === 'createdAt' ? 'desc' : 'asc'); // Newest first for created date
    }
  };

  // Handle show completed toggle
  const handleShowCompletedChange = (checked: boolean) => {
    setGlobalShowCompleted(checked);
  };

  return (
    <div
      className={cn('flex items-center justify-between gap-4 py-2', className)}
    >
      {/* Left Section - View Mode Toggle */}
      <div className="flex items-center gap-2">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-md p-1">
          <Button
            variant={taskViewMode === 'folder' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('folder')}
            className="h-8 px-3 text-xs gap-1"
          >
            <FolderOpen className="w-3 h-3" />
            Folder
          </Button>
          <Button
            variant={taskViewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('list')}
            className="h-8 px-3 text-xs gap-1"
          >
            <List className="w-3 h-3" />
            List
          </Button>
        </div>

        {/* Search Input (Future Enhancement) */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="h-8 w-48 pl-7 text-xs"
            disabled // Disabled for now
          />
        </div>
      </div>

      {/* Right Section - Sort, Filter, Show Completed */}
      <div className="flex items-center gap-2">
        {/* Task Count Badge */}
        {taskCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {taskCount} tasks
            {completedCount > 0 && (
              <span className="ml-1 text-muted-foreground">
                • {completedCount} completed
              </span>
            )}
          </Badge>
        )}

        {/* Sort Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              {React.createElement(getSortIcon(sortBy, sortBy, sortOrder), {
                className: 'w-3 h-3',
              })}
              Sort
              {sortBy !== 'createdAt' && (
                <Badge variant="secondary" className="ml-1 text-xs px-1">
                  {SORT_OPTIONS.find((opt) => opt.value === sortBy)?.label}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {SORT_OPTIONS.map((option) => {
                const IconComponent = getSortIcon(
                  option.value,
                  sortBy,
                  sortOrder
                );
                const isActive = sortBy === option.value;

                return (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => handleSortChange(option.value)}
                    className={cn(
                      'gap-2 cursor-pointer',
                      isActive && 'bg-accent'
                    )}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{option.label}</span>
                    {isActive && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter Button (Future Enhancement) */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          disabled // Disabled for now
        >
          <Filter className="w-3 h-3" />
          Filter
        </Button>

        {/* Show Completed Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="show-completed-global"
            checked={globalShowCompleted}
            onCheckedChange={handleShowCompletedChange}
            className="scale-75"
          />
          <Label
            htmlFor="show-completed-global"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Show completed
            {completedCount > 0 && (
              <span className="ml-1">({completedCount})</span>
            )}
          </Label>
        </div>
      </div>
    </div>
  );
};

export default TaskControls;
