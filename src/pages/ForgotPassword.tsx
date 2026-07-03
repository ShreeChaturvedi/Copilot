import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthCard, AuthStatus } from '@/components/auth';
import { AlertCircle, Mail } from 'lucide-react';

function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await authAPI.requestPasswordReset(email);
      if (result.success) {
        // Always show the same confirmation: the response never reveals
        // whether the email is registered.
        setSubmitted(true);
      } else {
        setError(result.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/login');
  };

  if (submitted) {
    return (
      <div className={cn('flex flex-col gap-6', className)} {...props}>
        <AuthStatus
          variant="success"
          title="Check your inbox"
          description="If an account exists for that email, a password reset link has been sent. Check your inbox and follow the link to choose a new password."
          action={
            <Button
              type="button"
              className="w-full"
              onClick={handleBackToLogin}
            >
              Back to sign in
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
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we will send you a link to reset your password.
        </p>
      </div>
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
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </Button>
        </div>
        <div className="mt-5 text-center text-sm text-muted-foreground">
          Remembered your password?{' '}
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

export function ForgotPasswordPage() {
  return (
    <AuthCard>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
