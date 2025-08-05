/**
 * TaskGroupCombobox - Shadcn Combobox for task group selection
 *
 * Replaces the dropdown menu with a proper shadcn Combobox component
 * while maintaining the same visual appearance with colored icons and titles.
 */

import React, { useState } from 'react';
import { Plus, ChevronsUpDown, Check } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TaskGroup } from '../../tasks/TaskInput';

export interface TaskGroupComboboxProps {
  /** Available task groups */
  taskGroups: TaskGroup[];
  /** Currently active task group ID */
  activeTaskGroupId?: string;
  /** Handler for task group selection */
  onSelectTaskGroup?: (groupId: string) => void;
  /** Handler for creating new task group */
  onCreateTaskGroup?: () => void;
  /** Whether the combobox is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Task group combobox component using shadcn Combobox
 *
 * Features:
 * - Uses shadcn Command/Popover for better UX
 * - Maintains visual appearance with colored icons and titles
 * - Supports searching through task groups
 * - Includes "New List" option
 * - Proper keyboard navigation and accessibility
 */
export const TaskGroupCombobox: React.FC<TaskGroupComboboxProps> = ({
  taskGroups,
  activeTaskGroupId,
  onSelectTaskGroup,
  onCreateTaskGroup,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);

  // Default task group if none exist
  const defaultTaskGroup: TaskGroup = {
    id: 'default',
    name: 'Tasks',
    iconId: 'CheckSquare',
    color: '#3b82f6',
    description: 'Default task group',
  };

  // Get current active task group
  const activeTaskGroup =
    taskGroups.find((group) => group.id === activeTaskGroupId) ||
    (taskGroups.length > 0 ? taskGroups[0] : defaultTaskGroup);

  // Get the icon component for the active task group
  const ActiveGroupIcon =
    (LucideIcons[
      activeTaskGroup.iconId as keyof typeof LucideIcons
    ] as React.ComponentType<{ className?: string; size?: number }>) ||
    LucideIcons.CheckSquare;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          size="sm"
          disabled={disabled}
          className={cn(
            'h-8 px-2 text-muted-foreground hover:text-foreground justify-start gap-2',
            className
          )}
        >
          <ActiveGroupIcon
            className="w-4 h-4"
            style={{ color: activeTaskGroup.color }}
          />
          <span className="text-sm font-medium">{activeTaskGroup.name}</span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search task groups..." />
          <CommandList>
            <CommandEmpty>No task groups found.</CommandEmpty>
            <CommandGroup>
              {taskGroups.map((group) => {
                const GroupIcon =
                  (LucideIcons[
                    group.iconId as keyof typeof LucideIcons
                  ] as React.ComponentType<{
                    className?: string;
                    size?: number;
                  }>) || LucideIcons.CheckSquare;
                return (
                  <CommandItem
                    key={group.id}
                    value={group.id}
                    onSelect={(currentValue) => {
                      if (
                        currentValue !== activeTaskGroup.id &&
                        onSelectTaskGroup
                      ) {
                        onSelectTaskGroup(currentValue);
                      }
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <GroupIcon
                        className="w-4 h-4"
                        style={{ color: group.color }}
                      />
                      <span>{group.name}</span>
                    </div>
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        activeTaskGroup.id === group.id
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {onCreateTaskGroup && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onCreateTaskGroup();
                      setOpen(false);
                    }}
                    className="text-success hover:text-success hover:bg-success/10"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Plus className="w-4 h-4 text-success" />
                      <span>New List</span>
                    </div>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default TaskGroupCombobox;
