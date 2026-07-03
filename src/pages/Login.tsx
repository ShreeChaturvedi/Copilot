// no default React import needed with automatic JSX runtime
import { LoginForm } from '@/components/login-form';
import { AuthCard } from '@/components/auth';

export function LoginPage() {
  return (
    <AuthCard>
      <LoginForm />
    </AuthCard>
  );
}
