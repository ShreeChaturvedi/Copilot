import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useThemeStore } from '../themeStore';

// Mock window.matchMedia
const mockMatchMedia = vi.fn();
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

// Mock document
const mockDocumentElement = {
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
};

const mockMetaThemeColor = {
  setAttribute: vi.fn(),
};

Object.defineProperty(document, 'documentElement', {
  writable: true,
  value: mockDocumentElement,
});

Object.defineProperty(document, 'querySelector', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMetaThemeColor),
});

describe('ThemeStore', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup default matchMedia mock
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    });
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useThemeStore.getState();
      
      expect(state.theme).toBe('system');
      expect(state.resolvedTheme).toBe('light');
    });
  });

  describe('Theme Setting', () => {
    it('should set light theme', () => {
      const { setTheme } = useThemeStore.getState();
      
      setTheme('light');
      
      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
      expect(state.resolvedTheme).toBe('light');
      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('dark');
    });

    it('should set dark theme', () => {
      const { setTheme } = useThemeStore.getState();
      
      setTheme('dark');
      
      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark');
    });

    it('should set system theme and resolve to light when system prefers light', () => {
      mockMatchMedia.mockReturnValue({
        matches: false, // System prefers light
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { setTheme } = useThemeStore.getState();
      
      setTheme('system');
      
      const state = useThemeStore.getState();
      expect(state.theme).toBe('system');
      expect(state.resolvedTheme).toBe('light');
      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith('dark');
    });

    it('should set system theme and resolve to dark when system prefers dark', () => {
      mockMatchMedia.mockReturnValue({
        matches: true, // System prefers dark
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { setTheme } = useThemeStore.getState();
      
      setTheme('system');
      
      const state = useThemeStore.getState();
      expect(state.theme).toBe('system');
      expect(state.resolvedTheme).toBe('dark');
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark');
    });
  });

  describe('Theme Toggle', () => {
    it('should toggle from light to dark', () => {
      const { setTheme, toggleTheme } = useThemeStore.getState();
      
      setTheme('light');
      toggleTheme();
      
      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
    });

    it('should toggle from dark to light', () => {
      const { setTheme, toggleTheme } = useThemeStore.getState();
      
      setTheme('dark');
      toggleTheme();
      
      const state = useThemeStore.getState();
      expect(state.theme).toBe('light');
      expect(state.resolvedTheme).toBe('light');
    });

    it('should toggle from system to opposite of resolved theme', () => {
      // Mock system preference as light
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { setTheme, toggleTheme } = useThemeStore.getState();
      
      setTheme('system'); // Should resolve to light
      expect(useThemeStore.getState().resolvedTheme).toBe('light');
      
      toggleTheme(); // Should toggle to dark
      
      const state = useThemeStore.getState();
      expect(state.theme).toBe('dark');
      expect(state.resolvedTheme).toBe('dark');
    });
  });

  describe('Theme Initialization', () => {
    it('should initialize theme and set up system theme listener', () => {
      const mockAddEventListener = vi.fn();
      const mockAddListener = vi.fn();
      
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
        addListener: mockAddListener,
        removeListener: vi.fn(),
      });

      const { initializeTheme } = useThemeStore.getState();
      
      initializeTheme();
      
      // Should set up event listener (modern browsers)
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should use fallback listener for older browsers', () => {
      const mockAddListener = vi.fn();
      
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: undefined, // Simulate older browser
        removeEventListener: vi.fn(),
        addListener: mockAddListener,
        removeListener: vi.fn(),
      });

      const { initializeTheme } = useThemeStore.getState();
      
      initializeTheme();
      
      // Should use fallback listener
      expect(mockAddListener).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Meta Theme Color', () => {
    it('should update meta theme-color for light theme', () => {
      const { setTheme } = useThemeStore.getState();
      
      setTheme('light');
      
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#ffffff');
    });

    it('should update meta theme-color for dark theme', () => {
      const { setTheme } = useThemeStore.getState();
      
      setTheme('dark');
      
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#1f2937');
    });
  });

  describe('System Theme Changes', () => {
    it('should respond to system theme changes when theme is system', () => {
      let systemChangeHandler: () => void;
      
      const mockAddEventListener = vi.fn((event, handler) => {
        if (event === 'change') {
          systemChangeHandler = handler;
        }
      });
      
      // Initially light system theme
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { setTheme, initializeTheme } = useThemeStore.getState();
      
      setTheme('system');
      initializeTheme();
      
      expect(useThemeStore.getState().resolvedTheme).toBe('light');
      
      // Simulate system theme change to dark
      mockMatchMedia.mockReturnValue({
        matches: true, // Now dark
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });
      
      // Trigger the system change handler
      systemChangeHandler!();
      
      expect(useThemeStore.getState().resolvedTheme).toBe('dark');
      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith('dark');
    });

    it('should not respond to system theme changes when theme is not system', () => {
      let systemChangeHandler: () => void;
      
      const mockAddEventListener = vi.fn((event, handler) => {
        if (event === 'change') {
          systemChangeHandler = handler;
        }
      });
      
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });

      const { setTheme, initializeTheme } = useThemeStore.getState();
      
      setTheme('light'); // Manual theme, not system
      initializeTheme();
      
      expect(useThemeStore.getState().resolvedTheme).toBe('light');
      
      // Simulate system theme change
      mockMatchMedia.mockReturnValue({
        matches: true,
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      });
      
      // Trigger the system change handler
      systemChangeHandler!();
      
      // Should still be light since we're not using system theme
      expect(useThemeStore.getState().resolvedTheme).toBe('light');
    });
  });
});