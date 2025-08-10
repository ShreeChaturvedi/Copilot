import * as React from 'react';
import { format } from 'date-fns';
import {
  Calendar as CalendarIcon,
  CalendarDays as CalendarNameIcon,
  Clock as ClockIcon,
  MapPin,
  FileText,
  ArrowRight,
  AtSign,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { IntegratedActionBar } from './IntegratedActionBar';
import { Button } from '@/components/ui/Button';
import { useUpdateEvent, useCreateEvent, useDeleteEvent } from '@/hooks/useEvents';
import { toHumanText, clampRRuleUntil } from '@/utils/recurrence';
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

import type { CalendarEvent } from "@shared/types";
import { useCalendars } from '@/hooks/useCalendars';
import { useUIStore } from '@/stores/uiStore';

interface EventDisplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onEdit?: (event: CalendarEvent) => void;
}

function EventDisplayDialogContent({ event }: { event: CalendarEvent }) {
  const { data: calendars = [] } = useCalendars();
  const updateEventMutation = useUpdateEvent();
  const createEventMutation = useCreateEvent();

  const calendar = React.useMemo(() => {
    if (!event) return null;
    return calendars.find((cal) => cal.name === event.calendarName) || null;
  }, [calendars, event]);

  const formatDateTime = React.useCallback(
    (start: Date, end: Date, allDay?: boolean) => {
      const startDate = format(start, 'MMM dd, yyyy');

      if (allDay) {
        const endDate = format(end, 'MMM dd, yyyy');
        return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
      } else {
        const endDate = format(end, 'MMM dd, yyyy');
        const startTime = format(start, 'h:mm a');
        const endTime = format(end, 'h:mm a');

        if (startDate === endDate) {
          return { date: startDate, startTime, endTime };
        } else {
          return {
            text: `${startDate} at ${startTime} - ${endDate} at ${endTime}`,
          };
        }
      }
    },
    []
  );

  const dateTimeInfo = formatDateTime(
    new Date(event.start),
    new Date(event.end),
    event.allDay
  );

  return (
    <>
      {/* Hidden element to receive initial focus instead of edit button */}
      <div tabIndex={0} className="sr-only" />

      {/* Title with Calendar Color and Name */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {calendar && (
            <div
              className="w-4 h-4 rounded-sm border-2 flex-shrink-0"
              style={{
                backgroundColor: calendar.color,
                borderColor: calendar.color,
              }}
            />
          )}
          <h2 className="text-xl font-semibold leading-tight">{event.title}</h2>
        </div>

        {event.allDay && (
          <Badge variant="secondary" className="w-fit">
            All Day
          </Badge>
        )}
      </div>

      <div className="space-y-6">
        {calendar && (
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground flex-shrink-0">
              <CalendarNameIcon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm">{calendar.name}</p>
            </div>
          </div>
        )}

        {/* Date and Time */}
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex-shrink-0">
            {event.allDay ? (
              <CalendarIcon className="h-4 w-4" />
            ) : (
              <ClockIcon className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1">
            {event.allDay ? (
              <p className="text-sm font-medium">
                {typeof dateTimeInfo === 'string' ? dateTimeInfo : ''}
              </p>
            ) : (
              <div className="flex items-center gap-3 text-sm font-medium">
                {typeof dateTimeInfo === 'object' && 'date' in dateTimeInfo ? (
                  <>
                    <span>{dateTimeInfo.date}</span>
                    <AtSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{dateTimeInfo.startTime}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{dateTimeInfo.endTime}</span>
                  </>
                ) : (
                  <span>
                    {typeof dateTimeInfo === 'object' && 'text' in dateTimeInfo
                      ? dateTimeInfo.text
                      : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground flex-shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm">{event.location}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="flex items-start gap-3">
            <div className="text-muted-foreground flex-shrink-0 mt-1">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm whitespace-pre-wrap">
                {event.description}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recurrence summary (actions integrated with header buttons) */}
      {event.recurrence && (
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex-shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm">{toHumanText(event.recurrence, new Date(event.start))?.replace(/^\s*([a-z])/, (m, c) => c.toUpperCase())}</p>
          </div>
        </div>
      )}
    </>
  );
}

export function EventDisplayDialog({
  open,
  onOpenChange,
  event,
  onEdit,
}: EventDisplayDialogProps) {
  const { peekMode, setPeekMode } = useUIStore();
  const deleteEventMutation = useDeleteEvent();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleEdit = React.useCallback(() => {
    if (event && onEdit) {
      onEdit(event);
      handleClose();
    }
  }, [event, onEdit, handleClose]);

  const handleDelete = React.useCallback(async () => {
    if (!event) return;

    setIsDeleting(true);

    try {
      await deleteEventMutation.mutateAsync(event.id);
      handleClose();
    } catch (error) {
      console.error('Failed to delete event:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [event, deleteEventMutation, handleClose]);

  const togglePeekMode = React.useCallback(() => {
    setPeekMode(peekMode === 'center' ? 'right' : 'center');
  }, [peekMode, setPeekMode]);

  if (!event) {
    return null;
  }

  // Integrate recurrence actions into the same buttons via small dropdown behavior
  const actionButtons = (
    <div className="absolute top-4 right-4 flex gap-2">
      <IntegratedActionBar
        peekMode={peekMode}
        onPeekModeToggle={togglePeekMode}
        onEdit={() => {
          // Defer recurring choice until after user clicks Save in the edit dialog.
          // Here, simply open the editor for the series or one-off as usual.
          handleEdit();
        }}
        onDelete={() => {
          if (event.recurrence) setDeleteDialogOpen(true);
          else void handleDelete();
        }}
        onClose={handleClose}
        isDeleting={isDeleting}
      />
    </div>
  );

  if (peekMode === 'right') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg p-6 [&>button]:hidden"
        >
          <EventDisplayDialogContent event={event} />
          {actionButtons}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{event.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Event details for {event.title} - view, edit, or delete this event
        </DialogDescription>
        <EventDisplayDialogContent event={event} />
        {actionButtons}
      </DialogContent>
      {/* Delete dialog for recurring events */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event</AlertDialogTitle>
            <AlertDialogDescription>
              This is a recurring event. What would you like to delete?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                // Delete this occurrence only
                const iso = new Date(event.occurrenceInstanceStart || event.start).toISOString();
                const newExceptions = Array.from(new Set([...(event.exceptions || []), iso]));
                await updateEventMutation.mutateAsync({ id: event.id, data: { exceptions: newExceptions } });
                setDeleteDialogOpen(false);
                handleClose();
              }}
            >
              This event
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                // This and following events: clamp series UNTIL to just before this instance
                const occStart = new Date(event.occurrenceInstanceStart || event.start);
                const clamped = clampRRuleUntil(event.recurrence!, occStart);
                await updateEventMutation.mutateAsync({ id: event.id, data: { recurrence: clamped } });
                setDeleteDialogOpen(false);
                handleClose();
              }}
            >
              This and following
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                await handleDelete();
                setDeleteDialogOpen(false);
              }}
            >
              All events
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog for recurring events */}
      <AlertDialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit event</AlertDialogTitle>
            <AlertDialogDescription>
              This is a recurring event. What would you like to edit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                // Edit this occurrence only (create one-off, exclude from series, then open editor)
                const occStart = (event.occurrenceInstanceStart || event.start);
                const occEnd = (event.occurrenceInstanceEnd || event.end);
                const iso = new Date(occStart).toISOString();
                const newExceptions = Array.from(new Set([...(event.exceptions || []), iso]));
                await updateEventMutation.mutateAsync({ id: event.id, data: { exceptions: newExceptions } });
                const oneOff = await createEventMutation.mutateAsync({
                  title: event.title,
                  start: occStart,
                  end: occEnd,
                  allDay: event.allDay,
                  description: event.description,
                  location: event.location,
                  calendarName: event.calendarName || (calendar?.name || ''),
                  color: event.color,
                });
                setEditDialogOpen(false);
                onEdit?.({ ...oneOff });
                handleClose();
              }}
            >
              This event
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                // This and following: convert series at this point into a split by clamping and creating a new follow-up
                const occStart = new Date(event.occurrenceInstanceStart || event.start);
                const clamped = clampRRuleUntil(event.recurrence!, occStart);
                // Update current series to end before this occurrence
                updateEventMutation.mutate({ id: event.id, data: { recurrence: clamped } });
                setEditDialogOpen(false);
                handleEdit();
              }}
            >
              This and following
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                setEditDialogOpen(false);
                handleEdit();
              }}
            >
              All events
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
