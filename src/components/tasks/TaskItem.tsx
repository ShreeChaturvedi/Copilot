/**
 * TaskItem - Professional design matching screenshot
 */

import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Clock, Calendar, MoreVertical, Info, MapPin, User, Tag, Flag, X, Bell, BellRing, File as FileIcon, Image as ImageIcon, Music as MusicIcon, Video as VideoIcon } from 'lucide-react';
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
import { Task } from "@shared/types";
import { useCalendars } from '@/hooks/useCalendars';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
// import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useTasks } from '@/hooks/useTasks';
import { format } from 'date-fns';
import { DateTimeInput } from '@/components/ui/datetime-input';

export interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onSchedule?: (id: string) => void;
  onRemoveTag?: (taskId: string, tagId: string) => void;
  groupColor?: string;
  className?: string;
  calendarMode?: boolean; // Hide tags when in calendar view
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
  calendarMode = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  // Calendars must be read via hook at top-level (Rules of Hooks)
  const { data: calendars = [] } = useCalendars();
  const { updateTask } = useTasks();

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
      // Prefer current default calendar color; fall back to group color and a safe default
      const defaultCal = calendars.find((c) => (c as { isDefault?: boolean }).isDefault) || calendars[0];
      const defaultCalendarColor = defaultCal?.color;
      const dragColor = defaultCalendarColor || groupColor || '#3788d8';
      
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
  }, [task.id, task.completed, task.title, isEditing, groupColor, task]);

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
              id={`task-edit-${task.id}`}
              name={`task-edit-${task.id}`}
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
                'cursor-text text-sm font-medium transition-colors duration-200',
                'px-1 py-0.5 h-[1.25rem] leading-5 rounded box-border',
                'truncate overflow-hidden text-ellipsis whitespace-nowrap', // Proper text truncation
                task.completed && 'line-through text-muted-foreground opacity-60'
              )}
              title={task.title}
            >
              {task.title}
            </div>
          )}
          
          {/* Tags - Hidden in calendar mode */}
          {!calendarMode && (
            <div className="mt-1 flex flex-wrap gap-1">
              {/* Canonical Due Date tag - only render when set */}
              {task.scheduledDate && (
                <DueDateBadge
                  taskId={task.id}
                  date={task.scheduledDate}
                  onChange={(newDate) => updateTask.mutate({ id: task.id, updates: { scheduledDate: newDate } })}
                />
              )}

              {/* Show non-date/time smart tags */}
              {task.tags?.filter(tag => tag.type !== 'date' && tag.type !== 'time').map((tag) => {
                const IconComponent = getTagIcon(tag.type);
                return (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className={cn(
                      "text-xs px-2 py-1 gap-1 text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50 transition-all duration-100 ease-out group/tag",
                      onRemoveTag && "cursor-pointer",
                      tag.color && `border-[${tag.color}]/30 text-[${tag.color}]`
                    )}
                    style={tag.color ? { 
                      borderColor: `${tag.color}30`, 
                      color: tag.color,
                      backgroundColor: `${tag.color}1A`
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
              
              {/* Attachments preview (compact) */}
              {task.attachments && task.attachments.length > 0 && (
                <div className="flex items-center gap-1 ml-1">
                  {task.attachments.slice(0, 3).map((att) => {
                    const isImage = att.type?.startsWith('image/');
                    const isAudio = att.type?.startsWith('audio/');
                    const isVideo = att.type?.startsWith('video/');
                    const Icon = isImage ? ImageIcon : isAudio ? MusicIcon : isVideo ? VideoIcon : FileIcon;
                    return (
                      <Popover key={att.id}>
                        <PopoverTrigger asChild>
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-1 gap-1 text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50"
                            asChild
                          >
                            <a href={att.url} target="_blank" rel="noreferrer" title={att.name} onClick={(e)=>e.stopPropagation()}>
                              <Icon className="w-3 h-3" />
                              <span className="max-w-[120px] truncate inline-block align-middle">{att.name}</span>
                            </a>
                          </Badge>
                        </PopoverTrigger>
                        {isImage && (
                          <PopoverContent className="p-2 w-auto" align="start" sideOffset={8}>
                            <img
                              src={att.url}
                              alt={att.name}
                              className="max-w-[240px] max-h-[180px] rounded-md border"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </PopoverContent>
                        )}
                      </Popover>
                    );
                  })}
                  {task.attachments.length > 3 && (
                    <Badge variant="outline" className="text-xs px-2 py-1">+{task.attachments.length - 3}</Badge>
                  )}
                </div>
              )}

              {/* Intentionally remove the legacy auto-created creation date badge */}
            </div>
          )}
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

// Local, focused editor for the canonical due date tag to avoid code duplication across files
function DueDateBadge({
  taskId,
  date,
  onChange,
}: {
  taskId: string;
  date?: Date;
  onChange: (date: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(date);
  const [includeTime, setIncludeTime] = useState<boolean>(() => {
    if (!date) return false;
    return !(date.getHours() === 0 && date.getMinutes() === 0);
  });
  const [timeValue, setTimeValue] = useState<string>(() => {
    if (!date) return '12:00';
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });
  const [remind, setRemind] = useState<string>('none');

  useEffect(() => {
    setSelectedDate(date);
    setIncludeTime(date ? !(date.getHours() === 0 && date.getMinutes() === 0) : false);
    setTimeValue(date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '12:00');
  }, [date]);

  const formatDisplay = (d?: Date) => {
    if (!d) return 'Add due date';
    const base = format(d, 'MM/dd/yyyy');
    if (includeTime) {
      return `${base} @ ${format(d, 'h:mm a')}`;
    }
    return base;
  };

  const apply = (next?: Date) => {
    onChange(next);
    setOpen(false);
  };

  const handleCalendarSelect = (d?: Date) => {
    if (!d) return;
    const withTime = new Date(d);
    if (includeTime) {
      const [hh, mm] = timeValue.split(':').map((n) => parseInt(n || '0', 10));
      withTime.setHours(hh || 0, mm || 0, 0, 0);
    } else {
      withTime.setHours(0, 0, 0, 0);
    }
    setSelectedDate(withTime);
  };

  const handleTimeChange = (value: string) => {
    setTimeValue(value);
    if (selectedDate) {
      const [hh, mm] = value.split(':').map((n) => parseInt(n || '0', 10));
      const next = new Date(selectedDate);
      next.setHours(hh || 0, mm || 0, 0, 0);
      setSelectedDate(next);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "text-xs px-2 py-1 gap-1 transition-colors cursor-pointer",
            (() => {
              const hasReminder = remind !== 'none';
              const overdue = hasReminder && selectedDate ? selectedDate.getTime() < Date.now() : false;
              if (hasReminder && overdue) return "text-[#ef4444] border-[#ef4444] hover:border-[#ef4444]";
              if (hasReminder) return "text-[#3b82f6] border-[#3b82f6] hover:border-[#3b82f6]";
              return "text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50";
            })()
          )}
          style={(() => {
            const hasReminder = remind !== 'none';
            if (!hasReminder) return undefined;
            const overdue = selectedDate ? selectedDate.getTime() < Date.now() : false;
            const hex = overdue ? '#ef4444' : '#3b82f6';
            return { backgroundColor: `${hex}1A`, borderColor: hex, color: hex } as React.CSSProperties;
          })()}
          aria-label="Edit due date"
        >
          {(() => {
            const hasReminder = remind !== 'none';
            const overdue = hasReminder && selectedDate ? selectedDate.getTime() < Date.now() : false;
            if (hasReminder && overdue) return <BellRing className="w-3 h-3" />;
            if (hasReminder) return <Bell className="w-3 h-3" />;
            return <Calendar className="w-3 h-3" />;
          })()}
          {formatDisplay(selectedDate)}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="p-3 w-auto" align="start">
        <div className="space-y-3">
          {/* Top display with optional time field */}
          <div className="flex items-center gap-2">
            <div className="flex-1 text-sm font-medium">
              {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select a date'}
            </div>
            {includeTime && (
              <div className="flex items-center gap-2">
                <DateTimeInput
                  value={selectedDate ?? undefined}
                  onChange={(d) => {
                    if (d) {
                      const hh = d.getHours().toString().padStart(2, '0');
                      const mm = d.getMinutes().toString().padStart(2, '0');
                      handleTimeChange(`${hh}:${mm}`);
                    }
                  }}
                  className="w-[180px]"
                />
              </div>
            )}
          </div>

          <CalendarPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            captionLayout="dropdown"
            className="[--cell-size:--spacing(7)]"
            initialFocus
          />

          {/* Include time switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor={`include-time-${taskId}`} className="text-sm">Include time</Label>
            <Switch
              id={`include-time-${taskId}`}
              checked={includeTime}
              onCheckedChange={(checked) => {
                setIncludeTime(!!checked);
                if (selectedDate) {
                  const next = new Date(selectedDate);
                  if (!checked) {
                    next.setHours(0, 0, 0, 0);
                  }
                  setSelectedDate(next);
                }
              }}
            />
          </div>

          {/* Remind dropdown - UI only */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Remind</Label>
            <Select value={remind} onValueChange={setRemind}>
              <SelectTrigger size="sm" className="min-w-[150px]">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="at-time">At time of due date</SelectItem>
                <SelectItem value="5m">5 minutes before</SelectItem>
                <SelectItem value="15m">15 minutes before</SelectItem>
                <SelectItem value="30m">30 minutes before</SelectItem>
                <SelectItem value="1h">1 hour before</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedDate(undefined);
                apply(undefined);
              }}
            >
              Clear
            </Button>
            <Button size="sm" onClick={() => apply(selectedDate)}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}