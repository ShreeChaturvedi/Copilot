/**
 * URL helpers that must stay in lockstep with the router basename.
 *
 * The SPA is served under `/app` (Vite `base: '/app/'`, Router
 * `basename="/app"`). OAuth redirect URIs bypass the router, so they must be
 * built from `import.meta.env.BASE_URL` (`'/app/'` in dev and build) to match
 * what Google — and the server-side token exchange — expect.
 */

/** The redirect URI this origin uses for the Google consent round trip. */
export function googleRedirectUri(): string {
  return new URL(
    `${import.meta.env.BASE_URL}auth/google/callback`,
    window.location.origin
  ).toString();
}
