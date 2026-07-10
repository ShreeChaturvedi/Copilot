import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { QueryProvider, ThemeProvider } from './components/providers';
import { ProtectedRoute, PublicRoute, AuthLayout } from './components/auth';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import {
  Component,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';

/**
 * Top-level error boundary. React 19 does not auto-recover from a render throw:
 * without this, any uncaught exception in a route/component (a malformed date,
 * a schema-drift undefined, a bad FullCalendar render) unmounts the whole tree
 * to a blank white page. This catches it and offers a tokenized recovery path.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-4">
          <h1 className="font-serif text-2xl text-foreground">
            Something broke on our end.
          </h1>
          <p className="text-sm text-muted-foreground">
            The view hit an unexpected error. Reloading usually clears it.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-[10px] border border-border bg-popover px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-[10px] bg-foreground px-4 py-2 text-sm text-background transition-opacity hover:opacity-90"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Minimal branded entry fallback so app boot (or a failed lazy chunk retry)
// never flashes a blank white screen.
const AppLoading = () => (
  <div className="flex h-dvh w-full items-center justify-center bg-background">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-aqua" />
  </div>
);

const MainLayout = lazy(async () => ({
  default: (await import('./components/layout/MainLayout')).MainLayout,
}));
const LoginPage = lazy(async () => ({
  default: (await import('./pages/Login')).LoginPage,
}));
const SignupPage = lazy(async () => ({
  default: (await import('./pages/Signup')).SignupPage,
}));
const GoogleCallbackPage = lazy(async () => ({
  default: (await import('./pages/GoogleCallback')).GoogleCallbackPage,
}));
const ForgotPasswordPage = lazy(async () => ({
  default: (await import('./pages/ForgotPassword')).ForgotPasswordPage,
}));
const ResetPasswordPage = lazy(async () => ({
  default: (await import('./pages/ResetPassword')).ResetPasswordPage,
}));

// Development mode toggle component
const DevAuthToggle = () => {
  const { setJWTAuth, logout, isAuthenticated, authMethod } = useAuthStore();

  // Position and drag state. Default to bottom-right so the panel never covers
  // the calendar header nav. Key is versioned so stale top-right positions from
  // older dev profiles reset instead of resurrecting the overlap.
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('dev-toggle-position-v2');
    return saved
      ? JSON.parse(saved)
      : { x: window.innerWidth - 220, y: window.innerHeight - 130 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMockLogin = () => {
    // Create mock user data for testing
    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour from now
    };

    const mockUser = {
      id: 'mock-user-123',
      email: 'developer@example.com',
      name: 'Dev User',
      picture: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setJWTAuth(mockTokens, mockUser);
  };

  // Boundary checking helper
  const constrainToBounds = (x: number, y: number) => {
    const boxWidth = 200; // Approximate width
    const boxHeight = 120; // Approximate height
    const margin = 10;

    const constrainedX = Math.max(
      margin,
      Math.min(window.innerWidth - boxWidth - margin, x)
    );
    const constrainedY = Math.max(
      margin,
      Math.min(window.innerHeight - boxHeight - margin, y)
    );

    return { x: constrainedX, y: constrainedY };
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();

    const rect = (panelRef.current ?? e.currentTarget).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();

    const rect = (panelRef.current ?? e.currentTarget).getBoundingClientRect();
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    setIsDragging(true);
  };

  // Global mouse/touch move and end handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = constrainToBounds(
        e.clientX - dragOffset.x,
        e.clientY - dragOffset.y
      );
      setPosition(newPosition);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const newPosition = constrainToBounds(
        touch.clientX - dragOffset.x,
        touch.clientY - dragOffset.y
      );
      setPosition(newPosition);
    };

    const handleEnd = () => {
      setIsDragging(false);
      // Save position to localStorage
      localStorage.setItem('dev-toggle-position-v2', JSON.stringify(position));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, position]);

  return (
    <div
      ref={panelRef}
      className={`fixed z-50 bg-yellow-100 dark:bg-yellow-900 p-3 rounded-lg border border-yellow-300 dark:border-yellow-700 shadow-lg select-none transition-opacity ${
        isDragging ? 'opacity-75' : 'hover:shadow-xl'
      }`}
      style={{
        left: position.x,
        top: position.y,
        touchAction: 'none',
      }}
    >
      {/* Only the title bar is a drag handle, so the panel body no longer
          swallows clicks aimed at anything it happens to overlap. */}
      <div
        className={`text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-2 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        🚧 DEV MODE {isDragging && '(dragging)'}
      </div>
      <div className="flex flex-col gap-2 text-xs">
        <div className="text-yellow-700 dark:text-yellow-300 pointer-events-none">
          Auth Status:{' '}
          {isAuthenticated ? `✅ ${authMethod}` : '❌ Not authenticated'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleMockLogin}
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 pointer-events-auto"
            disabled={isAuthenticated}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            Mock Login
          </button>
          <button
            onClick={() => logout()}
            className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 pointer-events-auto"
            disabled={!isAuthenticated}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [showDevToggle, setShowDevToggle] = useState(false);
  // Toasts follow the in-app theme control, not the OS (#68 companion):
  // the app's dark class is driven by themeStore, so the Toaster must be too.
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  useEffect(() => {
    // Show dev toggle in development mode
    if (import.meta.env.DEV) {
      setShowDevToggle(true);
    }
  }, []);

  return (
    <QueryProvider>
      <ThemeProvider>
        {/* Honor the OS prefers-reduced-motion for every framer-motion
            animation in one place (design-brief §5): scale/slide degrade to
            opacity-only. The CSS keyframes already guard themselves. */}
        <MotionConfig reducedMotion="user">
          <Router basename="/app">
            {/* Development auth toggle */}
            {showDevToggle && <DevAuthToggle />}
            <Toaster
              position="top-right"
              closeButton
              theme={resolvedTheme}
              toastOptions={{
                classNames: {
                  // Feedback chrome on tokens (design-brief 2.3): success and
                  // "placed" are aqua, red only for errors.
                  toast:
                    'rounded-[10px] [box-shadow:var(--shadow-popover)] border border-border text-foreground bg-popover',
                  description: 'text-muted-foreground',
                  success:
                    'bg-success text-success-foreground border-transparent',
                  error: 'bg-destructive text-white border-transparent',
                  warning:
                    'bg-warning text-warning-foreground border-transparent',
                },
              }}
            />
            <ErrorBoundary>
              <Suspense fallback={<AppLoading />}>
                <Routes>
                  {/* Public routes */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <AuthLayout>
                          <LoginPage />
                        </AuthLayout>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/signup"
                    element={
                      <PublicRoute>
                        <AuthLayout>
                          <SignupPage />
                        </AuthLayout>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/forgot-password"
                    element={
                      <PublicRoute>
                        <AuthLayout>
                          <ForgotPasswordPage />
                        </AuthLayout>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/reset-password"
                    element={
                      <PublicRoute>
                        <AuthLayout>
                          <ResetPasswordPage />
                        </AuthLayout>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/auth/google/callback"
                    element={<GoogleCallbackPage />}
                  />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <MainLayout />
                      </ProtectedRoute>
                    }
                  />

                  {/* Redirect to login for unknown routes */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </Router>
        </MotionConfig>
      </ThemeProvider>
    </QueryProvider>
  );
}

export default App;
