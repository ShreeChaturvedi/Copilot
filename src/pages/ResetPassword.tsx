import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthCard, AuthStatus } from '@/components/auth';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  if (missingToken) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <AuthStatus
          variant="error"
          title="Link incomplete"
          description="This password reset link is missing its token. Please request a new reset link."
          action={
            <Button type="button" className="w-full" onClick={handleRequestNew}>
              Request a new link
            </Button>
          }
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <AuthStatus
          variant="success"
          title="Password reset"
          description="Your password has been reset. You can now sign in with your new password."
          action={
            <Button
              type="button"
              className="w-full"
              onClick={handleBackToLogin}
            >
              Go to sign in
            </Button>
          }
        />
      </div>
    );
  }

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
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative group">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint transition-colors duration-150 group-focus-within:text-ink-muted"
                aria-hidden="true"
              />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
                className="pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint transition-colors duration-150 hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 rounded-sm active:scale-90"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <div className="relative group">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint transition-colors duration-150 group-focus-within:text-ink-muted"
                aria-hidden="true"
              />
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                aria-invalid={confirm.length > 0 && !passwordsMatch}
                required
                className="pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                aria-pressed={showConfirm}
                className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint transition-colors duration-150 hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1 rounded-sm active:scale-90"
              >
                {showConfirm ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {confirm.length > 0 && (
              <p
                className={cn(
                  'text-xs',
                  passwordsMatch ? 'text-success' : 'text-destructive'
                )}
              >
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </p>
            )}
          </div>
          {error && (
            <Alert
              variant="destructive"
              className="border-destructive/40 bg-destructive/10 animate-in fade-in slide-in-from-top-1 duration-150"
            >
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
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
    </div>
  );
}

export function ResetPasswordPage() {
  return (
    <AuthCard>
      <ResetPasswordForm />
    </AuthCard>
  );
}
