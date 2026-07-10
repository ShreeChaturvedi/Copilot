import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Info, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';
import { useAuthStore } from '@/stores/authStore';
import { authAPI } from '@/services/api/auth';
import { userAPI } from '@/services/api/user';

export function SecuritySettings() {
  const {
    authMethod,
    user,
    getValidAccessToken,
    refreshTokenIfNeeded,
    logoutEverywhere,
    logout,
  } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

    await refreshTokenIfNeeded();
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
    } catch (err) {
      setPwError(
        err instanceof Error
          ? err.message
          : 'Could not change password. Try again.'
      );
    } finally {
      setChanging(false);
    }
  };

  const handleLogoutEverywhere = async () => {
    try {
      setLoggingOut(true);
      setLogoutError(null);
      await logoutEverywhere();
      setLogoutDialogOpen(false);
      toast.success('Signed out on all devices');
    } catch (err) {
      setLogoutError(
        err instanceof Error ? err.message : 'Could not log out. Try again.'
      );
    } finally {
      setLoggingOut(false);
    }
  };

  const handleExportData = async () => {
    try {
      setExportingData(true);
      setExportError(null);
      await userAPI.exportData();
      toast.success('Your data is downloading');
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : 'Failed to export data'
      );
    } finally {
      setExportingData(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setDeletingAccount(true);
      setDeleteError(null);
      await userAPI.deleteAccount();
      setDeleteDialogOpen(false);
      await logout();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Failed to delete account'
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div>
      <SettingsSection title="Password" first>
        {hasPassword ? (
          <form
            onSubmit={handleChangePassword}
            className="space-y-3 py-1 max-w-sm"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="current-password"
                className="text-[12px] text-ink-muted font-medium"
              >
                Current password
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                className="h-8 text-[13px]"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={changing}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="new-password"
                className="text-[12px] text-ink-muted font-medium"
              >
                New password
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="h-8 text-[13px]"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={changing}
                required
              />
              <p className="text-[11px] text-ink-muted">
                8+ chars with upper, lower, number, and special character.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="confirm-password"
                className="text-[12px] text-ink-muted font-medium"
              >
                Confirm new password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                className="h-8 text-[13px]"
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
                <AlertDescription>Password changed.</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={
                  changing ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {changing ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update password'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="py-3">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Signed in with Google — manage your password in your Google
                account.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Sign-in">
        <SettingsRow
          label="Google"
          description={
            googleConnected ? 'Linked for sign-in' : 'No Google account linked'
          }
        >
          {googleConnected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-aqua">
              <span
                className="size-1.5 rounded-full bg-aqua"
                aria-hidden="true"
              />
              Connected
            </span>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Sessions">
        <SettingsRow
          label="Log out everywhere"
          description="Ends every active session, including this one"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLogoutError(null);
              setLogoutDialogOpen(true);
            }}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Logging out...
              </>
            ) : (
              'Log out everywhere'
            )}
          </Button>
        </SettingsRow>
        {logoutError && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{logoutError}</AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      <SettingsSection title="Data">
        <SettingsRow
          label="Export data"
          description="Download tasks, events, and settings as JSON"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            disabled={exportingData}
          >
            {exportingData ? (
              <>
                <Download className="mr-2 h-3.5 w-3.5 animate-pulse" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-3.5 w-3.5" />
                Export
              </>
            )}
          </Button>
        </SettingsRow>
      </SettingsSection>

      {exportError && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}

      <div className="mt-5 flex items-center justify-between gap-4 rounded-btn border border-destructive/20 bg-destructive/5 px-3 py-2.5">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[13px] font-medium text-destructive">
            Delete account
          </p>
          <p className="text-[12px] text-ink-muted">
            Permanently delete your account and all data
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDeleteError(null);
            setDeleteDialogOpen(true);
          }}
          className="shrink-0 h-7 text-[12px] border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <Trash2 className="mr-1.5 size-3.5" />
          Delete
        </Button>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out of all sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be signed out on every device, including this one, and will
              need to log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {logoutError && (
            <Alert variant="destructive">
              <AlertDescription>{logoutError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loggingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleLogoutEverywhere();
              }}
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out...' : 'Log out everywhere'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account and all associated data:
              tasks, events, calendars, lists, and attachments. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAccount}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deletingAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAccount ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
