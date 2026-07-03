import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  SharedToggleButton,
  type ToggleOption,
} from '@/components/ui/SharedToggleButton';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import {
  Monitor,
  Moon,
  Sun,
  Trash2,
  Download,
  CheckSquare,
  Tag,
} from 'lucide-react';
import {
  useSettingsStore,
  type TaskCompletionControl,
} from '@/stores/settingsStore';
import { userAPI } from '@/services/api/user';

const THEME_OPTIONS: ToggleOption<Theme>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function GeneralSettings() {
  const { logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [exportingData, setExportingData] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const taskCompletionControl = useSettingsStore(
    (s) => s.taskCompletionControl
  );
  const setTaskCompletionControl = useSettingsStore(
    (s) => s.setTaskCompletionControl
  );
  const showSidebarTaskAnalytics = useSettingsStore(
    (s) => s.showSidebarTaskAnalytics
  );
  const setShowSidebarTaskAnalytics = useSettingsStore(
    (s) => s.setShowSidebarTaskAnalytics
  );

  const handleExportData = async () => {
    try {
      setExportingData(true);
      setExportError(null);
      await userAPI.exportData();
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
      // End the session after the account is removed server-side.
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
      <SettingsSection title="Appearance" first>
        <SettingsRow label="Theme" align="start">
          <SharedToggleButton
            currentValue={theme}
            options={THEME_OPTIONS}
            onValueChange={setTheme}
            size="md"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Application Preferences">
        <SettingsRow
          label="Task Completion Control"
          description="Choose whether to use a checkbox or a status tag icon in list view"
          htmlFor="completion-control"
        >
          <Select
            value={taskCompletionControl}
            onValueChange={(v) =>
              setTaskCompletionControl(v as TaskCompletionControl)
            }
          >
            <SelectTrigger id="completion-control" className="w-44">
              <SelectValue placeholder="Select control" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checkbox">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" /> Checkbox
                </div>
              </SelectItem>
              <SelectItem value="status-tag">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Status Tag (icon)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Sidebar Task Analytics Summary"
          description="Show a compact analytics card above Task Lists in the sidebar"
          htmlFor="sidebar-analytics"
        >
          <Switch
            id="sidebar-analytics"
            checked={showSidebarTaskAnalytics}
            onCheckedChange={setShowSidebarTaskAnalytics}
          />
        </SettingsRow>
      </SettingsSection>

      <div>
        <SettingsSection title="Data Management">
          <SettingsRow
            label="Export Data"
            description="Download all your tasks, events, and settings"
          >
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={exportingData}
            >
              {exportingData ? (
                <>
                  <Download className="mr-2 h-4 w-4 animate-pulse" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
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

        {/* Named box exception (§2.1): a destructive/irreversible action earns
            a visually distinct fence instead of the flat hairline-divided rows
            every other grouping in this area uses. */}
        <div className="mt-3 flex items-center justify-between gap-4 rounded-card border border-destructive/20 bg-destructive/5 px-4 py-3.5">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium text-destructive">
              Delete Account
            </p>
            <p className="text-[0.8125rem] text-ink-muted">
              Permanently delete your account and all data
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setDeleteError(null);
              setDeleteDialogOpen(true);
            }}
            className="shrink-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

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
                // Keep the dialog open until the request resolves.
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
