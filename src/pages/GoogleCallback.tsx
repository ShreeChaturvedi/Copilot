import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { AuthLayout, AuthCard, AuthStatus } from '@/components/auth';
import { useAuthStore } from '@/stores/authStore';
import { authAPI } from '@/services/api/auth';
import { googleSyncApi } from '@/services/api/google';
import { googleRedirectUri } from '@/lib/urls';

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading'
  );
  const [errorMessage, setErrorMessage] = useState<string>('');
  // 'login' = Google sign-in; 'calendar_connect' = Settings -> Integrations
  // incremental-auth dance (calendar scope) for the already-signed-in user.
  const isCalendarConnect = searchParams.get('state') === 'calendar_connect';

  const { setGoogleAuth, setError } = useAuthStore();

  useEffect(() => {
    const handleGoogleCallback = async () => {
      try {
        // Get authorization code from URL parameters
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`Google OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('Authorization code not found');
        }

        const redirectUri = googleRedirectUri();

        if (isCalendarConnect) {
          // Calendar-connect flow: attach the grant to the logged-in account.
          await googleSyncApi.connect(code, redirectUri);
          setStatus('success');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1500);
          return;
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

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      } catch (error) {
        console.error('Google callback error:', error);
        const message =
          error instanceof Error
            ? error.message
            : 'Google authentication failed';
        setErrorMessage(message);
        setError(message);
        setStatus('error');
      }
    };

    handleGoogleCallback();
  }, [searchParams, navigate, setGoogleAuth, setError, isCalendarConnect]);

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
              title="Something went wrong"
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
