import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Flag, PlayCircle, Circle } from 'lucide-react';
import type { Task } from '@shared/types';

export type SimpleStatus = 'not_started' | 'in_progress' | 'done';

export interface StatusBadgeProps {
  task: Task;
  onChange: (status: SimpleStatus) => void;
  className?: string;
  /** When true, render icon-only to match checkbox footprint in list view */
  iconOnly?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  task,
  onChange,
  className,
  iconOnly,
}) => {
  const status: SimpleStatus =
    task.status ?? (task.completed ? 'done' : 'not_started');
  const label =
    status === 'in_progress'
      ? 'In Progress'
      : status === 'done'
        ? 'Done'
        : 'Not Started';
  const Icon =
    status === 'in_progress' ? PlayCircle : status === 'done' ? Flag : Circle;
  const colorClass =
    status === 'in_progress'
      ? 'text-amber-500'
      : status === 'done'
        ? 'text-emerald-600'
        : 'text-muted-foreground';

  // Consistent sizing:
  // - iconOnly: 20x20 container, 2px inner padding to give breathing room around a 14px icon
  // - full: md chip spacing with text-xs, aligning with shadcn Badge md size
  const triggerBase = iconOnly
    ? 'inline-flex items-center justify-center h-5 w-5 p-0.5 rounded border border-border/60 hover:bg-muted transition-colors'
    : 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-border/60 hover:bg-muted transition-colors whitespace-nowrap';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(triggerBase, colorClass, className)}
          aria-label="Change status"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className={cn(iconOnly ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5')} />
          {!iconOnly && (
            <span className="hidden sm:inline leading-[1.1rem]">{label}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-44">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onChange('not_started');
          }}
          className={cn(
            'cursor-pointer',
            status === 'not_started' && 'bg-accent text-accent-foreground'
          )}
        >
          <Circle className="w-3 h-3" /> Not Started
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onChange('in_progress');
          }}
          className={cn(
            'cursor-pointer',
            status === 'in_progress' && 'bg-accent text-accent-foreground'
          )}
        >
          <PlayCircle className="w-3 h-3" /> In Progress
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onChange('done');
          }}
          className={cn(
            'cursor-pointer',
            status === 'done' && 'bg-accent text-accent-foreground'
          )}
        >
          <Flag className="w-3 h-3" /> Done
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StatusBadge;
