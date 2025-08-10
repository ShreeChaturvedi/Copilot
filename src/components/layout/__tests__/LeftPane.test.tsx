import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { LeftPane } from '../LeftPane';

describe('LeftPane Component', () => {
  const user = userEvent.setup();

  it('should render main structure', () => {
    render(<LeftPane />);
    
    expect(screen.getByText('Calendar & Tasks')).toBeInTheDocument();
    expect(screen.getByText('Quick Add Task')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Calendars')).toBeInTheDocument();
  });

  it('should render task input section', () => {
    render(<LeftPane />);
    
    const taskInput = screen.getByPlaceholderText('Enter a new task...');
    expect(taskInput).toBeInTheDocument();
    expect(taskInput).toHaveClass('w-full');
  });

  it('should render tasks section with empty state', () => {
    render(<LeftPane />);
    
    expect(screen.getByText('No tasks yet. Add one above!')).toBeInTheDocument();
    expect(screen.getByText('Show completed')).toBeInTheDocument();
  });

  it('should render calendars section', () => {
    render(<LeftPane />);
    
    const addButton = screen.getByRole('button', { name: 'Add new calendar' });
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveTextContent('+ Add');
    
    const defaultCalendar = screen.getByLabelText('My Calendar');
    expect(defaultCalendar).toBeInTheDocument();
    expect(defaultCalendar).toBeChecked();
  });

  it('should render settings section', () => {
    render(<LeftPane />);
    
    const settingsButton = screen.getByText('⚙️ Settings');
    expect(settingsButton).toBeInTheDocument();
    expect(settingsButton.tagName).toBe('BUTTON');
  });

  it('should have proper layout structure', () => {
    render(<LeftPane />);
    
    const container = screen.getByText('Calendar & Tasks').closest('.h-full');
    expect(container).toHaveClass('h-full', 'flex', 'flex-col');
  });

  it('should have scrollable content area', () => {
    render(<LeftPane />);
    
    const contentArea = screen.getByText('Quick Add Task').closest('.flex-1');
    expect(contentArea).toHaveClass('flex-1', 'overflow-y-auto');
  });

  it('should handle task input interactions', async () => {
    render(<LeftPane />);
    
    const taskInput = screen.getByPlaceholderText('Enter a new task...');
    await user.type(taskInput, 'New task');
    
    expect(taskInput).toHaveValue('New task');
  });

  it('should handle calendar checkbox interactions', async () => {
    render(<LeftPane />);
    
    const calendarCheckbox = screen.getByLabelText('My Calendar');
    expect(calendarCheckbox).toBeChecked();
    
    await user.click(calendarCheckbox);
    expect(calendarCheckbox).not.toBeChecked();
  });

  it('should handle show completed tasks button', async () => {
    render(<LeftPane />);
    
    const showCompletedButton = screen.getByText('Show completed');
    expect(showCompletedButton).toBeInTheDocument();
    
    await user.click(showCompletedButton);
    // Button should be clickable (no error thrown)
  });

  it('should handle add calendar button', async () => {
    render(<LeftPane />);
    
    const addCalendarButton = screen.getByRole('button', { name: 'Add new calendar' });
    await user.click(addCalendarButton);
    // Button should be clickable (no error thrown)
  });

  it('should handle settings button', async () => {
    render(<LeftPane />);
    
    const settingsButton = screen.getByText('⚙️ Settings');
    await user.click(settingsButton);
    // Button should be clickable (no error thrown)
  });


  it('should have proper accessibility attributes', () => {
    render(<LeftPane />);
    
    const taskInput = screen.getByPlaceholderText('Enter a new task...');
    expect(taskInput).toHaveAttribute('type', 'text');
    
    const calendarCheckbox = screen.getByLabelText('My Calendar');
    expect(calendarCheckbox).toHaveAttribute('type', 'checkbox');
    expect(calendarCheckbox).toHaveAttribute('id', 'default-calendar');
  });

  it('should have proper dark mode classes', () => {
    render(<LeftPane />);
    
    const header = screen.getByText('Calendar & Tasks');
    expect(header).toHaveClass('text-gray-900', 'dark:text-gray-100');
    
    const taskInput = screen.getByPlaceholderText('Enter a new task...');
    expect(taskInput).toHaveClass('dark:bg-gray-700', 'dark:text-gray-100');
  });

  it('should have proper section spacing', () => {
    render(<LeftPane />);
    
    const contentContainer = screen.getByText('Quick Add Task').closest('.space-y-6');
    expect(contentContainer).toHaveClass('space-y-6');
    
    const padding = screen.getByText('Quick Add Task').closest('.p-4');
    expect(padding).toHaveClass('p-4');
  });

  it('should have proper border styling', () => {
    render(<LeftPane />);
    
    const header = screen.getByText('Calendar & Tasks').closest('.border-b');
    expect(header).toHaveClass('border-b', 'border-gray-200', 'dark:border-gray-700');
    
    const settingsSection = screen.getByText('⚙️ Settings').closest('.border-t');
    expect(settingsSection).toHaveClass('border-t', 'border-gray-200', 'dark:border-gray-700');
  });

  it('should display calendar color indicator', () => {
    render(<LeftPane />);
    
    const colorIndicator = screen.getByLabelText('My Calendar').parentElement?.querySelector('.bg-blue-500');
    expect(colorIndicator).toBeInTheDocument();
    expect(colorIndicator).toHaveClass('w-3', 'h-3', 'bg-blue-500', 'rounded-full');
  });
});