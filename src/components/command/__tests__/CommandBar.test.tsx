import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import CommandBarPanel from '../CommandBarPanel';
import { commandFilter } from '../commandFilter';
import { buildAppCommands } from '../appCommands';
import { useCommandBarStore } from '@/stores/commandBarStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';

const mutateMock = vi.fn();
vi.mock('@/hooks/useTasks', () => ({
  useTasks: () => ({ addTask: { mutate: mutateMock } }),
}));

function renderOpenPanel() {
  act(() => {
    useCommandBarStore.getState().setOpen(true);
  });
  return render(<CommandBarPanel />);
}

describe('CommandBarPanel (Cmd+K, brief §4.6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wednesday, July 1, 2026, 12:00 local
    vi.setSystemTime(new Date(2026, 6, 1, 12, 0, 0));
    mutateMock.mockClear();
    act(() => {
      useUIStore.getState().resetUI();
      useCommandBarStore.getState().setOpen(false);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists every real command with its group and keycap hints', () => {
    renderOpenPanel();

    // Groups (11px caps labels)
    for (const group of ['Create', 'Go to', 'View', 'Preferences']) {
      expect(screen.getByText(group)).toBeInTheDocument();
    }

    // Commands are real capabilities only
    for (const label of [
      'New task',
      'New event',
      'Today',
      'Calendar',
      'Tasks',
      'Day',
      'Week',
      'Month',
      'List',
      'Open settings',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Theme label is dynamic; light is the test default
    expect(screen.getByText('Switch to dark theme')).toBeInTheDocument();

    // Keycap hints come from the real key map (N, T, D/W/M/L)
    for (const key of ['N', 'T', 'D', 'W', 'M', 'L']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it('runs a command and closes on select', () => {
    renderOpenPanel();
    fireEvent.click(screen.getByText('Tasks'));
    expect(useUIStore.getState().currentView).toBe('task');
    expect(useCommandBarStore.getState().open).toBe(false);
  });

  it('offers "Place on <resolved>" for a task typed with a time', () => {
    renderOpenPanel();
    const input = screen.getByPlaceholderText(
      'Type a command or a task with a time'
    );
    fireEvent.change(input, {
      target: { value: 'Email vendor tomorrow 9am' },
    });

    expect(screen.getByText('Place "Email vendor" on')).toBeInTheDocument();
    expect(screen.getByText('Thu, Jul 2, 9:00 AM')).toBeInTheDocument();
  });

  it('accepting the offer creates a real task with that due date', () => {
    renderOpenPanel();
    const input = screen.getByPlaceholderText(
      'Type a command or a task with a time'
    );
    fireEvent.change(input, {
      target: { value: 'Email vendor tomorrow 9am' },
    });
    fireEvent.click(screen.getByText('Place "Email vendor" on'));

    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [payload] = mutateMock.mock.calls[0];
    expect(payload.title).toBe('Email vendor');
    expect(payload.scheduledDate).toBeInstanceOf(Date);
    expect(payload.scheduledDate.getDate()).toBe(2);
    expect(payload.scheduledDate.getHours()).toBe(9);
    expect(useCommandBarStore.getState().open).toBe(false);
  });

  it('shows the teaching empty state when nothing matches', () => {
    renderOpenPanel();
    const input = screen.getByPlaceholderText(
      'Type a command or a task with a time'
    );
    fireEvent.change(input, { target: { value: 'xyzzy' } });
    expect(screen.getByText('No matches.')).toBeInTheDocument();
  });
});

describe('commandFilter', () => {
  it('matches substrings and word prefixes, not cross-keyword fuzz', () => {
    // "dark" must hit the theme command...
    expect(
      commandFilter('Switch to dark theme', 'dark', ['theme', 'dark'])
    ).toBeGreaterThan(0);
    // ...and must NOT hit Calendar via its keywords (d-a-r from value,
    // k from the keyword "week" is how cmdk's default fuzzy misranked)
    expect(
      commandFilter('Calendar', 'dark', ['events', 'schedule', 'week'])
    ).toBe(0);
    // exact and prefix scores order above keyword matches
    expect(commandFilter('Week', 'week')).toBeGreaterThan(
      commandFilter('Month', 'view', ['monthly', 'view', 'grid'])
    );
  });
});

describe('buildAppCommands', () => {
  it('binds view switches to the real settings store values', () => {
    const setCalendarView = vi.fn();
    const commands = buildAppCommands({
      resolvedTheme: 'light',
      isMac: false,
      newTask: vi.fn(),
      newEvent: vi.fn(),
      goToday: vi.fn(),
      setCalendarView,
      openAppView: vi.fn(),
      toggleTheme: vi.fn(),
      openSettings: vi.fn(),
    });

    commands.find((c) => c.id === 'view-month')!.run();
    expect(setCalendarView).toHaveBeenCalledWith('dayGridMonth');

    // Settings keycap reflects the real Ctrl/⌘+, binding
    const settings = commands.find((c) => c.id === 'open-settings')!;
    expect(settings.keys).toEqual(['Ctrl', ',']);
  });
});

describe('global single-key map (useGlobalShortcuts)', () => {
  beforeEach(() => {
    act(() => {
      useUIStore.getState().resetUI();
      useCommandBarStore.getState().setOpen(false);
      useSettingsStore.getState().setCalendarSubView('timeGridWeek');
    });
  });

  async function mountHook() {
    const { useGlobalShortcuts } = await import('@/hooks/useGlobalShortcuts');
    const Probe = () => {
      useGlobalShortcuts();
      return <input aria-label="probe-input" />;
    };
    return render(<Probe />);
  }

  it('Ctrl+K toggles the palette', async () => {
    await mountHook();
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(useCommandBarStore.getState().open).toBe(true);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    expect(useCommandBarStore.getState().open).toBe(false);
  });

  it('D/W/M/L switch the calendar sub-view', async () => {
    await mountHook();
    fireEvent.keyDown(document.body, { key: 'm' });
    expect(useSettingsStore.getState().calendarSubView).toBe('dayGridMonth');
    fireEvent.keyDown(document.body, { key: 'd' });
    expect(useSettingsStore.getState().calendarSubView).toBe('timeGridDay');
  });

  it('never fires single-letter keys while typing in an input', async () => {
    await mountHook();
    const input = screen.getByLabelText('probe-input');
    input.focus();
    fireEvent.keyDown(input, { key: 'm' });
    expect(useSettingsStore.getState().calendarSubView).toBe('timeGridWeek');
  });

  it('T returns to the calendar at today from the task view', async () => {
    await mountHook();
    act(() => {
      useUIStore.getState().setCurrentView('task');
    });
    fireEvent.keyDown(document.body, { key: 't' });
    expect(useUIStore.getState().currentView).toBe('calendar');
  });
});
