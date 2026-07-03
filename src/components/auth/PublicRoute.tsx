import React from 'react';
import { Navigate } from 'react-router-dom';
import { useGuestOnly } from '@/hooks/useAuthGuard';
import { AuthGuardSpinner } from './AuthGuardSpinner';

interface PublicRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Component for public routes that redirect authenticated users (like login/signup)
 */
export function PublicRoute({ children, redirectTo = '/' }: PublicRouteProps) {
  const { isLoading, shouldRedirect, redirectPath } = useGuestOnly(redirectTo);

  if (isLoading) {
    return <AuthGuardSpinner label="Loading..." />;
  }

  if (shouldRedirect && redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
