import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Flag, PlayCircle, Circle } from 'lucide-react';
import type { Task } from '@shared/types';

export type SimpleStatus = 'not_started' | 'in_progress' | 'done';

export interface StatusBadgeProps {
  task: Task;
  onChange: (status: SimpleStatus) => void;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ task, onChange, className }) => {
  const status = ((task as any).status as SimpleStatus | undefined) || (task.completed ? 'done' : 'not_started');
  const label = status === 'in_progress' ? 'In Progress' : status === 'done' ? 'Done' : 'Not Started';
  const Icon = status === 'in_progress' ? PlayCircle : status === 'done' ? Flag : Circle;
  const colorClass = status === 'in_progress' ? 'text-amber-500' : status === 'done' ? 'text-emerald-600' : 'text-muted-foreground';

  const Item: React.FC<{ value: SimpleStatus; icon: React.ComponentType<any>; text: string }>
    = ({ value, icon: ItemIcon, text }) => (
    <button
      className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex items-center gap-2"
      onClick={(e) => { e.stopPropagation(); onChange(value); }}
      type="button"
    >
      <ItemIcon className="w-3 h-3" /> {text}
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-border/60 hover:bg-muted transition-colors whitespace-nowrap', colorClass, className)}
          aria-label="Change status"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon className="w-3 h-3" />
          <span className="hidden sm:inline leading-none">{label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-44">
        <Item value="not_started" icon={Circle} text="Not Started" />
        <Item value="in_progress" icon={PlayCircle} text="In Progress" />
        <Item value="done" icon={Flag} text="Done" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StatusBadge;

