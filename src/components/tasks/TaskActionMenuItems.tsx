import React from 'react';
import { Clock, Trash2, Info } from 'lucide-react';
import { 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuShortcut 
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from '@/lib/utils';

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
        <DropdownMenuItem onClick={() => onSchedule(taskId)} className="debug-dropdown-item">
          <Clock className="mr-2 h-4 w-4 dropdown-gradient-icon debug-icon" />
          <span className="dropdown-gradient-text debug-text">Schedule</span>
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
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content
                    side="right"
                    sideOffset={8}
                    avoidCollisions={true}
                    collisionPadding={16}
                    className={cn(
                      "w-48 text-xs leading-normal z-[9999] rounded-md px-3 py-2",
                      "bg-info-popover text-info-popover-foreground border border-border",
                      "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
                      "data-[side=right]:slide-in-from-left-2"
                    )}
                  >
                    <span className="inline">
                      <Badge 
                        variant="outline" 
                        className="text-xs h-4 px-1.5 mr-1 debug-ai-badge text-white font-bold border-none inline-flex items-center align-text-bottom"
                      >
                        AI
                      </Badge>
                      Schedule this task using extensive knowledge of your schedule and deep context understanding.
                    </span>
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
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