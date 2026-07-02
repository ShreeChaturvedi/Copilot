import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const passwordsMatch = confirm.length > 0 && confirm === password;
  const missingToken = useMemo(() => token.trim().length === 0, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    // Mirror the backend rules (min 8, upper, lower, number, special char) for a
    // fast, local error before hitting the network.
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(
        password
      )
    ) {
      setError(
        'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authAPI.confirmPasswordReset(token, password);
      if (result.success) {
        setDone(true);
      } else {
        setError(
          result.message ||
            'Could not reset your password. The link may have expired.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/login');
  };

  const handleRequestNew = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/forgot-password');
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <div className="grid gap-1.5">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">
          Choose a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter a new password for your account.
        </p>
      </div>
      {missingToken ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-destructive" role="alert">
            This password reset link is missing its token. Please request a new
            reset link.
          </p>
          <Button type="button" className="w-full" onClick={handleRequestNew}>
            Request a new link
          </Button>
        </div>
      ) : done ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground" role="status">
            Your password has been reset. You can now sign in with your new
            password.
          </p>
          <Button type="button" className="w-full" onClick={handleBackToLogin}>
            Go to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-invalid={confirm.length > 0 && !passwordsMatch}
                required
              />
              {confirm.length > 0 && (
                <p
                  className={cn(
                    'text-xs',
                    passwordsMatch ? 'text-success' : 'text-destructive'
                  )}
                >
                  {passwordsMatch
                    ? 'Passwords match'
                    : 'Passwords do not match'}
                </p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Resetting...' : 'Reset password'}
            </Button>
          </div>
          <div className="mt-5 text-center text-sm text-muted-foreground">
            <a
              href="/login"
              onClick={handleBackToLogin}
              className="text-foreground underline underline-offset-4"
            >
              Back to sign in
            </a>
          </div>
        </form>
      )}
    </div>
  );
}

export function ResetPasswordPage() {
  return (
    <div className="auth-card w-full max-w-[400px] p-8 max-sm:p-6">
      <ResetPasswordForm />
    </div>
  );
}
