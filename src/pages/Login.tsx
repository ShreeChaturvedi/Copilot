// no default React import needed with automatic JSX runtime
import { LoginForm } from '@/components/login-form';

export function LoginPage() {
  return (
    <div className="auth-card w-full max-w-[400px] p-8 max-sm:p-6">
      <LoginForm />
    </div>
  );
}
