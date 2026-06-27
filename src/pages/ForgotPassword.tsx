import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useNavigate } from 'react-router-dom';
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
      <Card className="bg-transparent shadow-none border-transparent">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we will send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-muted-foreground" role="status">
                If an account exists for that email, a password reset link has
                been sent. Check your inbox and follow the link to choose a new
                password.
              </p>
              <Button
                type="button"
                variant="authPrimary"
                className="w-full cursor-glow-border transition-colors duration-200"
                onClick={handleBackToLogin}
              >
                Back to login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-3">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
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
                <Button
                  type="submit"
                  variant="authPrimary"
                  disabled={isSubmitting}
                  className="w-full cursor-glow-border transition-colors duration-200"
                >
                  {isSubmitting ? 'Sending...' : 'Send reset link'}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                Remembered your password?{' '}
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

export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-md rounded-xl frosted-panel p-4 sm:p-6 md:p-8">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
