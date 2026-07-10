import { useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { CalendarClock, Search, SearchX, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCommandBarStore } from '@/stores/commandBarStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTasks } from '@/hooks/useTasks';
import { Keycap } from '@/components/ui/Keycap';
import { buildAppCommands, COMMAND_GROUPS } from './appCommands';
import {
  actionGoToday,
  actionNewEvent,
  actionNewTask,
  actionOpenAppView,
  actionOpenProfile,
  actionOpenSettings,
  actionSetCalendarView,
  actionToggleSidebar,
  actionToggleTheme,
  getIsMac,
} from './actions';
import { parseDateGrammar } from './dateGrammar';
import { commandFilter } from './commandFilter';
import './command-bar.css';

const isMac = getIsMac();

/**
 * The Cmd+K palette (design-brief §4.6). Commands are real app capabilities;
 * the input also speaks the product's date grammar: typing a task with a time
 * offers to place it, creating a real task with that due date.
 */
export default function CommandBarPanel() {
  const open = useCommandBarStore((s) => s.open);
  const setOpen = useCommandBarStore((s) => s.setOpen);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const { addTask } = useTasks();
  const [query, setQuery] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  // Element focused before the palette opened, restored on close so keyboard
  // and screen-reader users don't get dropped onto <body>.
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Fresh input every open
  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      setQuery('');
      setIsPlacing(false);
    }
  }, [open]);

  const close = () => setOpen(false);

  const commands = useMemo(
    () =>
      buildAppCommands({
        resolvedTheme,
        isMac,
        newTask: actionNewTask,
        newEvent: actionNewEvent,
        goToday: actionGoToday,
        setCalendarView: actionSetCalendarView,
        openAppView: actionOpenAppView,
        toggleTheme: actionToggleTheme,
        openSettings: actionOpenSettings,
        openProfile: actionOpenProfile,
        toggleSidebar: actionToggleSidebar,
      }),
    [resolvedTheme]
  );

  // The product-native move: date grammar via the app's real parser
  const offer = useMemo(() => parseDateGrammar(query), [query]);

  const placeTask = () => {
    if (!offer || isPlacing) return;
    setIsPlacing(true);
    addTask.mutate(
      { title: offer.title, scheduledDate: offer.when },
      {
        onSuccess: () => {
          toast.success(`Placed on ${offer.display}`);
        },
        onSettled: () => {
          setIsPlacing(false);
        },
      }
    );
    close();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="tf-cmdk-scrim" />
        <DialogPrimitive.Content
          className="tf-cmdk-panel tf-cmdk"
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            // Restore focus to the element that opened the palette (the store
            // opens it from arbitrary contexts, so Radix's default return is
            // unreliable; capture-on-open is the robust path).
            e.preventDefault();
            restoreFocusRef.current?.focus?.();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Command menu
          </DialogPrimitive.Title>
          <Command label="Command menu" filter={commandFilter}>
            <div cmdk-input-wrapper="">
              <Search aria-hidden />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Type a command or a task with a time"
                autoFocus
              />
              {/* Touch devices have no Esc key; the scrim is the only other
                  dismiss. Shown only under a coarse pointer via CSS. */}
              <button
                type="button"
                className="tf-cmdk-close"
                aria-label="Close command menu"
                onClick={close}
              >
                <X aria-hidden />
              </button>
            </div>
            <Command.List>
              <Command.Empty>
                <SearchX className="tf-cmdk-empty-icon" aria-hidden />
                No matches.
                <span className="tf-cmdk-empty-hint">
                  Try "Email vendor tomorrow 9am" to place a task.
                </span>
              </Command.Empty>

              {offer && (
                <Command.Group heading="Quick add">
                  <Command.Item
                    className="tf-cmdk-place"
                    data-pending={isPlacing || undefined}
                    value={query}
                    onSelect={placeTask}
                  >
                    <CalendarClock aria-hidden />
                    <span className="tf-cmdk-label">
                      Place "{offer.title}" on
                    </span>
                    <span className="tf-cmdk-place-date">{offer.display}</span>
                  </Command.Item>
                </Command.Group>
              )}

              {COMMAND_GROUPS.map((group) => (
                <Command.Group key={group} heading={group}>
                  {commands
                    .filter((cmd) => cmd.group === group)
                    .map((cmd) => (
                      <Command.Item
                        key={cmd.id}
                        value={cmd.label}
                        keywords={cmd.keywords}
                        onSelect={() => {
                          close();
                          cmd.run();
                        }}
                      >
                        <cmd.icon aria-hidden />
                        <span className="tf-cmdk-label">{cmd.label}</span>
                        {cmd.keys && (
                          <span className="tf-cmdk-keys">
                            {cmd.keys.map((key) => (
                              <Keycap key={key}>{key}</Keycap>
                            ))}
                          </span>
                        )}
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
          <div className="tf-cmdk-footer">
            <span className="tf-cmdk-hint">
              <Keycap>↑</Keycap>
              <Keycap>↓</Keycap> Navigate
            </span>
            <span className="tf-cmdk-hint">
              <Keycap>↵</Keycap> Select
            </span>
            <span className="tf-cmdk-hint">
              <Keycap>Esc</Keycap> Close
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
