import React from 'react';
import { Clock, Trash2, Info } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface TaskActionMenuItemsProps {
  taskId: string;
  taskCompleted: boolean;
  onSchedule?: (id: string) => void;
  onDelete: (id: string) => void;
  showScheduleTooltip?: boolean;
}

export const TaskActionMenuItems: React.FC<TaskActionMenuItemsProps> = ({
  taskId,
  taskCompleted,
  onSchedule,
  onDelete,
  showScheduleTooltip = true,
}) => {
  return (
    <>
      {onSchedule && !taskCompleted && (
        <DropdownMenuItem onClick={() => onSchedule(taskId)}>
          <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
          <span>Schedule</span>
          {showScheduleTooltip && (
            <DropdownMenuShortcut>
              <Tooltip>
                <TooltipTrigger
                  asChild
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div className="relative">
                    <Info
                      className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-help"
                      aria-label="AutoScheduling information"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={8}
                  collisionPadding={16}
                  className="w-48 leading-normal"
                >
                  <span className="inline">
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 mr-1 border-hairline-strong text-ink-muted font-semibold tracking-wide inline-flex items-center align-text-bottom"
                    >
                      AI
                    </Badge>
                    Schedule this task using extensive knowledge of your
                    schedule and deep context understanding.
                  </span>
                </TooltipContent>
              </Tooltip>
            </DropdownMenuShortcut>
          )}
        </DropdownMenuItem>
      )}
      {onSchedule && !taskCompleted && <DropdownMenuSeparator />}
      <DropdownMenuItem
        onClick={() => onDelete(taskId)}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
      >
        <Trash2 className="mr-2 h-4 w-4 text-destructive" />
        <span>Delete</span>
      </DropdownMenuItem>
    </>
  );
};
