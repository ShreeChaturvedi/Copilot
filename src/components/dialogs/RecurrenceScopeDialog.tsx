/**
 * Recurring-event scope picker — the single shared "This event" / "This and
 * following" / "All events" choice, replacing three near-identical
 * hand-rolled AlertDialog blocks (EventCreationDialog's save flow,
 * EventDisplayDialog's delete and edit flows). Consolidating fixes the
 * accent-rationing violation those blocks shared (three simultaneous
 * "primary" aqua buttons for a genuine 3-way fork) and the save-flow's
 * red-for-save semantic bug (its "All events" reused the delete flow's
 * destructive color for a non-destructive save) in one place instead of
 * three, and gives the choice actual explanatory weight — a two-line row per
 * option instead of a bare 2-4 word label.
 */
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ScopeChoice {
  label: string;
  description: string;
  onSelect: () => void;
}

export interface RecurrenceScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** True only for a genuine delete-all flow — reddens the "All events" row. */
  destructive?: boolean;
  onThisEvent: () => void;
  onThisAndFollowing: () => void;
  onAllEvents: () => void;
  /** Overrides the "All events" row's description (defaults per `destructive`). */
  allEventsCopy?: string;
}

export function RecurrenceScopeDialog({
  open,
  onOpenChange,
  title,
  description,
  destructive = false,
  onThisEvent,
  onThisAndFollowing,
  onAllEvents,
  allEventsCopy = destructive
    ? 'Every occurrence in the series is deleted.'
    : 'Every occurrence in the series changes.',
}: RecurrenceScopeDialogProps) {
  const choices: ScopeChoice[] = [
    {
      label: 'This event',
      description: 'Only this occurrence changes.',
      onSelect: onThisEvent,
    },
    {
      label: 'This and following',
      description: 'This and every future occurrence changes.',
      onSelect: onThisAndFollowing,
    },
    { label: 'All events', description: allEventsCopy, onSelect: onAllEvents },
  ];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          {choices.map((choice, i) => {
            const isDestructiveRow = destructive && i === choices.length - 1;
            return (
              <Button
                key={choice.label}
                type="button"
                variant="outline"
                onClick={choice.onSelect}
                className={cn(
                  'h-auto flex-col items-start gap-0.5 whitespace-normal px-3 py-2.5 text-left',
                  isDestructiveRow &&
                    'border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive'
                )}
              >
                <span className="text-sm font-medium">{choice.label}</span>
                <span
                  className={cn(
                    'text-xs font-normal',
                    isDestructiveRow ? 'text-destructive/80' : 'text-ink-muted'
                  )}
                >
                  {choice.description}
                </span>
              </Button>
            );
          })}
        </div>

        <AlertDialogFooter className="sm:justify-start">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default RecurrenceScopeDialog;
