import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

function ResetPasswordForm({ className, ...props }: React.ComponentProps<'div'>) {
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
    // Mirror the backend rules (min 8, upper, lower, number) for a fast,
    // local error before hitting the network.
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      setError(
        'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.'
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
      <Card className="bg-transparent shadow-none border-transparent">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Enter a new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {missingToken ? (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-destructive" role="alert">
                This password reset link is missing its token. Please request a
                new reset link.
              </p>
              <Button
                type="button"
                variant="authPrimary"
                className="w-full cursor-glow-border transition-colors duration-200"
                onClick={handleRequestNew}
              >
                Request a new link
              </Button>
            </div>
          ) : done ? (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-muted-foreground" role="status">
                Your password has been reset. You can now sign in with your new
                password.
              </p>
              <Button
                type="button"
                variant="authPrimary"
                className="w-full cursor-glow-border transition-colors duration-200"
                onClick={handleBackToLogin}
              >
                Go to login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-3">
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
                <div className="grid gap-3">
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
                <Button
                  type="submit"
                  variant="authPrimary"
                  disabled={isSubmitting}
                  className="w-full cursor-glow-border transition-colors duration-200"
                >
                  {isSubmitting ? 'Resetting...' : 'Reset password'}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                <a
                  href="/login"
                  onClick={handleBackToLogin}
                  className="underline underline-offset-4"
                >
                  Back to login
                </a>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function ResetPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-md rounded-xl frosted-panel p-4 sm:p-6 md:p-8">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
