/**
 * Tests for TaskInput component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TaskInput } from '../TaskInput';
import { taskStorage } from '../../../utils/storage';

// Mock the storage utility
vi.mock('../../../utils/storage', () => ({
  taskStorage: {
    getTasks: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123',
}));

const mockTaskStorage = taskStorage as any;

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderTaskInput = (props = {}) => {
  const Wrapper = createWrapper();
  return render(
    <Wrapper>
      <TaskInput {...props} />
    </Wrapper>
  );
};

describe('TaskInput Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTaskStorage.addTask.mockResolvedValue(true);
  });

  it('should render with default placeholder', () => {
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    expect(input).toBeInTheDocument();
  });

  it('should render with custom placeholder', () => {
    renderTaskInput({ placeholder: 'Custom placeholder' });
    
    const input = screen.getByPlaceholderText('Custom placeholder');
    expect(input).toBeInTheDocument();
  });

  it('should focus input when autoFocus is true', () => {
    renderTaskInput({ autoFocus: true });
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    expect(input).toHaveFocus();
  });

  it('should create a task when form is submitted', async () => {
    const user = userEvent.setup();
    const onTaskCreated = vi.fn();
    
    renderTaskInput({ onTaskCreated });
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Type a task title
    await user.type(input, 'New test task');
    
    // Submit the form
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(mockTaskStorage.addTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-123',
          title: 'New test task',
          completed: false,
        })
      );
    });
    
    // Input should be cleared after successful creation
    expect(input).toHaveValue('');
    
    // Callback should be called
    await waitFor(() => {
      expect(onTaskCreated).toHaveBeenCalledWith('test-uuid-123');
    });
  });

  it('should show validation error for empty task', async () => {
    const user = userEvent.setup();
    
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Try to submit empty form
    await user.click(input);
    await user.keyboard('{Enter}');
    
    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    
    // Should not call storage
    expect(mockTaskStorage.addTask).not.toHaveBeenCalled();
  });

  it('should show validation error for whitespace-only task', async () => {
    const user = userEvent.setup();
    
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Type only whitespace
    await user.type(input, '   ');
    await user.keyboard('{Enter}');
    
    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    
    expect(mockTaskStorage.addTask).not.toHaveBeenCalled();
  });

  it('should clear input and error when Escape is pressed', async () => {
    const user = userEvent.setup();
    
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Type some text
    await user.type(input, 'Some text');
    
    // Trigger validation error
    await user.clear(input);
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    
    // Type again and press Escape
    await user.type(input, 'New text');
    await user.keyboard('{Escape}');
    
    // Input should be cleared and error should be gone
    expect(input).toHaveValue('');
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it('should clear error when user starts typing', async () => {
    const user = userEvent.setup();
    
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Trigger validation error
    await user.keyboard('{Enter}');
    
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
    
    // Start typing
    await user.type(input, 'N');
    
    // Error should be cleared
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it('should show loading state during task creation', async () => {
    const user = userEvent.setup();
    
    // Make addTask return a pending promise
    let resolveAddTask: (value: boolean) => void;
    const addTaskPromise = new Promise<boolean>((resolve) => {
      resolveAddTask = resolve;
    });
    mockTaskStorage.addTask.mockReturnValue(addTaskPromise);
    
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Type and submit
    await user.type(input, 'Test task');
    await user.keyboard('{Enter}');
    
    // Should show loading indicator
    await waitFor(() => {
      const spinner = screen.getByRole('generic', { hidden: true });
      expect(spinner).toHaveClass('animate-spin');
    });
    
    // Input should be disabled
    expect(input).toBeDisabled();
    
    // Resolve the promise
    resolveAddTask!(true);
    
    // Loading should disappear
    await waitFor(() => {
      expect(screen.queryByRole('generic', { hidden: true })).not.toBeInTheDocument();
    });
  });

  it('should handle task creation failure', async () => {
    const user = userEvent.setup();
    
    // Make addTask fail
    mockTaskStorage.addTask.mockRejectedValue(new Error('Storage failed'));
    
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Type and submit
    await user.type(input, 'Test task');
    await user.keyboard('{Enter}');
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Storage failed/i)).toBeInTheDocument();
    });
    
    // Input should not be cleared on failure
    expect(input).toHaveValue('Test task');
  });

  it('should validate on blur', async () => {
    const user = userEvent.setup();
    
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Type invalid content and blur
    await user.type(input, '   ');
    await user.tab(); // This will blur the input
    
    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });

  it('should not validate empty input on blur', async () => {
    const user = userEvent.setup();
    
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    // Focus and blur without typing
    await user.click(input);
    await user.tab();
    
    // Should not show validation error for empty input on blur
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    renderTaskInput();
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    expect(input).toHaveAttribute('aria-label', 'New task title');
    expect(input).toHaveAttribute('type', 'text');
    
    // Submit button should be present but hidden
    const submitButton = screen.getByLabelText('Create task');
    expect(submitButton).toHaveClass('sr-only');
  });

  it('should show keyboard shortcuts hint', () => {
    renderTaskInput();
    
    expect(screen.getByText(/Press/)).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = renderTaskInput({ className: 'custom-class' });
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});