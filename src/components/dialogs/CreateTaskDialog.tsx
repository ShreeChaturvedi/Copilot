/**
 * Create/edit a task list. Thin wrapper over CreateCollectionDialog so the
 * list and calendar dialogs share one anatomy (design-brief §4.5). The old
 * "Create Task" button copy bug is gone: the action is named Create list
 * through the whole flow (#58).
 */
import React from 'react';
import {
  CreateCollectionDialog,
  CollectionFormData,
} from './CreateCollectionDialog';

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask?: (data: CollectionFormData) => void;
  onCreateCalendar?: (data: CollectionFormData) => void;
  // Optional initial values to support edit reuse
  initialName?: string;
  initialDescription?: string;
  initialEmoji?: string;
  initialColor?: string;
  submitLabel?: string;
  titleLabel?: string;
}

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onOpenChange,
  onCreateTask,
  onCreateCalendar,
  initialName,
  initialDescription,
  initialEmoji,
  initialColor,
  submitLabel,
  titleLabel,
}) => (
  <CreateCollectionDialog
    open={open}
    onOpenChange={onOpenChange}
    kind="list"
    onSubmit={(data) => (onCreateTask ?? onCreateCalendar)?.(data)}
    initialName={initialName}
    initialDescription={initialDescription}
    initialIcon={initialEmoji}
    initialColor={initialColor}
    submitLabel={submitLabel}
    titleLabel={titleLabel}
  />
);

export default CreateTaskDialog;
