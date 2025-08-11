import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { authAPI } from '@/services/api/auth';

export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
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

        // Exchange code for tokens
        const redirectUri = `${window.location.origin}/auth/google/callback`;
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
        const message = error instanceof Error ? error.message : 'Google authentication failed';
        setErrorMessage(message);
        setError(message);
        setStatus('error');
      }
    };

    handleGoogleCallback();
  }, [searchParams, navigate, setGoogleAuth, setError]);

  const handleRetry = () => {
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-blue-50 via-green-50 to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Card className="w-full max-w-md mx-auto shadow-2xl border-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Google Authentication
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            {status === 'loading' && 'Processing your authentication...'}
            {status === 'success' && 'Successfully authenticated!'}
            {status === 'error' && 'Authentication failed'}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center space-y-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
              <div className="text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Please wait while we complete your sign-in...
                </p>
                <div className="mt-2 flex items-center justify-center space-x-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse delay-100" />
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse delay-200" />
                </div>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  Welcome!
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  You'll be redirected to your dashboard shortly.
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="w-full space-y-4">
              <div className="flex flex-col items-center space-y-4">
                <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    Something went wrong
                  </p>
                </div>
              </div>
              
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50">
                <AlertDescription className="text-red-800 dark:text-red-200 text-sm">
                  {errorMessage}
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleRetry}
                className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Progress indicator for loading state */}
          {status === 'loading' && (
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}