import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeProvider } from '../ThemeProvider';

// Mock the theme store
const mockInitializeTheme = vi.fn();

vi.mock('../../../stores/themeStore', () => ({
  useThemeStore: () => ({
    initializeTheme: mockInitializeTheme,
  }),
}));

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize theme on mount', () => {
    render(
      <ThemeProvider>
        <div>Test content</div>
      </ThemeProvider>
    );

    expect(mockInitializeTheme).toHaveBeenCalledOnce();
  });

  it('should render children correctly', () => {
    const { container } = render(
      <ThemeProvider>
        <div data-testid="test-content">Test content</div>
      </ThemeProvider>
    );

    expect(container.querySelector('[data-testid="test-content"]')).toBeInTheDocument();
  });
}); 