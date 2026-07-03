/**
 * Shared route-guard loading state for `ProtectedRoute`/`PublicRoute`
 * (auth.md §2.9, §1.5). Reuses the shipped `.auth-mark` tile as the
 * spinner's housing so the pre-room loading beat visually rhymes with the
 * brand mark the user is about to see, instead of a generic spinner with no
 * relationship to the room (the "two different visual languages, back to
 * back, in under a second" seam the spec calls out).
 *
 * `.auth-mark`/`.auth-tick` are defined in `src/styles/auth.css`, imported
 * by `AuthLayout.tsx`. `AuthLayout` is imported eagerly at the top of
 * `App.tsx` (same barrel as this component), so that CSS is already on the
 * page before this ever renders — no separate import needed here.
 */
export function AuthGuardSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <span className="auth-mark" aria-hidden="true">
        <span className="auth-tick">
          <span className="auth-tick-dot" />
          <span className="auth-tick-dot" />
          <span className="auth-tick-dot" />
        </span>
      </span>
      <p className="text-sm text-ink-muted" role="status">
        {label}
      </p>
    </div>
  );
}
