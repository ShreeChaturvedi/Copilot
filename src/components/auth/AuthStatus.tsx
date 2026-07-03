import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import '@/styles/new-folder.css';

export type AuthStatusVariant = 'loading' | 'success' | 'error';

interface AuthStatusProps {
  variant: AuthStatusVariant;
  title: string;
  description: string;
  action?: ReactNode;
}

function StatusGlyph({ variant }: { variant: AuthStatusVariant }) {
  if (variant === 'loading') {
    return (
      <span className="auth-mark" aria-hidden="true">
        <span className="auth-tick">
          <span className="auth-tick-dot" />
          <span className="auth-tick-dot" />
          <span className="auth-tick-dot" />
        </span>
      </span>
    );
  }

  if (variant === 'success') {
    // The exact schedule-empty badge/check recipe (new-folder.css), shrunk
    // to an icon-sized 40x40 well — the same "resolved" aqua the rest of the
    // app already reserves for caught-up/done states (foundation §1.6 rule 3).
    return (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        role="img"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="schedule-empty-badge" cx="20" cy="20" r="15" />
        <path className="schedule-empty-check" d="M13 20 l5 6 l10 -13" />
      </svg>
    );
  }

  return (
    <span
      className="flex size-10 items-center justify-center rounded-full bg-destructive/10"
      aria-hidden="true"
    >
      <AlertCircle className="size-5 text-destructive" />
    </span>
  );
}

/**
 * One shared "here's an outcome" primitive for every auth surface that needs
 * to say "something just happened": GoogleCallback's loading/success/error
 * states, ForgotPassword's sent state, ResetPassword's done/missing-token
 * states (auth.md §2.8, §4 "Bolder Reinvention"). Replaces what would
 * otherwise be four independent re-inventions of the same idea — the
 * structural root cause that let GoogleCallback drift off the token system
 * entirely (auth.md §1.3).
 */
export function AuthStatus({
  variant,
  title,
  description,
  action,
}: AuthStatusProps) {
  return (
    <div
      className="flex flex-col items-center gap-4 text-center"
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <StatusGlyph variant={variant} />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold tracking-[-0.01em] text-ink">
          {title}
        </p>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
