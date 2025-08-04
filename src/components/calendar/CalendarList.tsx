import React, { useState } from 'react';
import { Plus, ChevronUp, MoreVertical, Calendar, Settings, Edit, Trash2 } from 'lucide-react';
import './calendar.css';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorPicker } from '@/components/ui/color-picker';
import { CreateCalendarDialog } from '@/components/dialogs/CreateCalendarDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface Calendar {
  name: string;
  color: string;
  visible: boolean;
  isDefault?: boolean;
  description?: string;
}

export interface CalendarListProps {
  calendars: Calendar[];
  onToggleCalendar: (name: string) => void;
  onAddCalendar: (name: string, color: string) => void;
  onEditCalendar: (currentName: string, newName: string, color: string) => void;
  onDeleteCalendar?: (name: string) => void;
}

const CALENDAR_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export const CalendarList: React.FC<CalendarListProps> = ({
  calendars,
  onToggleCalendar,
  onAddCalendar,
  onEditCalendar,
  onDeleteCalendar
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isAddingCalendar, setIsAddingCalendar] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [selectedColor, setSelectedColor] = useState(CALENDAR_COLORS[0]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleAddCalendar = () => {
    const trimmedName = newCalendarName.trim();
    if (trimmedName) {
      onAddCalendar(trimmedName, selectedColor);
      setNewCalendarName('');
      setSelectedColor(CALENDAR_COLORS[0]);
      setIsAddingCalendar(false);
    }
  };

  const handleCancelAdd = () => {
    setNewCalendarName('');
    setSelectedColor(CALENDAR_COLORS[0]);
    setIsAddingCalendar(false);
  };

  const handleCreateCalendar = (data: {
    name: string;
    description: string;
    iconId: string;
    color: string;
  }) => {
    onAddCalendar(data.name, data.color);
    setShowCreateDialog(false);
  };

  const handleRecentColorAdd = (color: string) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c !== color);
      return [color, ...filtered].slice(0, 5);
    });
  };

  return (
    <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <div className="space-y-3">
        {/* Calendars Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sidebar-foreground" />
            <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
              Calendars
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCreateDialog(true)}
              className="h-6 w-6"
              aria-label="Add calendar"
            >
              <Plus className="w-3 h-3" />
            </Button>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-5 w-5 p-0"
              >
                <div className={`transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
                  <ChevronUp className="w-3 h-3" />
                </div>
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Calendars List */}
        <CollapsibleContent className="space-y-1 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
          {calendars.map((calendar, index) => (
            <div
              key={calendar.name}
              className="calendar-item"
              style={{ '--animation-delay': `${index * 50}ms` } as React.CSSProperties}
            >
              <CalendarItem
                calendar={calendar}
                onToggle={() => onToggleCalendar(calendar.name)}
                onEdit={(name, color) => onEditCalendar(calendar.name, name, color)}
                onDelete={onDeleteCalendar ? () => onDeleteCalendar(calendar.name) : undefined}
                recentColors={recentColors}
                onRecentColorAdd={handleRecentColorAdd}
              />
            </div>
          ))}

          {/* Add Calendar Form */}
          {isAddingCalendar && (
            <div className="p-3 border rounded-md space-y-3 calendar-item" style={{ '--animation-delay': `${calendars.length * 50}ms` } as React.CSSProperties}>
              <Input
                type="text"
                placeholder="Calendar name"
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCalendar();
                  if (e.key === 'Escape') handleCancelAdd();
                }}
                autoFocus
                className="text-sm"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                <div className="flex gap-1">
                  {CALENDAR_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        'w-5 h-5 rounded-full border-2 transition-all',
                        selectedColor === color
                          ? 'border-foreground scale-110'
                          : 'border-transparent hover:border-border'
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddCalendar}
                  disabled={!newCalendarName.trim()}
                  className="flex-1"
                >
                  Add Calendar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelAdd}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {calendars.length === 0 && !isAddingCalendar && (
            <div className="text-center py-3 text-muted-foreground calendar-item" style={{ '--animation-delay': '0ms' } as React.CSSProperties}>
              <p className="text-xs">No calendars yet</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingCalendar(true)}
                className="mt-1 text-xs h-7"
              >
                Create your first calendar
              </Button>
            </div>
          )}
        </CollapsibleContent>

        {/* Create Calendar Dialog */}
        <CreateCalendarDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateCalendar={handleCreateCalendar}
        />
      </div>
    </Collapsible>
  );
};

interface CalendarItemProps {
  calendar: Calendar;
  onToggle: () => void;
  onEdit: (name: string, color: string) => void;
  onDelete?: () => void;
  recentColors?: string[];
  onRecentColorAdd?: (color: string) => void;
}

const CalendarItem: React.FC<CalendarItemProps> = ({
  calendar,
  onToggle,
  onEdit,
  onDelete,
  recentColors = [],
  onRecentColorAdd
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(calendar.name);
  const [editColor, setEditColor] = useState(calendar.color);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSaveEdit = () => {
    const trimmedName = editName.trim();
    if (trimmedName && (trimmedName !== calendar.name || editColor !== calendar.color)) {
      onEdit(trimmedName, editColor);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(calendar.name);
    setEditColor(calendar.color);
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete?.();
    setShowDeleteDialog(false);
  };

  if (isEditing) {
    return (
      <div className="p-3 border rounded-md space-y-3">
        <Input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveEdit();
            if (e.key === 'Escape') handleCancelEdit();
          }}
          autoFocus
          className="text-sm"
        />

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Color:</span>
          <div className="flex gap-1">
            {CALENDAR_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setEditColor(color)}
                className={cn(
                  'w-4 h-4 rounded-full border transition-all',
                  editColor === color
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:border-border'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSaveEdit} className="flex-1">
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancelEdit}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="group/calendar flex items-center gap-3 py-2 px-3 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md transition-colors">
        <Checkbox
          checked={calendar.visible}
          onCheckedChange={onToggle}
          className={cn(
            'data-[state=checked]:bg-current data-[state=checked]:border-current',
            'border-2 rounded-sm flex-shrink-0'
          )}
          style={{
            borderColor: calendar.color,
            '--tw-border-opacity': '1',
            color: calendar.color
          } as React.CSSProperties}
          aria-label={`Toggle ${calendar.name} visibility`}
        />

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          <div className="text-sm font-medium truncate">
            {calendar.name}
            {calendar.isDefault && (
              <span className="ml-1 text-xs text-muted-foreground">(default)</span>
            )}
          </div>
        </div>

        <div className="flex items-center opacity-0 group-hover/calendar:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-auto"
              >
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div
                  className="mr-2 h-4 w-4 rounded-full flex-shrink-0 border-2 border-border"
                  style={{ backgroundColor: calendar.color }}
                />
                <span>Color</span>
                <DropdownMenuShortcut className="flex gap-1 ml-auto">
                  {CALENDAR_COLORS.slice(0, 4).map(color => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(calendar.name, color);
                        onRecentColorAdd?.(color);
                      }}
                      className="w-3 h-3 rounded-full border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <ColorPicker
                    value={calendar.color}
                    onChange={(color) => {
                      onEdit(calendar.name, color);
                      onRecentColorAdd?.(color);
                    }}
                    recentColors={recentColors}
                    onRecentColorAdd={onRecentColorAdd}
                    className="w-3 h-3 border-0"
                  />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              {onDelete && !calendar.isDefault && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10"
                  >
                    <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calendar</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{calendar.name}"? All events in this calendar will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CalendarList;