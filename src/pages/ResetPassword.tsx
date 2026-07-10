import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { toUserMessage } from '@/utils/errorMessages';
import {
  calculatePasswordStrength,
  getStrengthColor,
  getStrengthText,
  meetsAllRequirements,
} from '@/utils/passwordStrength';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthCard, AuthStatus } from '@/components/auth';
import { AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';

// Mirrors Signup's password-requirement glyph so the reset screen gives the
// same live guidance while the user invents a new compliant password (#17).
function RequirementCheck({
  met,
  children,
}: {
  met: boolean;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={cn(
          'shrink-0 transition-[opacity,transform] duration-100 ease-settle',
          met && 'scale-110'
        )}
      >
        <circle
          cx="6"
          cy="6"
          r="5"
          className={
            met
              ? 'fill-aqua-film-08 stroke-aqua'
              : 'fill-none stroke-etch-strong'
          }
          strokeWidth="1.25"
        />
        {met && (
          <path
            d="M3.5 6 l1.6 1.8 l3.2 -3.8"
            fill="none"
            stroke="var(--aqua)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {children}
    </span>
  );
}

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

  const strength = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );
  // Same source of truth for gate, meter clamp, and submit button (#4/#5/#9).
  const requirementsMet = meetsAllRequirements(strength.checks);
  const canSubmit = requirementsMet && passwordsMatch;
  const meterStrength = requirementsMet ? strength.strength : 'fair';
  const meterWidth = requirementsMet
    ? strength.score / 4
    : Math.min(strength.score, 2) / 4;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    // Gate on the same rule the strength checklist shows (#4).
    if (!requirementsMet) {
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
          toUserMessage(
            result.message,
            'Could not reset your password. The link may have expired.'
          )
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
                aria-describedby="password-requirements"
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
            {/* Strength bar + live requirement checklist (parity with Signup, #17) */}
            {password.length > 0 && (
              <div id="password-requirements">
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-[width,background-color] duration-150 ease-settle',
                        getStrengthColor(meterStrength)
                      )}
                      style={{ width: `${meterWidth * 100}%` }}
                    />
                  </div>
                  <span
                    className="text-xs text-muted-foreground min-w-16 text-right"
                    aria-live="polite"
                  >
                    {getStrengthText(meterStrength)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1">
                  <RequirementCheck met={strength.checks.length}>
                    8+ characters
                  </RequirementCheck>
                  <RequirementCheck
                    met={strength.checks.uppercase && strength.checks.lowercase}
                  >
                    Upper & lower
                  </RequirementCheck>
                  <RequirementCheck met={strength.checks.numbers}>
                    Number
                  </RequirementCheck>
                  <RequirementCheck met={strength.checks.symbols}>
                    Symbol
                  </RequirementCheck>
                </div>
              </div>
            )}
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
                aria-describedby="confirm-password-msg"
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
                id="confirm-password-msg"
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
          <Button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="w-full"
          >
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
