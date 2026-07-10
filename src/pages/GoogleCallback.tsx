import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AuthLayout, AuthCard, AuthStatus } from '@/components/auth';
import { useAuthStore } from '@/stores/authStore';
import { authAPI, GOOGLE_OAUTH_STATE_KEY } from '@/services/api/auth';
import { googleSyncApi } from '@/services/api/google';
import { googleRedirectUri } from '@/lib/urls';
import { toUserMessage } from '@/utils/errorMessages';

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [errorTitle, setErrorTitle] = useState<string>('Something went wrong');
  const [errorMessage, setErrorMessage] = useState<string>('');
  // 'login' = Google sign-in; 'calendar_connect' = Settings -> Integrations
  // incremental-auth dance (calendar scope) for the already-signed-in user.
  const isCalendarConnect = searchParams.get('state') === 'calendar_connect';

  const { setGoogleAuth } = useAuthStore();

  // Single-flight guard: OAuth codes are single-use, so the code must be
  // exchanged exactly once per mount. Without this, StrictMode's double effect
  // (dev) or any effect re-run re-sends the already-consumed code, the second
  // exchange is rejected, and a just-succeeded sign-in flips to an error. This
  // mirrors the refreshInFlight guard in authStore (#57).
  const ranRef = useRef(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const handleGoogleCallback = async () => {
      try {
        // Get authorization code from URL parameters
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          // A deliberate cancel is not a system failure. Keep the raw code in
          // the console; show human copy on screen.
          console.error('Google OAuth error:', error);
          if (error === 'access_denied') {
            setErrorTitle('Sign-in cancelled');
            setErrorMessage(
              "You can try connecting your Google account again whenever you're ready."
            );
          } else {
            setErrorMessage(
              "We couldn't complete Google sign-in. Please try again."
            );
          }
          setStatus('error');
          return;
        }

        if (!code) {
          throw new Error('Authorization code not found');
        }

        const redirectUri = googleRedirectUri();

        if (isCalendarConnect) {
          // Calendar-connect flow: attach the grant to the logged-in account.
          await googleSyncApi.connect(code, redirectUri);
          setStatus('success');
          redirectTimer.current = setTimeout(() => {
            navigate('/', { replace: true });
          }, 1500);
          return;
        }

        // Login flow: reject a callback whose state doesn't match the nonce we
        // stashed before redirecting (OAuth login CSRF, #15).
        const returnedState = searchParams.get('state');
        const expectedState = sessionStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
        sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);
        if (!expectedState || returnedState !== expectedState) {
          throw new Error(
            "We couldn't verify this sign-in request. Please start again."
          );
        }

        // Login flow: exchange code for an app session.
        const response = await authAPI.googleAuth({ code, redirectUri });

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Google authentication failed');
        }

        const { googleTokens, user } = response.data;

        // Store Google authentication
        setGoogleAuth(googleTokens, {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        });

        setStatus('success');

        // Redirect after a short delay, to the originally intended destination
        // if we have one (#14), otherwise the dashboard.
        const from = (location.state as { from?: { pathname?: string } } | null)
          ?.from?.pathname;
        redirectTimer.current = setTimeout(() => {
          navigate(from || '/', { replace: true });
        }, 1500);
      } catch (error) {
        console.error('Google callback error:', error);
        setErrorMessage(
          toUserMessage(
            error,
            "We couldn't complete Google sign-in. Please try again."
          )
        );
        setStatus('error');
      }
    };

    handleGoogleCallback();

    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [
    searchParams,
    navigate,
    setGoogleAuth,
    isCalendarConnect,
    location.state,
  ]);

  const handleRetry = () => {
    navigate(isCalendarConnect ? '/' : '/login', { replace: true });
  };

  return (
    <AuthLayout>
      <AuthCard>
        <div className="flex flex-col gap-6">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">
            {isCalendarConnect ? 'Google Calendar' : 'Google Authentication'}
          </h1>

          {status === 'loading' && (
            <AuthStatus
              variant="loading"
              title="Connecting..."
              description={
                isCalendarConnect
                  ? 'Connecting your Google Calendar...'
                  : 'Processing your authentication...'
              }
            />
          )}

          {status === 'success' && (
            <AuthStatus
              variant="success"
              title={
                isCalendarConnect
                  ? 'Google Calendar connected!'
                  : 'Successfully authenticated!'
              }
              description={
                isCalendarConnect
                  ? 'Open Settings → Integrations to import your calendar.'
                  : "You'll be redirected to your dashboard shortly."
              }
            />
          )}

          {status === 'error' && (
            <AuthStatus
              variant="error"
              title={errorTitle}
              description={errorMessage}
              action={
                <Button onClick={handleRetry} className="w-full">
                  Try Again
                </Button>
              }
            />
          )}
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
