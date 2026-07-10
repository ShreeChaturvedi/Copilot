import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useRequireAuth } from '@/hooks/useAuthGuard';
import { AuthGuardSpinner } from './AuthGuardSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component that protects routes requiring authentication
 */
export function ProtectedRoute({
  children,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const location = useLocation();
  const { isLoading, isAuthenticated, shouldRedirect, redirectPath } =
    useRequireAuth(redirectTo);

  if (isLoading) {
    return <AuthGuardSpinner label="Verifying your session..." />;
  }

  // Remember where the user was headed so the login flow can send them back
  // there instead of dumping them on the dashboard (#14).
  if (shouldRedirect && redirectPath) {
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
