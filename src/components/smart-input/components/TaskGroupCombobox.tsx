/**
 * TaskGroupCombobox - Shadcn Combobox for task group selection
 *
 * Replaces the dropdown menu with a proper shadcn Combobox component
 * while maintaining the same visual appearance with colored icons and titles.
 */

import React, { useState } from 'react';
import { Plus, ChevronsUpDown, Check, List, Folder } from 'lucide-react';
import { getIconByName } from '@/components/ui/icons';
// Emoji-based task group display
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
import { DEFAULT_PRESET_COLOR } from '@/constants/colors';
type TaskGroup = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
};

export function GroupGlyph({
  iconId,
  color,
}: {
  iconId: string;
  color?: string;
}) {
  const Icon = getIconByName(iconId, Folder);
  return (
    <span className="inline-flex" style={{ color }} aria-hidden="true">
      <Icon className="h-4 w-4" />
    </span>
  );
}

interface TaskGroupComboboxProps {
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
    emoji: '📋',
    color: DEFAULT_PRESET_COLOR,
    description: 'Default task group',
  };

  // Whether "All Tasks" is the current selection
  const isAllSelected = activeTaskGroupId === 'all';

  // Get current active task group for non-all selection
  // IMPORTANT: Do NOT fall back to the first group when 'all' is selected,
  // otherwise both "All Tasks" and the first group will appear selected.
  const activeTaskGroup = isAllSelected
    ? null
    : taskGroups.find((group) => group.id === activeTaskGroupId) ||
      (taskGroups.length > 0 ? taskGroups[0] : defaultTaskGroup);

  // Group glyphs render via the shared lucide registry (emoji ids fall back
  // to Folder), matching the folder grid and smart input.

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
          {isAllSelected ? (
            <>
              <div className="text-muted-foreground">
                <List className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">All Tasks</span>
            </>
          ) : (
            <>
              <GroupGlyph
                iconId={activeTaskGroup?.emoji ?? 'folder'}
                color={activeTaskGroup?.color}
              />
              <span className="text-sm font-medium">
                {activeTaskGroup?.name}
              </span>
            </>
          )}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search task groups..." />
          <CommandList>
            <CommandEmpty>No task groups found.</CommandEmpty>
            {/* All Tasks Option */}
            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  if (!isAllSelected) {
                    onSelectTaskGroup?.('all');
                  }
                  setOpen(false);
                }}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className="text-muted-foreground">
                    <List className="w-4 h-4" />
                  </div>
                  <span>All Tasks</span>
                </div>
                <Check
                  className={cn(
                    'ml-auto h-4 w-4',
                    isAllSelected ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {taskGroups.map((group) => (
                <CommandItem
                  key={group.id}
                  value={group.id}
                  onSelect={(currentValue) => {
                    if (
                      currentValue !== activeTaskGroupId &&
                      onSelectTaskGroup
                    ) {
                      onSelectTaskGroup(currentValue);
                    }
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <GroupGlyph iconId={group.emoji} color={group.color} />
                    <span>{group.name}</span>
                  </div>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      !isAllSelected && activeTaskGroupId === group.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
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
                      <span>New list</span>
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
