/**
 * TaskControls - Modern task controls with sort, filter, and view options
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownUp,
  ArrowDownAZ,
  ArrowUpZA,
  Calendar,
  CalendarClock,
  Flag,
  AlertTriangle,
  Clock,
  CalendarPlus,
  Filter,
  FolderOpen,
  List,
  Search,
  Plus,
  X,
  Check,
  Columns2,
  Columns3,
  ArrowDownToDot,
} from 'lucide-react';
import { SharedToggleButton, type ToggleOption } from '@/components/ui/SharedToggleButton';
import { SmoothSidebarTrigger } from '@/components/layout/SmoothSidebarTrigger';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useUIStore,
  type TaskViewMode,
  type SortBy,
  type SortOrder,
} from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { format, addDays, startOfDay } from 'date-fns';
import { toLocal, isSameDay } from '@/utils/date';

export interface TaskControlsProps {
  className?: string;
  taskCount?: number;
  completedCount?: number;
  onAddPane?: () => void;
  canAddPane?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onToggleAddTaskInput?: () => void;
  isAddTaskInputVisible?: boolean;
  paneCount?: number;
}

/**
 * Sort icon mapping system with contextually appropriate icons
 */
const SORT_ICON_MAP: Record<
  SortBy,
  {
    default: React.ComponentType<{ className?: string }>;
    ascending: React.ComponentType<{ className?: string }>;
    descending: React.ComponentType<{ className?: string }>;
  }
> = {
  title: {
    default: ArrowDownAZ,
    ascending: ArrowDownAZ,
    descending: ArrowUpZA,
  },
  dueDate: {
    default: Calendar,
    ascending: Calendar,
    descending: CalendarClock,
  },
  priority: {
    default: Flag,
    ascending: Flag,
    descending: AlertTriangle,
  },
  createdAt: {
    default: Clock,
    ascending: Clock,
    descending: CalendarPlus,
  },
};

/**
 * Sort options configuration with specific icons
 */
const SORT_OPTIONS: Array<{
  value: SortBy;
  label: string;
  getIcon: (
    sortOrder: SortOrder
  ) => React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'title',
    label: 'Title',
    getIcon: (order) =>
      SORT_ICON_MAP.title[order === 'asc' ? 'ascending' : 'descending'],
  },
  {
    value: 'dueDate',
    label: 'Due Date',
    getIcon: (order) =>
      SORT_ICON_MAP.dueDate[order === 'asc' ? 'ascending' : 'descending'],
  },
  {
    value: 'priority',
    label: 'Priority',
    getIcon: (order) =>
      SORT_ICON_MAP.priority[order === 'asc' ? 'ascending' : 'descending'],
  },
  {
    value: 'createdAt',
    label: 'Created Date',
    getIcon: (order) =>
      SORT_ICON_MAP.createdAt[order === 'asc' ? 'ascending' : 'descending'],
  },
];

// Define view mode options for the SharedToggleButton
const VIEW_MODE_OPTIONS: ToggleOption<TaskViewMode>[] = [
  {
    value: 'folder',
    label: 'Folder',
    icon: FolderOpen,
  },
  {
    value: 'list',
    label: 'List',
    icon: List,
  },
];

/**
 * Get sort icon based on current sort and order
 */
function getSortIcon(
  sortBy: SortBy,
  currentSort: SortBy,
  sortOrder: SortOrder
) {
  if (sortBy !== currentSort) {
    return SORT_ICON_MAP[sortBy].default;
  }
  return SORT_ICON_MAP[sortBy][
    sortOrder === 'asc' ? 'ascending' : 'descending'
  ];
}

/**
 * Get main sort button icon - always shows ArrowDownUp
 */
function getMainSortIcon() {
  return ArrowDownUp;
}

/**
 * Main TaskControls component
 */
/**
 * Animated Search Component with Keyboard Shortcuts
 */
interface AnimatedSearchProps {
  value: string;
  onChange: (value: string) => void;
}

const AnimatedSearch: React.FC<AnimatedSearchProps> = ({ value, onChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts effect
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F to activate search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        handleSearchClick();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleSearchClick = () => {
    setIsExpanded(true);
    // Focus input after animation completes
    setTimeout(() => {
      inputRef.current?.focus();
    }, 250);
  };

  const handleClose = () => {
    setIsExpanded(false);
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <div className="relative">
      <motion.div
        className="flex items-center"
        layout
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {/* Search Icon/Button */}
        <motion.div layout>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={isExpanded ? undefined : handleSearchClick}
            title={isExpanded ? undefined : 'Search tasks (Ctrl+F)'}
            aria-label={isExpanded ? undefined : 'Open search input'}
            aria-expanded={isExpanded}
          >
            <Search className="w-3.5 h-3.5" />
          </Button>
        </motion.div>

        {/* Expandable Search Input */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '200px', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="relative overflow-hidden"
              role="search"
              aria-label="Task search"
            >
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tasks..."
                className="w-full h-7 px-3 pr-8 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-0 focus:border-border focus-visible:ring-0 focus-visible:outline-none"
                aria-label="Search tasks by title or content"
                aria-describedby="search-help"
              />
              {/* Screen reader helper text */}
              <div id="search-help" className="sr-only">
                Press Escape to close search, or use Ctrl+F to open
              </div>
              {/* Close button */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-0.5 h-6 w-6 p-0"
                onClick={handleClose}
                title="Close search (Escape)"
                aria-label="Close search input"
              >
                <X className="w-3 h-3" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export const TaskControls: React.FC<TaskControlsProps> = ({
  className,
  taskCount = 0, // Keep for interface compatibility but not used in display
  completedCount = 0,
  onAddPane,
  canAddPane = false,
  searchValue = '',
  onSearchChange,
  onToggleAddTaskInput,
  isAddTaskInputVisible = false,
  paneCount = 1,
}) => {
  // Suppress unused variable warning - taskCount kept for interface compatibility
  void taskCount;
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

  // Today title with efficient midnight update and visibility sync
  const [today, setToday] = useState<Date>(() => new Date());
  useEffect(() => {
    let timeoutId: number | undefined;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = startOfDay(addDays(now, 1));
      const ms = Math.max(0, nextMidnight.getTime() - now.getTime());
      timeoutId = window.setTimeout(() => setToday(new Date()), ms);
    };
    scheduleNextMidnight();
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        const now = new Date();
        if (!isSameDay(now, today)) setToday(now);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [today]);
  const todayTitle = useMemo(() => format(toLocal(today), 'MMMM d, yyyy'), [today]);

  return (
    <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-4', className)}>
      {/* Left Section - Sidebar Trigger + Today title */}
      <div className="flex items-center gap-3 justify-self-start">
        <SmoothSidebarTrigger position="rightPane" />
        <h2 className="text-lg font-semibold text-foreground">
          {todayTitle.includes(' ')
            ? (
                <>
                  <span className="font-bold">{todayTitle.split(' ')[0]}</span>
                  <span className="font-normal"> {todayTitle.split(' ').slice(1).join(' ')}</span>
                </>
              )
            : todayTitle}
        </h2>
      </div>

      {/* Center Section - View Mode Toggle */}
      <div className="justify-self-center">
        <SharedToggleButton
          currentValue={taskViewMode}
          options={VIEW_MODE_OPTIONS}
          onValueChange={handleViewModeChange}
          size="sm"
          showLabels={true}
          showShortLabelsOnMobile={false}
        />
      </div>

      {/* Right Section - Icon-Only Controls */}
      <div className="flex items-center gap-1 justify-self-end">
        {/* Grouped Action Buttons */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-md p-1">
          {/* Animated Search */}
          <AnimatedSearch
            value={searchValue}
            onChange={onSearchChange || (() => {})}
          />

          {/* Sort Button */}
          <Tooltip>
            <DropdownMenu>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    {React.createElement(getMainSortIcon(), {
                      className: 'w-3.5 h-3.5',
                    })}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
                          <Badge
                            variant="secondary"
                            className="ml-auto text-xs"
                          >
                            {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <TooltipContent>
              <p>Sort tasks</p>
            </TooltipContent>
          </Tooltip>

          {/* Filter Button (Future Enhancement) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled // Disabled for now
              >
                <Filter className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Filter tasks</p>
            </TooltipContent>
          </Tooltip>

          {/* Show Completed Toggle with Checkmark */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleShowCompletedChange(!globalShowCompleted)
                  }
                  className={cn(
                    // Base styling - consistent with other icon buttons
                    'h-7 w-7 p-0',
                    // Default state
                    globalShowCompleted
                      ? [
                          // On state - calendar green with visible border and transparency (same as Autotag)
                          'bg-[oklch(0.7_0.15_140_/_0.15)] text-foreground border border-[oklch(0.7_0.15_140)]',
                          // Dark mode adjustments
                          'dark:bg-[oklch(0.7_0.15_140_/_0.1)] dark:border-[oklch(0.7_0.15_140)]',
                          // Hover states for on state
                          'hover:bg-[oklch(0.7_0.15_140_/_0.2)] dark:hover:bg-[oklch(0.7_0.15_140_/_0.15)]',
                        ]
                      : [
                          // Off state - default ghost button styling
                          'text-muted-foreground hover:text-foreground border border-transparent',
                          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
                        ]
                  )}
                  aria-label={`${globalShowCompleted ? 'Hide' : 'Show'} completed tasks`}
                >
                  <Check className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{globalShowCompleted ? 'Hide' : 'Show'} completed tasks</p>
              </TooltipContent>
            </Tooltip>
            {/* Superscript completion count using shadcn badge */}
            {completedCount > 0 && (
              <Badge
                variant="secondary"
                className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] font-medium"
              >
                {completedCount > 99 ? '99+' : completedCount}
              </Badge>
            )}
          </div>


          {/* Add Pane Button (columns icon based on count) */}
          {onAddPane && taskViewMode === 'list' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={canAddPane ? onAddPane : undefined}
                  disabled={!canAddPane}
                  aria-label="Add pane"
                >
                  {paneCount === 1 ? (
                    <Columns2 className="w-3.5 h-3.5" />
                  ) : (
                    <Columns3 className="w-3.5 h-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{canAddPane ? 'Add new pane' : 'Max 3 panes'}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Shiny Add Task Button (same visual as calendar toolbar) with toggle */}
          {onToggleAddTaskInput && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onToggleAddTaskInput}
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 relative overflow-hidden transition-all duration-300 ease-out",
                    "bg-gradient-to-br from-secondary/98 via-secondary to-secondary/95",
                    "text-secondary-foreground shadow-xs border border-border/20",
                    "hover:scale-105 hover:shadow-lg hover:shadow-secondary/20",
                    "hover:from-secondary/95 hover:via-secondary/98 hover:to-secondary/90",
                    "before:absolute before:inset-0 before:bg-gradient-to-r",
                    "before:from-transparent before:via-black/15 before:to-transparent",
                    "dark:before:via-white/15",
                    "before:translate-x-[-150%] before:skew-x-12 before:transition-transform before:duration-[480ms]",
                    "hover:before:translate-x-[150%]",
                    "active:scale-[1.02] active:shadow-md"
                  )}
                  aria-label="Add task"
                >
                  {isAddTaskInputVisible ? (
                    <ArrowDownToDot className="h-3.5 w-3.5 relative z-10" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 relative z-10" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isAddTaskInputVisible ? 'Hide add task' : 'Add task'}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskControls;
