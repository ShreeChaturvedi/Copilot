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
      ? 'In progress'
      : status === 'done'
        ? 'Done'
        : 'Not started';
  const Icon =
    status === 'in_progress' ? PlayCircle : status === 'done' ? Flag : Circle;
  // Status tone re-based onto tokens (design-brief §2.3): quiet-chip film —
  // same-hue background tint instead of a neutral bordered box, matching
  // .ti-tag's chip species. in-progress = the sanctioned amber --warning,
  // done = --success (the aqua, sanctioned "live/done" use per §1.6 rule 3),
  // rest = neutral surface, nothing to signal. Hover deepens the same hue
  // rather than swapping to a neutral wash, so feedback stays legible
  // against the chip's own semantic color.
  const toneClass =
    status === 'in_progress'
      ? 'bg-warning/10 text-warning hover:bg-warning/16'
      : status === 'done'
        ? 'bg-success/10 text-success hover:bg-success/16'
        : 'bg-surface-2 text-muted-foreground hover:bg-surface-active';

  // Consistent sizing:
  // - iconOnly: 20x20 container (matches the checkbox/ring footprint), flex-centered
  // - full: md chip spacing with text-xs, aligning with shadcn Badge md size
  const triggerBase = iconOnly
    ? 'inline-flex items-center justify-center h-5 w-5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1'
    : 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(triggerBase, toneClass, className)}
          aria-label="Change status"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className={cn(iconOnly ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5')} />
          {/* Label stays visible at every width (#58: the chip used to render
              as an empty outline at 390px) */}
          {!iconOnly && <span className="leading-[1.1rem]">{label}</span>}
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
          <Circle className="w-3 h-3" /> Not started
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
          <PlayCircle className="w-3 h-3" /> In progress
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
