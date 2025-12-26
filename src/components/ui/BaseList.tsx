import React, { useState, ReactNode } from 'react';
import {
  Plus,
  ChevronUp,
  MoreVertical,
  Settings,
  Edit,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/checkbox';
import { ColorPicker } from '@/components/ui/color-picker';
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

// Base item interface that both Calendar and TaskGroup must extend
export interface BaseListItem {
  id?: string;
  name: string;
  color: string;
  description?: string;
  isDefault?: boolean;
  emoji?: string;
}

// Mode-specific properties
export interface CheckboxModeItem extends BaseListItem {
  visible: boolean;
}

export interface SelectionModeItem extends BaseListItem {
  id: string; // Required for selection mode
}

const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export interface BaseListProps<T extends BaseListItem> {
  items: T[];
  title: string;
  titleIcon: ReactNode;
  mode: 'checkbox' | 'selection';
  activeItemId?: string; // Only used in selection mode

  // Actions
  onToggle?: (item: T) => void; // For checkbox mode (toggle visibility)
  onSelect?: (item: T) => void; // For selection mode (select active)
  onAdd: (name: string, color: string) => void;
  onEdit: (item: T, name: string, color: string) => void;
  onDelete?: (item: T) => void;
  onStartEdit?: (item: T) => void; // Optional: trigger parent-controlled dialog edit flow

  // Dialog support
  showCreateDialog?: boolean;
  onShowCreateDialog?: (show: boolean) => void;
  onCreateDialogSubmit?: (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => void;
  CreateDialogComponent?: React.ComponentType<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateCalendar?: (data: {
      name: string;
      description: string;
      emoji: string;
      color: string;
    }) => void;
    onCreateTask?: (data: {
      name: string;
      description: string;
      emoji: string;
      color: string;
    }) => void;
    initialName?: string;
    initialDescription?: string;
    initialIconId?: string;
    initialEmoji?: string;
    initialColor?: string;
    submitLabel?: string;
    titleLabel?: string;
  }>;

  // Styling
  addButtonLabel: string;
  emptyStateText: string;
  createFirstItemText: string;
  deleteDialogTitle: string;
  deleteDialogDescription: (itemName: string) => string;
  // Optional initial data for the create dialog (used when reusing dialog for edit)
  createDialogInitialData?: {
    name?: string;
    description?: string;
    iconId?: string;
    emoji?: string;
    color?: string;
    submitLabel?: string;
    titleLabel?: string;
  };
}

export function BaseList<T extends BaseListItem>({
  items,
  title,
  titleIcon,
  mode,
  activeItemId,
  onToggle,
  onSelect,
  onAdd,
  onEdit,
  onStartEdit,
  onDelete,
  showCreateDialog = false,
  onShowCreateDialog,
  onCreateDialogSubmit,
  CreateDialogComponent,
  addButtonLabel,
  emptyStateText,
  createFirstItemText,
  deleteDialogTitle,
  deleteDialogDescription,
  createDialogInitialData,
}: BaseListProps<T>) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLORS[0]);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleAddItem = () => {
    const trimmedName = newItemName.trim();
    if (trimmedName) {
      onAdd(trimmedName, selectedColor);
      setNewItemName('');
      setSelectedColor(DEFAULT_COLORS[0]);
      setIsAddingItem(false);
    }
  };

  const handleCancelAdd = () => {
    setNewItemName('');
    setSelectedColor(DEFAULT_COLORS[0]);
    setIsAddingItem(false);
  };

  const handleCreateFromDialog = (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => {
    onCreateDialogSubmit?.(data);
    onShowCreateDialog?.(false);
  };

  const handleRecentColorAdd = (color: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== color);
      return [color, ...filtered].slice(0, 5);
    });
  };

  return (
    <Collapsible
      open={!isCollapsed}
      onOpenChange={(open) => setIsCollapsed(!open)}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {titleIcon}
            <div className="text-sm font-semibold text-sidebar-foreground cursor-help select-none">
              {title}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onShowCreateDialog?.(true)}
              className="h-6 w-6"
              aria-label={`Add ${addButtonLabel.toLowerCase()}`}
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
                <div
                  className={`transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}
                >
                  <ChevronUp className="w-3 h-3" />
                </div>
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Items List */}
        <CollapsibleContent className="space-y-1 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
          {items.map((item, index) => (
            <div
              key={item.id || item.name}
              className="calendar-item"
              style={
                {
                  '--animation-delay': `${index * 50}ms`,
                } as React.CSSProperties
              }
            >
              <BaseListItem
                item={item}
                mode={mode}
                isActive={
                  mode === 'selection' ? activeItemId === item.id : false
                }
                onToggle={onToggle}
                onSelect={onSelect}
                onEdit={onEdit}
                onStartEdit={onStartEdit}
                onDelete={onDelete}
                recentColors={recentColors}
                onRecentColorAdd={handleRecentColorAdd}
                deleteDialogTitle={deleteDialogTitle}
                deleteDialogDescription={deleteDialogDescription}
              />
            </div>
          ))}

          {/* Inline Add Form */}
          {isAddingItem && (
            <div
              className="p-3 border rounded-md space-y-3 calendar-item"
              style={
                {
                  '--animation-delay': `${items.length * 50}ms`,
                } as React.CSSProperties
              }
            >
              <Input
                type="text"
                placeholder={`${addButtonLabel} name`}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddItem();
                  if (e.key === 'Escape') handleCancelAdd();
                }}
                autoFocus
                className="text-sm"
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                <div className="flex gap-1">
                  {DEFAULT_COLORS.map((color) => (
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
                  onClick={handleAddItem}
                  disabled={!newItemName.trim()}
                  className="flex-1"
                >
                  Add {addButtonLabel}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancelAdd}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {items.length === 0 && !isAddingItem && (
            <div
              className="text-center py-3 text-muted-foreground calendar-item"
              style={{ '--animation-delay': '0ms' } as React.CSSProperties}
            >
              <p className="text-xs">{emptyStateText}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingItem(true)}
                className="mt-1 text-xs h-7"
              >
                {createFirstItemText}
              </Button>
            </div>
          )}
        </CollapsibleContent>

        {/* Create Dialog */}
        {CreateDialogComponent && (
          <CreateDialogComponent
            open={showCreateDialog}
            onOpenChange={(open) => onShowCreateDialog?.(open)}
            onCreateCalendar={
              mode === 'checkbox' ? handleCreateFromDialog : undefined
            }
            onCreateTask={
              mode === 'selection' ? handleCreateFromDialog : undefined
            }
            initialName={createDialogInitialData?.name}
            initialDescription={createDialogInitialData?.description}
            initialIconId={createDialogInitialData?.iconId}
            initialEmoji={createDialogInitialData?.emoji}
            initialColor={createDialogInitialData?.color}
            submitLabel={createDialogInitialData?.submitLabel}
            titleLabel={createDialogInitialData?.titleLabel}
          />
        )}
      </div>
    </Collapsible>
  );
}

interface BaseListItemProps<T extends BaseListItem> {
  item: T;
  mode: 'checkbox' | 'selection';
  isActive: boolean;
  onToggle?: (item: T) => void;
  onSelect?: (item: T) => void;
  onEdit: (item: T, name: string, color: string) => void;
  onStartEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  recentColors: string[];
  onRecentColorAdd: (color: string) => void;
  deleteDialogTitle: string;
  deleteDialogDescription: (itemName: string) => string;
}

function BaseListItem<T extends BaseListItem>({
  item,
  mode,
  isActive,
  onToggle,
  onSelect,
  onEdit,
  onStartEdit,
  onDelete,
  recentColors,
  onRecentColorAdd,
  deleteDialogTitle,
  deleteDialogDescription,
}: BaseListItemProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editColor, setEditColor] = useState(item.color);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSaveEdit = () => {
    const trimmedName = editName.trim();
    if (
      trimmedName &&
      (trimmedName !== item.name || editColor !== item.color)
    ) {
      onEdit(item, trimmedName, editColor);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(item.name);
    setEditColor(item.color);
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete?.(item);
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
            {DEFAULT_COLORS.map((color) => (
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
        {/* Toggle/Selection Control */}
        {mode === 'checkbox' ? (
          <Checkbox
            checked={(item as unknown as CheckboxModeItem).visible}
            onCheckedChange={() => onToggle?.(item)}
            className={cn(
              'data-[state=checked]:bg-current data-[state=checked]:border-current',
              'border-2 rounded-sm flex-shrink-0'
            )}
            style={
              {
                borderColor: item.color,
                '--tw-border-opacity': '1',
                color: item.color,
              } as React.CSSProperties
            }
            aria-label={`Toggle ${item.name} visibility`}
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect?.(item)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect?.(item);
              }
            }}
            className={cn('flex-shrink-0')}
            style={{ color: item.color } as React.CSSProperties}
            aria-label={`Select ${item.name}`}
            aria-pressed={isActive}
          >
            <span className={cn('text-[18px] leading-none', isActive ? '' : 'opacity-80')}>
              {item.emoji ?? '📁'}
            </span>
          </button>
        )}

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setIsEditing(true)}
        >
          <div className="text-sm font-medium truncate">
            {item.name}
            {item.isDefault && (
              <span className="ml-1 text-xs text-muted-foreground">
                (default)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center opacity-0 group-hover/calendar:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => (onStartEdit ? onStartEdit(item) : setIsEditing(true))}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <div
                  className="mr-2 h-4 w-4 rounded-full flex-shrink-0 border-2 border-border"
                  style={{ backgroundColor: item.color }}
                />
                <span>Color</span>
                <DropdownMenuShortcut className="flex gap-1 ml-auto">
                  {DEFAULT_COLORS.slice(0, 4).map((color) => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(item, item.name, color);
                        onRecentColorAdd(color);
                      }}
                      className="w-3 h-3 rounded-full border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <ColorPicker
                    value={item.color}
                    onChange={(color) => {
                      onEdit(item, item.name, color);
                      onRecentColorAdd(color);
                    }}
                    recentColors={recentColors}
                    onRecentColorAdd={onRecentColorAdd}
                    className="w-3 h-3 border-0"
                  />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              {onDelete && !item.isDefault && (
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
            <AlertDialogTitle>{deleteDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogDescription(item.name)}
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
}
