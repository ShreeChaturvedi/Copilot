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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
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
import { sanitizeHtml } from '@/utils/validation';
import { IntegratedActionBar } from './IntegratedActionBar';
import { RecurrenceScopeDialog } from './RecurrenceScopeDialog';
import {
  useUpdateEvent,
  useCreateEvent,
  useDeleteEvent,
} from '@/hooks/useEvents';
import {
  toHumanText,
  clampRRuleUntil,
  stripRRuleCountUntil,
} from '@/utils/recurrence';

import type { CalendarEvent } from '@shared/types';
import { useCalendars } from '@/hooks/useCalendars';
import { useUIStore } from '@/stores/uiStore';

interface EventDisplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onEdit?: (event: CalendarEvent) => void;
}

function EventDisplayDialogContent({
  event,
  actions,
}: {
  event: CalendarEvent;
  actions?: React.ReactNode;
}) {
  const { data: calendars = [] } = useCalendars();

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

  const effectiveStart = event.occurrenceInstanceStart ?? event.start;
  const effectiveEnd = event.occurrenceInstanceEnd ?? event.end;

  const dateTimeInfo = formatDateTime(
    new Date(effectiveStart),
    new Date(effectiveEnd),
    event.allDay
  );

  return (
    <>
      {/* Title + actions inline; title truncates within available space */}
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {calendar && (
            <div
              className="w-4 h-4 rounded-sm flex-shrink-0"
              style={{ backgroundColor: calendar.color }}
            />
          )}
          <h2 className="text-base font-semibold tracking-[-0.01em] leading-tight truncate">
            {event.title}
          </h2>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>

      {event.allDay && (
        <Badge variant="secondary" className="w-fit mt-2">
          All day
        </Badge>
      )}

      <div className="space-y-4">
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
              {(() => {
                const safeHtml = sanitizeHtml(event.description || '');
                return (
                  <div
                    className="text-sm rte-display"
                    dangerouslySetInnerHTML={{ __html: safeHtml }}
                  />
                );
              })()}
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
            <p className="text-sm">
              {toHumanText(event.recurrence, new Date(event.start))?.replace(
                /^\s*([a-z])/,
                (_m, c) => c.toUpperCase()
              )}
            </p>
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
  const updateEventMutation = useUpdateEvent();
  const createEventMutation = useCreateEvent();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
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
      // Trigger optimistic delete; close immediately for snappy UX
      deleteEventMutation.mutate(event.id);
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
    <IntegratedActionBar
      peekMode={peekMode}
      onPeekModeToggle={togglePeekMode}
      onEdit={() => {
        handleEdit();
      }}
      onDelete={() => {
        // Recurring events get the scope dialog; single events now get a
        // lightweight confirm so one mis-click can't permanently drop an event.
        if (event.recurrence) setDeleteDialogOpen(true);
        else setConfirmDeleteOpen(true);
      }}
      onClose={handleClose}
      isDeleting={isDeleting}
    />
  );

  // Render both Sheet and Dialog, but only one is open at a time
  // This prevents the flicker caused by unmounting one before mounting the other
  const isSheetMode = peekMode === 'right';

  return (
    <>
      {/* Confirm delete for single (non-recurring) events. Rendered at the top
          level so it works in both the sheet and center-dialog shells. */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &ldquo;{event.title}&rdquo;. This can&rsquo;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDeleteOpen(false);
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sheet (right panel) - only open when open=true AND peekMode='right' */}
      <Sheet open={open && isSheetMode} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg md:max-w-xl p-6 overflow-y-auto [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{event.title}</SheetTitle>
            <SheetDescription>
              Event details for {event.title} - view, edit, or delete this event
            </SheetDescription>
          </SheetHeader>
          <EventDisplayDialogContent event={event} actions={actionButtons} />
        </SheetContent>
      </Sheet>

      {/* Dialog (center modal) - only open when open=true AND peekMode='center' */}
      <Dialog open={open && !isSheetMode} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-md overflow-hidden"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">{event.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Event details for {event.title} - view, edit, or delete this event
          </DialogDescription>
          <EventDisplayDialogContent event={event} actions={actionButtons} />
        </DialogContent>
        {/* Delete dialog for recurring events */}
        <RecurrenceScopeDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete event"
          description="This is a recurring event. What would you like to delete?"
          destructive
          onThisEvent={async () => {
            // Delete this occurrence only
            const iso = new Date(
              event.occurrenceInstanceStart || event.start
            ).toISOString();
            const newExceptions = Array.from(
              new Set([...(event.exceptions || []), iso])
            );
            await updateEventMutation.mutateAsync({
              id: event.id,
              data: { exceptions: newExceptions },
            });
            setDeleteDialogOpen(false);
            handleClose();
          }}
          onThisAndFollowing={async () => {
            // This and following events: clamp series UNTIL to just before this instance
            const occStart = new Date(
              event.occurrenceInstanceStart || event.start
            );
            const clamped = clampRRuleUntil(event.recurrence!, occStart);
            await updateEventMutation.mutateAsync({
              id: event.id,
              data: { recurrence: clamped },
            });
            setDeleteDialogOpen(false);
            handleClose();
          }}
          onAllEvents={async () => {
            await handleDelete();
            setDeleteDialogOpen(false);
          }}
        />

        {/* Edit dialog for recurring events */}
        <RecurrenceScopeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          title="Edit event"
          description="This is a recurring event. What would you like to edit?"
          onThisEvent={async () => {
            // Edit this occurrence only (create one-off, exclude from series, then open editor)
            const occStart = event.occurrenceInstanceStart || event.start;
            const occEnd = event.occurrenceInstanceEnd || event.end;
            const iso = new Date(occStart).toISOString();
            const newExceptions = Array.from(
              new Set([...(event.exceptions || []), iso])
            );
            await updateEventMutation.mutateAsync({
              id: event.id,
              data: { exceptions: newExceptions },
            });
            const oneOff = await createEventMutation.mutateAsync({
              title: event.title,
              start: occStart,
              end: occEnd,
              allDay: event.allDay,
              description: event.description,
              location: event.location,
              calendarName: event.calendarName || '',
              color: event.color,
            });
            setEditDialogOpen(false);
            onEdit?.({ ...oneOff });
            handleClose();
          }}
          onThisAndFollowing={async () => {
            // This and following: mirror the save-flow split. Clamp the master to
            // end before this occurrence, then create a NEW future series that
            // starts at this occurrence and carries the (budget-stripped) rule,
            // and open the editor on THAT event. Previously this re-opened the
            // editor on the now-clamped master (editing the PAST half) and
            // double-prompted for scope on save.
            const occStart = new Date(
              event.occurrenceInstanceStart || event.start
            );
            const occEnd = event.occurrenceInstanceEnd || event.end;
            const clamped = clampRRuleUntil(event.recurrence!, occStart);
            await updateEventMutation.mutateAsync({
              id: event.id,
              data: { recurrence: clamped },
            });
            // Strip COUNT/UNTIL so the new series doesn't inherit the parent's
            // occurrence budget.
            const futureRule = stripRRuleCountUntil(event.recurrence!);
            const futureSeries = await createEventMutation.mutateAsync({
              title: event.title,
              start: occStart,
              end: occEnd,
              allDay: event.allDay,
              description: event.description,
              location: event.location,
              calendarName: event.calendarName || '',
              color: event.color,
              recurrence: futureRule,
            });
            setEditDialogOpen(false);
            onEdit?.({ ...futureSeries });
            handleClose();
          }}
          onAllEvents={() => {
            setEditDialogOpen(false);
            handleEdit();
          }}
        />
      </Dialog>
    </>
  );
}
