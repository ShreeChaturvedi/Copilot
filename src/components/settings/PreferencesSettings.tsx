import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Loader2 } from 'lucide-react';
import { SettingsRow } from './SettingsRow';
import { userAPI, type UserPreferences } from '@/services/api/user';

const WEEK_DAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '6', label: 'Saturday' },
] as const;

export function PreferencesSettings() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Mirrors ProfileSettings' form.formState.isDirty: this panel buffers
  // edits locally and only persists on explicit Save, so it needs its own
  // dirty flag to warn a user who edits and closes without saving (#1.F).
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const prefs = await userAPI.getPreferences();
        if (active) setPreferences(prefs);
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : 'Failed to load preferences'
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const update = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSuccess(false);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!preferences) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      // Send only the fields this panel edits. Theme is owned by the
      // appearance control in General; including the stale value fetched at
      // panel-open would overwrite a newer toggle (#68, #69).
      const saved = await userAPI.updatePreferences({
        defaultView: preferences.defaultView,
        weekStartsOn: preferences.weekStartsOn,
        notificationsEnabled: preferences.notificationsEnabled,
      });
      setPreferences(saved);
      setSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save preferences'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    // Shape-matched skeletons instead of a spinner+text block, matching
    // IntegrationsSettings' already-correct loading precedent (§1.F).
    return (
      <div>
        <div className="flex items-center justify-between gap-4 py-3.5">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex items-center justify-between gap-4 py-3.5 border-t border-hairline">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex items-center justify-between gap-4 py-3.5 border-t border-hairline">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error ?? 'Could not load preferences.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="divide-y divide-hairline">
        <SettingsRow
          label="Default View"
          description="Which view opens when you start the app"
          htmlFor="default-view"
        >
          <Select
            value={preferences.defaultView}
            onValueChange={(v) =>
              update('defaultView', v as UserPreferences['defaultView'])
            }
          >
            <SelectTrigger id="default-view" className="w-44">
              <SelectValue placeholder="Select default view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="calendar">Calendar View</SelectItem>
              <SelectItem value="tasks">Task View</SelectItem>
              <SelectItem value="last-used">Remember Last Used</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Week Starts On"
          description="First day of the week in calendar views"
          htmlFor="week-start"
        >
          <Select
            value={String(preferences.weekStartsOn)}
            onValueChange={(v) => update('weekStartsOn', Number(v))}
          >
            <SelectTrigger id="week-start" className="w-44">
              <SelectValue placeholder="Select day" />
            </SelectTrigger>
            <SelectContent>
              {WEEK_DAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Desktop Notifications"
          description="Receive notifications for upcoming events and tasks"
          htmlFor="notifications"
        >
          <Switch
            id="notifications"
            checked={preferences.notificationsEnabled}
            onCheckedChange={(checked) =>
              update('notificationsEnabled', checked)
            }
          />
        </SettingsRow>
      </div>

      <div className="mt-4 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-aqua-rim bg-aqua-film-08 text-success">
            <AlertDescription>Preferences saved.</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between border-t border-hairline pt-4">
          <span className="text-sm">
            {isDirty && (
              <span className="text-warning">You have unsaved changes</span>
            )}
          </span>
          <div className="flex flex-col items-end gap-1">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Preferences'
              )}
            </Button>
            <p className="text-xs text-ink-muted">Saved to your account</p>
          </div>
        </div>
      </div>
    </div>
  );
}
