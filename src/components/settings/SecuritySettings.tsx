import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Info } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authAPI } from '@/services/api/auth';

export function SecuritySettings() {
  const { authMethod, user, getValidAccessToken, logoutEverywhere } =
    useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  // Local (password) accounts can change their password. Google-only accounts
  // have no password to verify against.
  const hasPassword = authMethod === 'jwt';
  const googleConnected = authMethod === 'google' || Boolean(user?.googleId);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match');
      return;
    }

    const accessToken = getValidAccessToken();
    if (!accessToken) {
      setPwError('Your session has expired. Please log in again.');
      return;
    }

    try {
      setChanging(true);
      const result = await authAPI.changePassword(
        accessToken,
        currentPassword,
        newPassword
      );
      if (!result.success) {
        setPwError(result.message ?? 'Failed to change password');
        return;
      }
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(false), 3000);
    } finally {
      setChanging(false);
    }
  };

  const handleLogoutEverywhere = async () => {
    try {
      setLoggingOut(true);
      await logoutEverywhere();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update the password used to sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={changing}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changing}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters with uppercase, lowercase, a number, and
                  a special character.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changing}
                  required
                />
              </div>

              {pwError && (
                <Alert variant="destructive">
                  <AlertDescription>{pwError}</AlertDescription>
                </Alert>
              )}
              {pwSuccess && (
                <Alert className="border-aqua-rim bg-aqua-film-08 text-success">
                  <AlertDescription>
                    Password changed successfully.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={
                    changing ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                >
                  {changing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update password'
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                You are signed in with Google, so there is no password to
                change. Manage your password in your Google account.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Third-party accounts linked for sign-in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Google</Label>
              <p className="text-sm text-muted-foreground">
                {googleConnected
                  ? 'Your Google account is linked for sign-in.'
                  : 'No Google account is linked.'}
              </p>
            </div>
            <Badge variant={googleConnected ? 'secondary' : 'outline'}>
              {googleConnected ? 'Connected' : 'Not connected'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Sign out of every device by revoking all refresh tokens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Log out everywhere</Label>
              <p className="text-sm text-muted-foreground">
                Ends every active session, including this one.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogoutEverywhere}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging out...
                </>
              ) : (
                'Log out everywhere'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
