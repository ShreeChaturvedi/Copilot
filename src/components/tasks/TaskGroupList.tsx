import React, { memo } from 'react';
import { List } from 'lucide-react';
import { BaseList, SelectionModeItem } from '@/components/ui/BaseList';
import { CreateTaskDialog } from '@/components/dialogs/CreateTaskDialog';

export interface TaskGroup {
  id: string;
  name: string;
  iconId: string;
  color: string;
  description?: string;
  isDefault?: boolean;
}

export interface TaskGroupListProps {
  taskGroups: TaskGroup[];
  activeTaskGroupId?: string;
  onSelectTaskGroup: (id: string) => void;
  onAddTaskGroup: (data: {
    name: string;
    iconId: string;
    color: string;
    description?: string;
  }) => void;
  onEditTaskGroup: (
    id: string,
    updates: {
      name: string;
      iconId: string;
      color: string;
      description?: string;
    }
  ) => void;
  onDeleteTaskGroup?: (id: string) => void;
}

// Convert TaskGroup to SelectionModeItem
function taskGroupToBaseItem(taskGroup: TaskGroup): SelectionModeItem {
  return {
    id: taskGroup.id,
    name: taskGroup.name,
    color: taskGroup.color,
    description: taskGroup.description,
    isDefault: taskGroup.isDefault,
  };
}

const TaskGroupListComponent: React.FC<TaskGroupListProps> = ({
  taskGroups,
  activeTaskGroupId,
  onSelectTaskGroup,
  onAddTaskGroup,
  onEditTaskGroup,
  onDeleteTaskGroup,
}) => {
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);

  // Convert task groups to base list items
  const baseItems = taskGroups.map(taskGroupToBaseItem);

  const handleSelect = (item: SelectionModeItem) => {
    onSelectTaskGroup(item.id);
  };

  const handleAdd = (name: string, color: string) => {
    onAddTaskGroup({
      name,
      iconId: 'CheckSquare',
      color,
      description: '',
    });
  };

  const handleEdit = (item: SelectionModeItem, name: string, color: string) => {
    const originalTaskGroup = taskGroups.find((tg) => tg.id === item.id);
    if (originalTaskGroup) {
      onEditTaskGroup(item.id, {
        name,
        iconId: originalTaskGroup.iconId,
        color,
        description: originalTaskGroup.description,
      });
    }
  };

  const handleDelete = onDeleteTaskGroup
    ? (item: SelectionModeItem) => {
        onDeleteTaskGroup(item.id);
      }
    : undefined;

  const handleCreateFromDialog = (data: {
    name: string;
    description: string;
    iconId: string;
    color: string;
  }) => {
    onAddTaskGroup({
      name: data.name,
      iconId: data.iconId,
      color: data.color,
      description: data.description,
    });
  };

  return (
    <BaseList<SelectionModeItem>
      items={baseItems}
      title="Task Lists"
      titleIcon={<List className="w-4 h-4 text-sidebar-foreground" />}
      mode="selection"
      activeItemId={activeTaskGroupId}
      onSelect={handleSelect}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      showCreateDialog={showCreateDialog}
      onShowCreateDialog={setShowCreateDialog}
      onCreateDialogSubmit={handleCreateFromDialog}
      CreateDialogComponent={CreateTaskDialog}
      addButtonLabel="Task List"
      emptyStateText="No task lists yet"
      createFirstItemText="Create your first task list"
      deleteDialogTitle="Delete Task List"
      deleteDialogDescription={(itemName) =>
        `Are you sure you want to delete "${itemName}"? All tasks in this list will be permanently deleted. This action cannot be undone.`
      }
    />
  );
};

// Custom comparison function for TaskGroupList
const TaskGroupListMemoComparison = (
  prevProps: TaskGroupListProps,
  nextProps: TaskGroupListProps
) => {
  // Compare core data arrays by reference (most common change)
  if (prevProps.taskGroups !== nextProps.taskGroups) return false;
  if (prevProps.activeTaskGroupId !== nextProps.activeTaskGroupId) return false;

  // Function props assumed to be stable (will be optimized in LeftPane with useCallback)
  // We don't compare function props as they should be memoized by the parent

  return true; // Props are equal, skip re-render
};

// Memoized TaskGroupList component
export const TaskGroupList = memo(
  TaskGroupListComponent,
  TaskGroupListMemoComparison
);

export default TaskGroupList;
