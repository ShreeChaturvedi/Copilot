import React from 'react';
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

export const CalendarList: React.FC<CalendarListProps> = ({
  calendars,
  onToggleCalendar,
  onAddCalendar,
  onEditCalendar,
  onDeleteCalendar
}) => {
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);

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

  const handleDelete = onDeleteCalendar ? (item: CheckboxModeItem) => {
    onDeleteCalendar(item.name);
  } : undefined;

  const handleCreateFromDialog = (data: {
    name: string;
    description: string;
    iconId: string;
    color: string;
  }) => {
    onAddCalendar(data.name, data.color);
  };

  return (
    <BaseList<CheckboxModeItem>
      items={baseItems}
      title="Calendars"
      titleIcon={<Calendar className="w-4 h-4 text-sidebar-foreground" />}
      mode="checkbox"
      onToggle={handleToggle}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      showCreateDialog={showCreateDialog}
      onShowCreateDialog={setShowCreateDialog}
      onCreateDialogSubmit={handleCreateFromDialog}
      CreateDialogComponent={CreateCalendarDialog}
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

export default CalendarList;