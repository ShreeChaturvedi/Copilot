interface GoogleIconProps {
  className?: string;
}

/**
 * Google's own multi-color "G" brand mark. Extracted from the two verbatim
 * copies previously pasted into `login-form.tsx` and `Signup.tsx` (auth.md
 * §1.3, §2.4). Colors are Google's official palette, not app tokens — the
 * one legitimate hardcoded-hex exception (foundation map §7D) — and stay
 * identical in both themes.
 */
export function GoogleIcon({ className }: GoogleIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.156 7.96 3.04l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.156 7.96 3.04l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.196l-6.19-5.238C29.148 35.091 26.689 36 24 36c-5.202 0-9.616-3.317-11.277-7.946l-6.55 5.046C9.488 38.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.094 5.566.001-.001 6.19 5.238 6.19 5.238C39.441 35.894 44 30.5 44 24c0-1.341-.138-2.651-.389-3.917z"
      />
    </svg>
  );
}
