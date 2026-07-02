/**
 * Command list for the Cmd+K palette (design-brief §4.6).
 *
 * Every command maps to a real app capability, and every keycap hint is a key
 * the app actually binds (useGlobalShortcuts + the existing
 * useKeyboardShortcuts map). Nothing here is invented.
 */
import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CheckSquare,
  Columns3,
  LayoutGrid,
  List,
  Moon,
  Plus,
  RectangleVertical,
  Settings,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { CalendarSubView } from '@/stores/settingsStore';

export interface AppCommand {
  id: string;
  group: 'Create' | 'Go to' | 'View' | 'Preferences';
  label: string;
  icon: LucideIcon;
  /** Keycap hints; each entry renders as its own Keycap */
  keys?: string[];
  /** Extra match terms for filtering */
  keywords?: string[];
  run: () => void;
}

export interface AppCommandDeps {
  resolvedTheme: 'light' | 'dark';
  isMac: boolean;
  newTask: () => void;
  newEvent: () => void;
  goToday: () => void;
  setCalendarView: (view: CalendarSubView) => void;
  openAppView: (view: 'calendar' | 'task') => void;
  toggleTheme: () => void;
  openSettings: () => void;
}

export function buildAppCommands(deps: AppCommandDeps): AppCommand[] {
  const mod = deps.isMac ? '⌘' : 'Ctrl';
  return [
    {
      id: 'new-task',
      group: 'Create',
      label: 'New task',
      icon: Plus,
      keys: ['N'],
      keywords: ['add', 'todo', 'create'],
      run: deps.newTask,
    },
    {
      id: 'new-event',
      group: 'Create',
      label: 'New event',
      icon: CalendarPlus,
      keywords: ['add', 'meeting', 'create', 'schedule'],
      run: deps.newEvent,
    },
    {
      id: 'go-today',
      group: 'Go to',
      label: 'Today',
      icon: CalendarCheck,
      keys: ['T'],
      keywords: ['now', 'jump', 'current'],
      run: deps.goToday,
    },
    {
      id: 'go-calendar',
      group: 'Go to',
      label: 'Calendar',
      icon: Calendar,
      keywords: ['events', 'schedule', 'week'],
      run: () => deps.openAppView('calendar'),
    },
    {
      id: 'go-tasks',
      group: 'Go to',
      label: 'Tasks',
      icon: CheckSquare,
      keywords: ['todos', 'lists', 'board'],
      run: () => deps.openAppView('task'),
    },
    {
      id: 'view-day',
      group: 'View',
      label: 'Day',
      icon: RectangleVertical,
      keys: ['D'],
      keywords: ['daily', 'view'],
      run: () => deps.setCalendarView('timeGridDay'),
    },
    {
      id: 'view-week',
      group: 'View',
      label: 'Week',
      icon: Columns3,
      keys: ['W'],
      keywords: ['weekly', 'view'],
      run: () => deps.setCalendarView('timeGridWeek'),
    },
    {
      id: 'view-month',
      group: 'View',
      label: 'Month',
      icon: LayoutGrid,
      keys: ['M'],
      keywords: ['monthly', 'view', 'grid'],
      run: () => deps.setCalendarView('dayGridMonth'),
    },
    {
      id: 'view-list',
      group: 'View',
      label: 'List',
      icon: List,
      keys: ['L'],
      keywords: ['agenda', 'view'],
      run: () => deps.setCalendarView('listWeek'),
    },
    {
      id: 'toggle-theme',
      group: 'Preferences',
      label:
        deps.resolvedTheme === 'dark'
          ? 'Switch to light theme'
          : 'Switch to dark theme',
      icon: deps.resolvedTheme === 'dark' ? Sun : Moon,
      keywords: ['theme', 'dark', 'light', 'appearance', 'mode'],
      run: deps.toggleTheme,
    },
    {
      id: 'open-settings',
      group: 'Preferences',
      label: 'Open settings',
      icon: Settings,
      keys: [mod, ','],
      keywords: ['preferences', 'options', 'profile'],
      run: deps.openSettings,
    },
  ];
}

export const COMMAND_GROUPS = [
  'Create',
  'Go to',
  'View',
  'Preferences',
] as const;
