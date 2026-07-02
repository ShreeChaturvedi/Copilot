import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { authAPI } from '@/services/api/auth';

export interface UseAuthGuardOptions {
  requireAuth?: boolean;
  redirectTo?: string;
  checkTokenValidity?: boolean;
}

export interface AuthGuardState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  shouldRedirect: boolean;
  redirectPath: string | null;
}

/**
 * Hook for protecting routes and managing authentication state
 */
export function useAuthGuard(
  options: UseAuthGuardOptions = {}
): AuthGuardState {
  const {
    requireAuth = true,
    redirectTo = '/login',
    checkTokenValidity = true,
  } = options;

  const [state, setState] = useState<AuthGuardState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    shouldRedirect: false,
    redirectPath: null,
  });

  const {
    isAuthenticated,
    authMethod,
    user,
    jwtTokens,
    googleUser,
    isTokenExpired,
    refreshTokenIfNeeded,
    clearJWTAuth,
    clearGoogleAuth,
    setError,
  } = useAuthStore();

  const hasLoggedMockSkipRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        // If not authenticated and auth is required, redirect
        if (!isAuthenticated && requireAuth) {
          if (isMounted) {
            setState({
              isLoading: false,
              isAuthenticated: false,
              user: null,
              shouldRedirect: true,
              redirectPath: redirectTo,
            });
          }
          return;
        }

        // If not authenticated and auth is not required, allow access
        if (!isAuthenticated && !requireAuth) {
          if (isMounted) {
            setState({
              isLoading: false,
              isAuthenticated: false,
              user: null,
              shouldRedirect: false,
              redirectPath: null,
            });
          }
          return;
        }

        // If authenticated, check token validity if requested
        if (isAuthenticated && checkTokenValidity) {
          // Check if the access token is fully expired
          if (isTokenExpired()) {
            // A fully expired access token is recoverable while the refresh
            // token is still valid: attempt the exchange before giving up (#57).
            const canRecover =
              authMethod === 'jwt' && !!jwtTokens?.refreshToken;
            const recovered = canRecover ? await refreshTokenIfNeeded() : false;

            if (!recovered) {
              console.log('Token expired and not recoverable, clearing auth');
              if (authMethod === 'jwt') {
                clearJWTAuth();
              } else if (authMethod === 'google') {
                clearGoogleAuth();
              }

              if (requireAuth) {
                if (isMounted) {
                  setState({
                    isLoading: false,
                    isAuthenticated: false,
                    user: null,
                    shouldRedirect: true,
                    redirectPath: redirectTo,
                  });
                }
              }
              return;
            }
          } else if (authMethod === 'jwt') {
            // Not expired yet: refresh proactively while "expiring soon"
            const refreshSuccess = await refreshTokenIfNeeded();
            if (!refreshSuccess && requireAuth) {
              if (isMounted) {
                setState({
                  isLoading: false,
                  isAuthenticated: false,
                  user: null,
                  shouldRedirect: true,
                  redirectPath: redirectTo,
                });
              }
              return;
            }
          }

          // Verify token with backend (optional, can be expensive)
          // Read tokens from the store, not the render closure: the refresh
          // above may have just rotated them.
          const currentTokens = useAuthStore.getState().jwtTokens;
          // Skip verification for mock tokens in development
          const isMockToken =
            currentTokens?.accessToken === 'mock-access-token';
          if (authMethod === 'jwt' && currentTokens && !isMockToken) {
            try {
              const verification = await authAPI.verifyToken(
                currentTokens.accessToken
              );
              if (!verification.valid) {
                console.log('Token verification failed, clearing auth');
                clearJWTAuth();
                setError('Session expired. Please log in again.');

                if (requireAuth) {
                  if (isMounted) {
                    setState({
                      isLoading: false,
                      isAuthenticated: false,
                      user: null,
                      shouldRedirect: true,
                      redirectPath: redirectTo,
                    });
                  }
                  return;
                }
              }
            } catch (error) {
              console.error('Token verification error:', error);
              // Don't clear auth on network errors, just log
            }
          } else if (isMockToken) {
            // Reduce noisy logs in dev; log only once per mount/session
            if (
              process.env.NODE_ENV !== 'production' &&
              !hasLoggedMockSkipRef.current
            ) {
              console.debug(
                'Mock token detected, skipping backend verification'
              );
              hasLoggedMockSkipRef.current = true;
            }
          }
        }

        // All checks passed, user is authenticated
        if (isMounted) {
          setState({
            isLoading: false,
            isAuthenticated: true,
            user: authMethod === 'jwt' ? user : googleUser,
            shouldRedirect: false,
            redirectPath: null,
          });
        }
      } catch (error) {
        console.error('Auth guard error:', error);
        if (isMounted) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
            shouldRedirect: requireAuth,
            redirectPath: requireAuth ? redirectTo : null,
          });
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [
    isAuthenticated,
    authMethod,
    user,
    googleUser,
    jwtTokens,
    requireAuth,
    redirectTo,
    checkTokenValidity,
    isTokenExpired,
    refreshTokenIfNeeded,
    clearJWTAuth,
    clearGoogleAuth,
    setError,
  ]);

  return state;
}

/**
 * Hook for routes that require authentication
 */
export function useRequireAuth(redirectTo = '/login') {
  return useAuthGuard({
    requireAuth: true,
    redirectTo,
    checkTokenValidity: true,
  });
}

/**
 * Hook for routes that should redirect if user is already authenticated (like login/signup pages)
 */
export function useGuestOnly(redirectTo = '/') {
  const authGuardState = useAuthGuard({
    requireAuth: false,
    checkTokenValidity: true,
  });

  return {
    ...authGuardState,
    shouldRedirect: authGuardState.isAuthenticated,
    redirectPath: authGuardState.isAuthenticated ? redirectTo : null,
  };
}

/**
 * Hook for public routes that don't require authentication but should still check token validity
 */
export function useOptionalAuth() {
  return useAuthGuard({
    requireAuth: false,
    checkTokenValidity: true,
  });
}
