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
  ChevronLeft,
  Flag,
  AlertTriangle,
  Clock,
  CalendarPlus,
  Filter,
  FolderOpen,
  List,
  Search,
  Plus,
  SquareKanban,
  X,
  Check,
  Columns2,
  Columns3,
  ArrowDownToDot,
} from 'lucide-react';
import {
  SharedToggleButton,
  type ToggleOption,
} from '@/components/ui/SharedToggleButton';
import { SmoothSidebarTrigger } from '@/components/layout/SmoothSidebarTrigger';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { EASE_OUT } from '@/lib/motion';
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
  /** Name of the list the board is scoped to (back-chevron label, #56) */
  boardListName?: string;
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

// Define view mode options for the SharedToggleButton.
// Board is a first-class mode with a real active state (fixes #56).
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
  {
    value: 'kanban',
    label: 'Board',
    icon: SquareKanban,
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
        transition={{ duration: 0.25, ease: EASE_OUT }}
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
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="relative overflow-hidden"
              role="search"
              aria-label="Task search"
            >
              <Input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search tasks..."
                className="h-7 pl-3 pr-8 text-xs md:text-xs"
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
  boardListName,
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
  const todayTitle = useMemo(
    () => format(toLocal(today), 'MMMM d, yyyy'),
    [today]
  );

  return (
    <div
      className={cn(
        'grid items-center gap-4 grid-cols-[1fr_auto_1fr]',
        // Mobile: title + actions on row one, view switcher on row two
        // (the three sections do not fit side by side under 768px)
        "max-md:gap-2 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:[grid-template-areas:'left_right'_'center_center']",
        className
      )}
    >
      {/* Left Section - Sidebar Trigger + Today title (board mode swaps in
          a back chevron labeled with the list name, fixes #56) */}
      <div className="flex items-center gap-3 justify-self-start min-w-0 max-md:[grid-area:left]">
        <SmoothSidebarTrigger position="rightPane" />
        {taskViewMode === 'kanban' ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-1.5 -ml-1.5 min-w-0"
            onClick={() => setTaskViewMode('folder')}
            aria-label={`Back to lists from ${boardListName ?? 'board'}`}
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-base font-semibold text-foreground truncate">
              {boardListName ?? 'Tasks'}
            </span>
          </Button>
        ) : (
          <h2 className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="font-serif text-lg font-normal leading-none text-foreground">
              {todayTitle.split(' ')[0]}
            </span>
            {todayTitle.includes(' ') && (
              <span className="text-[13px] leading-none text-muted-foreground">
                {todayTitle.split(' ').slice(1).join(' ')}
              </span>
            )}
          </h2>
        )}
      </div>

      {/* Center Section - View Mode Toggle */}
      <div className="justify-self-center max-md:[grid-area:center]">
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
      <div className="flex items-center gap-1 justify-self-end max-md:[grid-area:right]">
        {/* Grouped Action Buttons */}
        <div className="flex items-center gap-1 bg-surface-2 rounded-btn p-1">
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
                            size="sm"
                            className="ml-auto tabular-nums"
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
                          // On state - aqua film + rim (same as Autotag,
                          // design-brief 2.3; the today-green is retired)
                          'bg-aqua-film-08 text-foreground border border-aqua-rim',
                          'hover:bg-aqua-film-08 hover:border-aqua',
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
                className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] font-medium tabular-nums"
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

          {/* Add Task Button — plain primary, no bespoke hover language
              (§1.4/§3.3: no growing shadow, no third hover-scale idiom).
              Rest/hover/press all come from Button's own default variant. */}
          {onToggleAddTaskInput && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={onToggleAddTaskInput}
                  size="sm"
                  className="h-7 w-7 p-0"
                  aria-label="Add task"
                >
                  {isAddTaskInputVisible ? (
                    <ArrowDownToDot className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
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
