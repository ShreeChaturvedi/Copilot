import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/Calendar & Tasks/i)).toBeInTheDocument();
  });

  it('renders the main layout components', () => {
    render(<App />);
    
    // Check for left pane content - be more specific with queries
    expect(screen.getByText(/Quick Add Task/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Tasks/i })).toBeInTheDocument();
    expect(screen.getByText(/Calendars/i)).toBeInTheDocument();
    
    // Check for right pane content
    expect(screen.getByText(/Calendar View/i)).toBeInTheDocument();
    expect(screen.getByText(/Meeting Notes/i)).toBeInTheDocument();
    
    // Check for task input
    expect(screen.getByPlaceholderText(/Enter a new task.../i)).toBeInTheDocument();
  });
});
