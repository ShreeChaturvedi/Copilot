import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { googleRedirectUri } from '@/lib/urls';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GoogleIcon } from '@/components/auth';
import { AlertCircle, Eye, EyeOff, Lock, Mail } from 'lucide-react';

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const navigate = useNavigate();
  const setJWTAuth = useAuthStore((s) => s.setJWTAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authAPI.login({ email, password });
      if (result.success && result.data) {
        const { accessToken, refreshToken, expiresAt, user } = result.data;
        setJWTAuth({ accessToken, refreshToken, expiresAt }, user);
        navigate('/');
      } else {
        setError(
          result.message || 'Sign in failed. Check your email and password.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/signup');
  };

  const handleForgotPasswordLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/forgot-password');
  };

  const handleGoogleLogin = () => {
    const redirectUri = googleRedirectUri();
    const url = authAPI.getGoogleAuthUrl(redirectUri);
    window.location.href = url;
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <h1 className="text-xl font-semibold tracking-[-0.01em]">Sign in</h1>
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5">
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
            <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              <a
                href="/forgot-password"
                onClick={handleForgotPasswordLink}
                className="ml-auto inline-block text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"
              >
                Forgot your password?
              </a>
            </div>
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
                autoComplete="current-password"
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
            {/* The one aqua primary in the room (design-brief §4.8) */}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
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
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </Button>
          </div>
        </div>
        <div className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a
            href="/signup"
            onClick={handleSignupLink}
            className="text-foreground underline underline-offset-4"
          >
            Sign up
          </a>
        </div>
      </form>
    </div>
  );
}
