import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AuthCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * The one machined card every auth screen renders inside `AuthLayout`'s room.
 * Replaces the identical literal `<div className="auth-card ...">` wrapper
 * that was previously copy-pasted across Login/Signup/ForgotPassword/
 * ResetPassword (auth.md §1.3) — and gives GoogleCallback somewhere correct
 * to go instead of rolling its own frosted-glass card.
 */
export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <div
      className={cn('auth-card w-full max-w-[400px] p-8 max-sm:p-6', className)}
    >
      {children}
    </div>
  );
}
