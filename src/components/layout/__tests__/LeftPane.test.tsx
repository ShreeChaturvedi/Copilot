import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeftPane } from '../LeftPane';
import { useUIStore } from '@/stores/uiStore';
import { useTaskManagement } from '@/hooks/useTaskManagement';
import { useCalendarManagement } from '@/hooks/useCalendarManagement';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ReactNode } from 'react';

vi.mock('@/stores/uiStore', () => ({
  useUIStore: vi.fn(),
}));

vi.mock('@/hooks/useTaskManagement', () => ({
  useTaskManagement: vi.fn(),
}));

vi.mock('@/hooks/useCalendarManagement', () => ({
  useCalendarManagement: vi.fn(),
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

type BaseSidebarPaneProps = {
  additionalHeaderContent?: ReactNode;
  mainContent?: ReactNode;
  footerListContent?: ReactNode;
};

vi.mock('../BaseSidebarPane', () => ({
  BaseSidebarPane: ({
    additionalHeaderContent,
    mainContent,
    footerListContent,
  }: BaseSidebarPaneProps) => (
    <div>
      <div data-testid="header-slot">{additionalHeaderContent}</div>
      <div data-testid="main-slot">{mainContent}</div>
      <div data-testid="footer-slot">{footerListContent}</div>
    </div>
  ),
}));

vi.mock('@/components/tasks/TaskList', () => ({
  TaskList: () => <div data-testid="task-list">TaskList</div>,
}));

vi.mock('@/components/calendar/CalendarList', () => ({
  CalendarList: () => <div data-testid="calendar-list">CalendarList</div>,
}));

vi.mock('@/components/tasks/TaskGroupList', () => ({
  TaskGroupList: () => <div data-testid="task-group-list">TaskGroupList</div>,
}));

vi.mock('@/components/calendar/EventOverview', () => ({
  EventOverview: () => <div data-testid="event-overview">EventOverview</div>,
}));

vi.mock('@/components/smart-input/SmartTaskInput', () => ({
  SmartTaskInput: () => (
    <div data-testid="smart-task-input">SmartTaskInput</div>
  ),
}));

vi.mock('@/components/tasks/TaskAnalyticsSummary', () => ({
  TaskAnalyticsSummary: () => (
    <div data-testid="task-analytics">TaskAnalyticsSummary</div>
  ),
}));

describe('LeftPane Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentView: 'calendar',
    });

    (useTaskManagement as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      tasks: [],
      tasksLoading: false,
      addTask: { isPending: false },
      handleAddTask: vi.fn(),
      handleToggleTask: vi.fn(),
      handleEditTask: vi.fn(),
      handleDeleteTask: vi.fn(),
      handleScheduleTask: vi.fn(),
      handleRemoveTag: vi.fn(),
      taskGroups: [],
      activeTaskGroupId: 'all',
      showCreateTaskDialog: false,
      setShowCreateTaskDialog: vi.fn(),
      handleAddTaskGroup: vi.fn(),
      handleEditTaskGroup: vi.fn(),
      handleCreateTaskGroup: vi.fn(),
      handleSelectTaskGroup: vi.fn(),
      handleUpdateTaskGroupIcon: vi.fn(),
      handleUpdateTaskGroupColor: vi.fn(),
      handleDeleteTaskGroup: vi.fn(),
      handleOpenCreateTaskDialog: vi.fn(),
    });

    (
      useCalendarManagement as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      calendars: [],
      calendarsLoading: false,
      handleToggleCalendar: vi.fn(),
      handleAddCalendar: vi.fn(),
      handleEditCalendar: vi.fn(),
      handleDeleteCalendar: vi.fn(),
    });

    (useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      calendarViewInputExpanded: true,
      toggleCalendarViewInput: vi.fn(),
      taskViewMiniCalendarExpanded: true,
      toggleTaskViewMiniCalendar: vi.fn(),
      leftSmartInputTaskListId: null,
      setLeftSmartInputTaskListId: vi.fn(),
      showSidebarTaskAnalytics: false,
    });
  });

  it('renders task list and calendar list in calendar view', async () => {
    render(<LeftPane />);

    expect(await screen.findByTestId('task-list')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-list')).toBeInTheDocument();
    expect(screen.queryByTestId('event-overview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-group-list')).not.toBeInTheDocument();
  });

  it('renders event overview and task group list in task view', async () => {
    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentView: 'task',
    });

    (useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      calendarViewInputExpanded: false,
      toggleCalendarViewInput: vi.fn(),
      taskViewMiniCalendarExpanded: true,
      toggleTaskViewMiniCalendar: vi.fn(),
      leftSmartInputTaskListId: null,
      setLeftSmartInputTaskListId: vi.fn(),
      showSidebarTaskAnalytics: true,
    });

    render(<LeftPane />);

    expect(screen.getByTestId('event-overview')).toBeInTheDocument();
    expect(screen.getByTestId('task-group-list')).toBeInTheDocument();
    expect(await screen.findByTestId('task-analytics')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-list')).not.toBeInTheDocument();
  });

  it('renders SmartTaskInput in calendar view when expanded', async () => {
    render(<LeftPane />);

    expect(await screen.findByTestId('smart-task-input')).toBeInTheDocument();
  });
});
