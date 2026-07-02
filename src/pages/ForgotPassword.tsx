import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/services/api/auth';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';

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
      {submitted ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted-foreground" role="status">
            If an account exists for that email, a password reset link has been
            sent. Check your inbox and follow the link to choose a new password.
          </p>
          <Button type="button" className="w-full" onClick={handleBackToLogin}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
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
      )}
    </div>
  );
}

export function ForgotPasswordPage() {
  return (
    <div className="auth-card w-full max-w-[400px] p-8 max-sm:p-6">
      <ForgotPasswordForm />
    </div>
  );
}
