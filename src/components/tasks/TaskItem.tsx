/**
 * TaskItem - Professional design matching screenshot
 */

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Clock, Calendar, MoreVertical, Info, MapPin, User, Tag, Flag, X } from 'lucide-react';
import { Draggable } from '@fullcalendar/interaction';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Task } from '@/types';

export interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onSchedule?: (id: string) => void;
  onRemoveTag?: (taskId: string, tagId: string) => void;
  groupColor?: string;
  className?: string;
}

// Helper function to get the appropriate icon for each tag type
const getTagIcon = (type: string) => {
  switch (type) {
    case 'date':
    case 'time':
      return Calendar;
    case 'priority':
      return Flag;
    case 'location':
      return MapPin;
    case 'person':
      return User;
    case 'label':
    case 'project':
    default:
      return Tag;
  }
};

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggle,
  onEdit,
  onDelete,
  onSchedule,
  onRemoveTag,
  groupColor,
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleToggle = () => {
    onToggle(task.id);
  };

  const handleDelete = () => {
    onDelete(task.id);
  };

  const handleEditStart = () => {
    setIsEditing(true);
    setEditTitle(task.title);
  };

  const handleEditSave = () => {
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle && trimmedTitle !== task.title) {
      onEdit(task.id, trimmedTitle);
    }
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setEditTitle(task.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Pure FullCalendar drag setup - no conflicts
  const dragElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dragElementRef.current && !task.completed && !isEditing) {
      const element = dragElementRef.current;
      const dragColor = groupColor || '#3788d8';
      
      const draggable = new Draggable(element, {
        eventData: {
          title: task.title,
          duration: '01:00',
          backgroundColor: dragColor,
          borderColor: dragColor,
          textColor: '#ffffff',
          extendedProps: {
            taskId: task.id,
            isFromTask: true,
            originalTask: task
          }
        }
      });

      return () => {
        draggable.destroy();
      };
    }
  }, [task.id, task.completed, isEditing]);

  return (
    <div 
      ref={dragElementRef}
      className={cn(
        "group/task flex items-center gap-3 py-2 px-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md",
        !task.completed && !isEditing && "cursor-grab",
        className
      )}
      style={{
        transition: 'none !important',
        transform: 'none !important',
        animation: 'none !important'
      }}
    >
        <Checkbox
          checked={task.completed}
          onCheckedChange={handleToggle}
          aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
          className="flex-shrink-0"
          customColor={task.completed ? groupColor : undefined}
        />

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleKeyDown}
              className={cn(
                'w-full bg-transparent border border-transparent outline-none text-foreground',
                'text-sm font-medium focus:border-primary/30 rounded px-1 py-0.5',
                'h-[1.25rem] leading-5 box-border flex items-center'
              )}
              aria-label="Edit task title"
            />
          ) : (
            <div
              onClick={handleEditStart}
              className={cn(
                'cursor-text text-sm font-medium transition-colors duration-200 truncate',
                'px-1 py-0.5 h-[1.25rem] leading-5 rounded box-border flex items-center',
                task.completed && 'line-through text-muted-foreground opacity-60'
              )}
              title={task.title}
            >
              {task.title}
            </div>
          )}
          
          <div className="mt-1 flex flex-wrap gap-1">
            {/* Show scheduled date badge only if no smart date/time tags exist */}
            {task.scheduledDate && !task.tags?.some(tag => tag.type === 'date' || tag.type === 'time') && (
              <Badge 
                variant="outline" 
                className="text-xs h-5 px-2 gap-1 text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors"
              >
                <Calendar className="w-3 h-3" />
                {task.scheduledDate.toLocaleDateString()}
              </Badge>
            )}
            
            {/* Show smart tags */}
            {task.tags?.map((tag) => {
              const IconComponent = getTagIcon(tag.type);
              return (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className={cn(
                    "text-xs h-5 px-2 gap-1 text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50 transition-all duration-100 ease-out group/tag",
                    onRemoveTag && "cursor-pointer",
                    tag.color && `border-[${tag.color}]/30 text-[${tag.color}]`
                  )}
                  style={tag.color ? { 
                    borderColor: `${tag.color}30`, 
                    color: tag.color 
                  } : undefined}
                  onClick={onRemoveTag ? (e) => {
                    e.stopPropagation();
                    onRemoveTag(task.id, tag.id);
                  } : undefined}
                >
                  {/* Icon that becomes X on hover - same size, no layout shift */}
                  <div className="w-3 h-3 relative">
                    <IconComponent 
                      className="w-3 h-3 absolute inset-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-0" 
                      style={{ color: tag.color }}
                    />
                    {onRemoveTag && (
                      <X 
                        className="w-3 h-3 absolute inset-0 opacity-0 transition-opacity duration-150 ease-out group-hover/tag:opacity-100" 
                        style={{ color: tag.color }}
                      />
                    )}
                  </div>
                  {tag.displayText}
                </Badge>
              );
            })}
            
            {/* Show creation date badge only if no scheduled date and no smart tags */}
            {!task.scheduledDate && (!task.tags || task.tags.length === 0) && (
              <Badge 
                variant="outline" 
                className="text-xs h-5 px-2 gap-1"
              >
                <Clock className="w-3 h-3" />
                {task.createdAt.toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center opacity-0 group-hover/task:opacity-100 transition-opacity duration-200 relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Task options for "${task.title}"`}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="w-48">
              {onSchedule && !task.completed && (
                <DropdownMenuItem onClick={() => onSchedule(task.id)} className="debug-dropdown-item">
                  <Clock className="mr-2 h-4 w-4 dropdown-gradient-icon debug-icon" />
                  <span className="dropdown-gradient-text debug-text">Schedule</span>
                  <DropdownMenuShortcut>
                    <Tooltip>
                      <TooltipTrigger 
                        asChild
                        onMouseEnter={(e) => {
                          // Stop event propagation to prevent dropdown interference
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
                </DropdownMenuItem>
              )}
              {onSchedule && !task.completed && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
    </div>
  );
};

export default TaskItem;