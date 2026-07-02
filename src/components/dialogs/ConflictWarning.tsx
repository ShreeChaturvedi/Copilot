import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import type { EventConflict } from '@/services/api';

interface ConflictWarningProps {
  conflicts: EventConflict[];
}

/**
 * Non-blocking banner listing events that overlap the one being edited.
 *
 * Conflicts are checked across ALL of the user's calendars (#41), so each row
 * names the calendar the conflicting event lives on to disambiguate
 * cross-calendar double-bookings.
 */
export function ConflictWarning({ conflicts }: ConflictWarningProps) {
  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      className="mt-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm dark:border-yellow-900/60 dark:bg-yellow-950/40"
    >
      <div className="flex items-center gap-2 font-medium text-yellow-800 dark:text-yellow-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {conflicts.length === 1
          ? 'This time overlaps 1 existing event'
          : `This time overlaps ${conflicts.length} existing events`}
      </div>
      <ul className="mt-2 space-y-1 text-yellow-800 dark:text-yellow-200">
        {conflicts.map((conflict) => {
          const ev = conflict.conflictingEvent;
          return (
            <li key={ev.id} className="flex flex-col">
              <span className="font-medium">
                {ev.title || 'Untitled event'}
              </span>
              <span className="text-xs opacity-80">
                {ev.allDay
                  ? 'All day'
                  : `${format(new Date(ev.start), 'MMM d, h:mm a')} - ${format(
                      new Date(ev.end),
                      'h:mm a'
                    )}`}
                {ev.calendarName ? ` · ${ev.calendarName}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-yellow-700 dark:text-yellow-300/80">
        You can still save, or adjust the time to avoid the overlap.
      </p>
    </div>
  );
}

export default ConflictWarning;
