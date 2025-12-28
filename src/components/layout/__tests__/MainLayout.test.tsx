import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MainLayout } from '../MainLayout';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSettingsDialog } from '@/hooks/useSettingsDialog';
import { useAuthStore } from '@/stores/authStore';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useIsFetching: () => 0,
  };
});

vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn(),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('@/hooks/useSettingsDialog', () => ({
  useSettingsDialog: vi.fn(),
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../LeftPane', () => ({
  LeftPane: () => <div data-testid="left-pane">Left Pane</div>,
}));

vi.mock('../RightPane', () => ({
  RightPane: () => <div data-testid="right-pane">Right Pane</div>,
}));

vi.mock('../TaskFocusPane', () => ({
  TaskFocusPane: () => <div data-testid="task-focus-pane">Task Focus Pane</div>,
}));

vi.mock('@/components/settings/SettingsDialog', () => ({
  SettingsDialog: ({ open }: { open: boolean }) => (
    <div data-testid="settings-dialog" data-open={open} />
  ),
}));

describe('MainLayout', () => {
  const mockSetCurrentView = vi.fn();
  const mockLogout = vi.fn();
  const mockOpenSettings = vi.fn();
  const mockCloseSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentView: 'calendar',
      dragState: null,
      setCurrentView: mockSetCurrentView,
    });

    (useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      sidebarExpanded: true,
      appViewMode: 'calendar',
    });

    (useSettingsDialog as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isOpen: false,
      currentSection: 'general',
      openSettings: mockOpenSettings,
      closeSettings: mockCloseSettings,
    });

    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      logout: mockLogout,
    });
  });

  it('renders left and right panes in calendar view', async () => {
    render(<MainLayout />);

    expect(await screen.findByTestId('left-pane')).toBeInTheDocument();
    expect(await screen.findByTestId('right-pane')).toBeInTheDocument();
    expect(screen.queryByTestId('task-focus-pane')).not.toBeInTheDocument();
  });

  it('renders task focus pane in task view', async () => {
    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentView: 'task',
      dragState: null,
      setCurrentView: mockSetCurrentView,
    });

    render(<MainLayout />);

    expect(await screen.findByTestId('left-pane')).toBeInTheDocument();
    expect(await screen.findByTestId('task-focus-pane')).toBeInTheDocument();
    expect(screen.queryByTestId('right-pane')).not.toBeInTheDocument();
  });

  it('applies layout data attributes', () => {
    const { container } = render(<MainLayout />);

    const root = container.querySelector('[data-view]');
    expect(root).toHaveAttribute('data-view', 'calendar');
    expect(root).not.toHaveAttribute('data-dragging');
  });

  it('renders settings dialog', () => {
    (useSettingsDialog as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isOpen: true,
      currentSection: 'general',
      openSettings: mockOpenSettings,
      closeSettings: mockCloseSettings,
    });

    render(<MainLayout />);

    expect(screen.getByTestId('settings-dialog')).toHaveAttribute(
      'data-open',
      'true'
    );
  });
});
