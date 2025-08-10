import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/label"
import { calculatePasswordStrength, getStrengthColor, getStrengthText } from "@/utils/passwordStrength"
import { useNavigate } from "react-router-dom"
import { authAPI } from "@/services/api/auth"

function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  

  const strength = useMemo(() => calculatePasswordStrength(password), [password]);
  const passwordsMatch = confirm.length > 0 && confirm === password;

  // Border glow follows global cursor via page-level CSS vars set in SignupPage

  const handleSigninLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/login');
  };

  const handleGoogleSignup = () => {
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const url = authAPI.getGoogleAuthUrl(redirectUri);
    window.location.href = url;
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="bg-transparent shadow-none border-transparent">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Enter your details below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
                {/* Strength bar + text */}
                {(password.length > 0) && (
                  <>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full transition-all", getStrengthColor(strength.strength))}
                          style={{ width: `${(strength.score / 4) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground min-w-16 text-right">
                        {getStrengthText(strength.strength)}
                      </span>
                    </div>
                    {/* Requirements hints */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mt-1">
                      <span className={cn(strength.checks.length ? "text-success" : "")}>8+ characters</span>
                      <span className={cn(strength.checks.uppercase && strength.checks.lowercase ? "text-success" : "")}>Upper & lower</span>
                      <span className={cn(strength.checks.numbers ? "text-success" : "")}>Number</span>
                      <span className={cn(strength.checks.symbols ? "text-success" : "")}>Symbol</span>
                    </div>
                  </>
                )}
              </div>
              <div className="grid gap-3">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-invalid={confirm.length > 0 && !passwordsMatch}
                  required
                />
                {confirm.length > 0 && (
                  <p className={cn(
                    "text-xs",
                    passwordsMatch ? "text-success" : "text-destructive"
                  )}>
                    {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  variant="authPrimary"
                  className={cn(
                    "w-full cursor-glow-border",
                    "transition-colors duration-200",
                  )}
                >
                  Create account
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full transition-colors duration-200 hover:bg-[oklch(0.96_0_0)] dark:hover:bg-[oklch(0.18_0.01_260)]"
                  onClick={handleGoogleSignup}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-4 w-4">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.156 7.96 3.04l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"/>
                    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.156 7.96 3.04l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.196l-6.19-5.238C29.148 35.091 26.689 36 24 36c-5.202 0-9.616-3.317-11.277-7.946l-6.55 5.046C9.488 38.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.094 5.566.001-.001 6.19 5.238 6.19 5.238C39.441 35.894 44 30.5 44 24c0-1.341-.138-2.651-.389-3.917z"/>
                  </svg>
                  Sign up with Google
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <a href="#" onClick={handleSigninLink} className="underline underline-offset-4">
                Sign in
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function SignupPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let rafId: number | null = null;

    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;

      const update = () => {
        const targets = el.querySelectorAll<HTMLElement>('.cursor-glow-border');
        targets.forEach((btn) => {
          const rect = btn.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          btn.style.setProperty('--glow-x', `${x}%`);
          btn.style.setProperty('--glow-y', `${y}%`);
        });
      };

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };
    window.addEventListener('mousemove', handleMove);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex min-h-svh w-full items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-md rounded-xl frosted-panel p-4 sm:p-6 md:p-8">
        <SignupForm />
      </div>
    </div>
  );
}