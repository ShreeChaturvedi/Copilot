import React from 'react';
import { Navigate } from 'react-router-dom';
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
  const { isLoading, isAuthenticated, shouldRedirect, redirectPath } =
    useRequireAuth(redirectTo);

  if (isLoading) {
    return <AuthGuardSpinner label="Verifying your session..." />;
  }

  if (shouldRedirect && redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
