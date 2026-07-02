import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Loader2 } from 'lucide-react';
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
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save preferences'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace Preferences</CardTitle>
          <CardDescription>
            Defaults applied to your workspace. These are saved to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading preferences...
            </div>
          ) : preferences ? (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="default-view">Default View</Label>
                  <p className="text-sm text-muted-foreground">
                    Which view opens when you start the app
                  </p>
                </div>
                <div className="min-w-40">
                  <Select
                    value={preferences.defaultView}
                    onValueChange={(v) =>
                      update(
                        'defaultView',
                        v as UserPreferences['defaultView']
                      )
                    }
                  >
                    <SelectTrigger id="default-view" className="w-full">
                      <SelectValue placeholder="Select default view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar">Calendar View</SelectItem>
                      <SelectItem value="tasks">Task View</SelectItem>
                      <SelectItem value="last-used">
                        Remember Last Used
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="week-start">Week Starts On</Label>
                  <p className="text-sm text-muted-foreground">
                    First day of the week in calendar views
                  </p>
                </div>
                <div className="min-w-40">
                  <Select
                    value={String(preferences.weekStartsOn)}
                    onValueChange={(v) => update('weekStartsOn', Number(v))}
                  >
                    <SelectTrigger id="week-start" className="w-full">
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
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notifications">Desktop Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications for upcoming events and tasks
                  </p>
                </div>
                <Switch
                  id="notifications"
                  checked={preferences.notificationsEnabled}
                  onCheckedChange={(checked) =>
                    update('notificationsEnabled', checked)
                  }
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
                  <AlertDescription>Preferences saved.</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
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
              </div>
            </>
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                {error ?? 'Could not load preferences.'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
