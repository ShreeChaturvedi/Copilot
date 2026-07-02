/**
 * useAuthGuard behavior (test-audit §L4 / §6.8). Asserts the committed contract
 * as of fc21bdf: the guard resolves a redirect decision (shouldRedirect +
 * redirectPath) rather than navigating itself. An authenticated session with a
 * live token allows access; an unauthenticated one on a protected route asks to
 * redirect to /login; an optional-auth route allows an anonymous visitor.
 *
 * Uses the 'mock-access-token' sentinel the guard special-cases to skip the
 * backend /me verification, so these cases need no network.
 */
import {
  describe,
  it,
  expect,
  afterEach,
  beforeEach,
  vi,
} from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useAuthGuard,
  useRequireAuth,
  useOptionalAuth,
} from '../useAuthGuard';
import { useAuthStore, type User } from '@/stores/authStore';

const user: User = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function signInMock() {
  act(() =>
    useAuthStore.getState().setJWTAuth(
      {
        accessToken: 'mock-access-token',
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 60 * 60 * 1000,
      },
      user
    )
  );
}

beforeEach(() => {
  act(() => useAuthStore.getState().clearJWTAuth());
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('useAuthGuard', () => {
  it('redirects an unauthenticated visitor away from a protected route', async () => {
    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.shouldRedirect).toBe(true);
    expect(result.current.redirectPath).toBe('/login');
    expect(result.current.user).toBeNull();
  });

  it('allows an authenticated visitor and exposes the user', async () => {
    signInMock();
    const { result } = renderHook(() => useRequireAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.shouldRedirect).toBe(false);
    expect(result.current.redirectPath).toBeNull();
    expect(result.current.user?.email).toBe('ada@example.com');
  });

  it('honors a custom redirect target', async () => {
    const { result } = renderHook(() =>
      useAuthGuard({ requireAuth: true, redirectTo: '/welcome' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.shouldRedirect).toBe(true);
    expect(result.current.redirectPath).toBe('/welcome');
  });

  it('allows an anonymous visitor on an optional-auth route', async () => {
    const { result } = renderHook(() => useOptionalAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.shouldRedirect).toBe(false);
    expect(result.current.redirectPath).toBeNull();
  });
});
