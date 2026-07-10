import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { googleRedirectUri } from '@/lib/urls';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthCard, GoogleIcon } from '@/components/auth';
import {
  calculatePasswordStrength,
  getStrengthColor,
  getStrengthText,
  meetsAllRequirements,
} from '@/utils/passwordStrength';
import { useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { toUserMessage } from '@/utils/errorMessages';
import { useAuthStore } from '@/stores/authStore';
import { AlertCircle, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';

// The north-star check-glyph (UpcomingTasksEmpty's schedule-empty-check),
// shrunk to micro scale for the password-requirement checklist. Unmet state
// deliberately reuses the "etch" (unplaced) language — quiet ring, no fill —
// met state is the same aqua "resolved" badge the rest of the app reserves
// for done/placed states (foundation §1.6 rule 3, §4 signature move 2).
function RequirementCheck({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
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

function SignupForm({ className, ...props }: React.ComponentProps<'div'>) {
  const navigate = useNavigate();
  const location = useLocation();
  const setJWTAuth = useAuthStore((s) => s.setJWTAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = useMemo(
    () => calculatePasswordStrength(password),
    [password]
  );
  const passwordsMatch = confirm.length > 0 && confirm === password;
  // The single source of truth for "will the form accept this password?" —
  // shared with the submit gate and the meter clamp so the checklist, the bar,
  // and the button can never contradict each other (#4/#5/#9).
  const requirementsMet = meetsAllRequirements(strength.checks);
  const canSubmit = requirementsMet && passwordsMatch;
  // Never let the bar/label reach the aqua "confirmed" state until the form
  // will actually accept the password; below that, cap it at "Fair"/amber.
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
    // Gate on the same rule the strength checklist shows, so a green checklist
    // can never contradict a rejected submit (#4).
    if (!requirementsMet) {
      setError(
        'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authAPI.signup({ name, email, password });
      if (result.success && result.data) {
        const { accessToken, refreshToken, expiresAt, user } = result.data;
        setJWTAuth({ accessToken, refreshToken, expiresAt }, user);
        // Return to the originally intended destination if any (#14).
        const from = (location.state as { from?: { pathname?: string } } | null)
          ?.from?.pathname;
        navigate(from || '/', { replace: true });
      } else {
        setError(
          toUserMessage(
            result.message,
            'Could not create account. Please try again.'
          )
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSigninLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/login');
  };

  const handleGoogleSignup = () => {
    const redirectUri = googleRedirectUri();
    const url = authAPI.getGoogleAuthUrl(redirectUri);
    window.location.href = url;
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <h1 className="text-xl font-semibold tracking-[-0.01em]">
        Create your account
      </h1>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5">
          <div className="grid gap-2">
            <Label htmlFor="name">Full name</Label>
            <div className="relative group">
              <User
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint transition-colors duration-150 group-focus-within:text-ink-muted"
                aria-hidden="true"
              />
              <Input
                id="name"
                type="text"
                placeholder="Ada Lovelace"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
                required
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative group">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint transition-colors duration-150 group-focus-within:text-ink-muted"
                aria-hidden="true"
              />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
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
            {/* Strength bar + text */}
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
                {/* Requirements hints */}
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
            <Label htmlFor="confirmPassword">Confirm password</Label>
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
          <div className="flex flex-col gap-3">
            {/* The one aqua primary in the room (design-brief §4.8). Disabled
                until the password meets every rule and the confirm matches, so
                the gate and the meter agree before the user clicks (#5). */}
            <Button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="w-full"
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
            <div className="relative flex items-center py-1" aria-hidden="true">
              <div className="h-px flex-1 bg-hairline" />
              <span className="px-3 text-[0.75rem] font-medium uppercase tracking-[0.04em] text-ink-muted">
                Or
              </span>
              <div className="h-px flex-1 bg-hairline" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignup}
              disabled={isSubmitting}
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </Button>
          </div>
        </div>
        <div className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a
            href="/login"
            onClick={handleSigninLink}
            className="text-foreground underline underline-offset-4"
          >
            Sign in
          </a>
        </div>
      </form>
    </div>
  );
}

export function SignupPage() {
  return (
    <AuthCard>
      <SignupForm />
    </AuthCard>
  );
}
