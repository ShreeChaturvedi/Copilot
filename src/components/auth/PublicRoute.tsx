import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useGuestOnly } from '@/hooks/useAuthGuard';

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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (shouldRedirect && redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}