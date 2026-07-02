/**
 * Create/edit a calendar. Thin wrapper over CreateCollectionDialog so the
 * list and calendar dialogs share one anatomy (design-brief §4.5).
 */
import React from 'react';
import {
  CreateCollectionDialog,
  CollectionFormData,
} from './CreateCollectionDialog';

export interface CreateCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCalendar?: (data: CollectionFormData) => void;
  onCreateTask?: (data: CollectionFormData) => void;
  // Optional initial values to support edit reuse
  initialName?: string;
  initialDescription?: string;
  initialIconId?: string;
  initialColor?: string;
  submitLabel?: string;
  titleLabel?: string;
}

export const CreateCalendarDialog: React.FC<CreateCalendarDialogProps> = ({
  open,
  onOpenChange,
  onCreateCalendar,
  onCreateTask,
  initialName,
  initialDescription,
  initialIconId,
  initialColor,
  submitLabel,
  titleLabel,
}) => (
  <CreateCollectionDialog
    open={open}
    onOpenChange={onOpenChange}
    kind="calendar"
    onSubmit={(data) => (onCreateCalendar ?? onCreateTask)?.(data)}
    initialName={initialName}
    initialDescription={initialDescription}
    initialIcon={initialIconId}
    initialColor={initialColor}
    submitLabel={submitLabel}
    titleLabel={titleLabel}
  />
);

export default CreateCalendarDialog;
