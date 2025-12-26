import React, { memo } from 'react';
import { Calendar } from 'lucide-react';
import { BaseList, CheckboxModeItem } from '@/components/ui/BaseList';
import { CreateCalendarDialog } from '@/components/dialogs/CreateCalendarDialog';

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

// Convert Calendar to CheckboxModeItem
function calendarToBaseItem(calendar: Calendar): CheckboxModeItem {
  return {
    id: calendar.name, // Use name as ID for calendars
    name: calendar.name,
    color: calendar.color,
    visible: calendar.visible,
    description: calendar.description,
    isDefault: calendar.isDefault,
  };
}

const CalendarListComponent: React.FC<CalendarListProps> = ({
  calendars,
  onToggleCalendar,
  onAddCalendar,
  onEditCalendar,
  onDeleteCalendar,
}) => {
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<CheckboxModeItem | null>(null);

  // Convert calendars to base list items
  const baseItems = calendars.map(calendarToBaseItem);

  const handleToggle = (item: CheckboxModeItem) => {
    onToggleCalendar(item.name);
  };

  const handleAdd = (name: string, color: string) => {
    onAddCalendar(name, color);
  };

  const handleEdit = (item: CheckboxModeItem, name: string, color: string) => {
    onEditCalendar(item.name, name, color);
  };

  const handleDelete = onDeleteCalendar
    ? (item: CheckboxModeItem) => {
      onDeleteCalendar(item.name);
    }
    : undefined;

  const handleCreateFromDialog = (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => {
    if (editingItem) {
      onEditCalendar(editingItem.name, data.name, data.color);
      setEditingItem(null);
      setShowCreateDialog(false);
    } else {
      onAddCalendar(data.name, data.color);
    }
  };

  const currentCal = editingItem ? calendars.find(c => c.name === editingItem.name) : undefined;

  return (
    <BaseList<CheckboxModeItem>
      items={baseItems}
      title="Calendars"
      titleIcon={<Calendar className="w-4 h-4 text-sidebar-foreground" />}
      mode="checkbox"
      onToggle={handleToggle}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onStartEdit={(item) => {
        setEditingItem(item);
        setShowCreateDialog(true);
      }}
      onDelete={handleDelete}
      showCreateDialog={showCreateDialog}
      onShowCreateDialog={(open) => {
        setShowCreateDialog(open);
        if (!open) setEditingItem(null);
      }}
      onCreateDialogSubmit={handleCreateFromDialog}
      CreateDialogComponent={CreateCalendarDialog}
      createDialogInitialData={editingItem ? {
        name: currentCal?.name || editingItem.name,
        description: currentCal?.description || '',
        iconId: 'Calendar',
        color: currentCal?.color || editingItem.color,
        submitLabel: 'Save Changes',
        titleLabel: 'Edit Calendar',
      } : undefined}
      addButtonLabel="Calendar"
      emptyStateText="No calendars yet"
      createFirstItemText="Create your first calendar"
      deleteDialogTitle="Delete Calendar"
      deleteDialogDescription={(itemName) =>
        `Are you sure you want to delete "${itemName}"? All events in this calendar will be permanently deleted. This action cannot be undone.`
      }
    />
  );
};

// Custom comparison function for CalendarList
const CalendarListMemoComparison = (
  prevProps: CalendarListProps,
  nextProps: CalendarListProps
) => {
  // Compare calendars array by reference (most common change)
  if (prevProps.calendars !== nextProps.calendars) return false;

  // Function props assumed to be stable (will be optimized in LeftPane with useCallback)
  // We don't compare function props as they should be memoized by the parent

  return true; // Props are equal, skip re-render
};

// Memoized CalendarList component
export const CalendarList = memo(
  CalendarListComponent,
  CalendarListMemoComparison
);

export default CalendarList;
