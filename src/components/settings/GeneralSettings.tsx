import { useEffect, useMemo, useState } from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SharedToggleButton,
  type ToggleOption,
} from '@/components/ui/SharedToggleButton';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { SettingsSection } from './SettingsSection';
import { SettingsRow } from './SettingsRow';
import { useThemeStore, type Theme } from '@/stores/themeStore';
import {
  useSettingsStore,
  type TaskCompletionControl,
} from '@/stores/settingsStore';
import {
  useCalendarSettingsStore,
  type TimeRangeMode,
} from '@/stores/calendarSettingsStore';
import { useUIStore } from '@/stores/uiStore';
import { userAPI, type UserPreferences } from '@/services/api/user';
import { CheckSquare, Monitor, Moon, Sun, Tag } from 'lucide-react';

/** Shared select width so row controls align. */
const SELECT_W = 'w-[9.5rem]';

const THEME_OPTIONS: ToggleOption<Theme>[] = [
  { value: 'light', label: 'Light', shortLabel: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', shortLabel: 'Dark', icon: Moon },
  { value: 'system', label: 'System', shortLabel: 'Auto', icon: Monitor },
];

const MODE_OPTIONS: ToggleOption<TimeRangeMode>[] = [
  { value: 'default', label: 'Default', shortLabel: 'Def' },
  { value: 'fullDay', label: 'Full day', shortLabel: 'Full' },
  { value: 'custom', label: 'Custom', shortLabel: 'Cust' },
];

const WEEK_DAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '6', label: 'Saturday' },
] as const;

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

function applyDefaultView(defaultView: UserPreferences['defaultView']) {
  if (defaultView === 'calendar' || defaultView === 'tasks') {
    const view = defaultView === 'tasks' ? 'task' : 'calendar';
    useSettingsStore.getState().setAppViewMode(view);
    useUIStore.getState().setCurrentView(view);
  }
}

export function GeneralSettings() {
  const { theme, setTheme } = useThemeStore();
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

  const {
    timeRangeMode,
    customStartHour,
    customEndHour,
    setTimeRangeMode,
    setCustomRange,
  } = useCalendarSettingsStore();

  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoadingPrefs(true);
        const prefs = await userAPI.getPreferences();
        if (active) setPreferences(prefs);
      } catch (err) {
        if (active)
          setPrefsError(
            err instanceof Error ? err.message : 'Failed to load preferences'
          );
      } finally {
        if (active) setLoadingPrefs(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const effectiveLabel = useMemo(() => {
    const { startHour, endHour } =
      timeRangeMode === 'fullDay'
        ? { startHour: 0, endHour: 24 }
        : timeRangeMode === 'custom'
          ? { startHour: customStartHour, endHour: customEndHour }
          : { startHour: 6, endHour: 22 };
    return `${formatHour(startHour)} – ${formatHour(endHour)}`;
  }, [timeRangeMode, customStartHour, customEndHour]);

  const patchPreference = async <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const previous = preferences;
    setPreferences((prev) => (prev ? { ...prev, [key]: value } : prev));
    setPrefsError(null);
    try {
      const saved = await userAPI.updatePreferences({ [key]: value });
      setPreferences(saved);
      if (key === 'weekStartsOn') {
        useCalendarSettingsStore.getState().setWeekStartsOn(saved.weekStartsOn);
      }
      if (key === 'defaultView') {
        applyDefaultView(saved.defaultView);
      }
    } catch (err) {
      setPreferences(previous);
      setPrefsError(
        err instanceof Error ? err.message : 'Failed to save preference'
      );
    }
  };

  return (
    <div className="space-y-0">
      <SettingsSection title="Appearance" first>
        <SettingsRow label="Theme" align="start">
          <SharedToggleButton
            currentValue={theme}
            options={THEME_OPTIONS}
            onValueChange={setTheme}
            size="sm"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Calendar">
        <SettingsRow
          label="Visible hours"
          description="Week and day view range"
          align="start"
        >
          <SharedToggleButton
            currentValue={timeRangeMode}
            options={MODE_OPTIONS}
            onValueChange={(mode) => setTimeRangeMode(mode as TimeRangeMode)}
            size="sm"
          />
        </SettingsRow>
        {timeRangeMode === 'custom' && (
          <SettingsRow label="Custom range" align="start">
            <div className="w-[12rem]">
              <RangeSlider
                min={0}
                max={24}
                step={1}
                values={[customStartHour, customEndHour]}
                onChange={([start, end]) => setCustomRange(start, end)}
              />
            </div>
          </SettingsRow>
        )}
        <div className="flex items-center justify-between py-2.5">
          <span className="text-[12px] text-ink-muted">Effective</span>
          <span className="font-mono text-[11px] tabular-nums text-foreground">
            {effectiveLabel}
          </span>
        </div>
      </SettingsSection>

      <SettingsSection title="Workspace">
        {loadingPrefs ? (
          <>
            <div className="flex items-center justify-between gap-6 py-2.5">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-7 w-[9.5rem]" />
            </div>
            <div className="flex items-center justify-between gap-6 py-2.5">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-7 w-[9.5rem]" />
            </div>
          </>
        ) : preferences ? (
          <>
            <SettingsRow
              label="Default view"
              description="Opens when you start the app"
              htmlFor="default-view"
            >
              <Select
                value={preferences.defaultView}
                onValueChange={(v) =>
                  void patchPreference(
                    'defaultView',
                    v as UserPreferences['defaultView']
                  )
                }
              >
                <SelectTrigger
                  id="default-view"
                  className={SELECT_W + ' h-7 text-[12px]'}
                >
                  <SelectValue placeholder="View" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar">Calendar</SelectItem>
                  <SelectItem value="tasks">Tasks</SelectItem>
                  <SelectItem value="last-used">Last used</SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              label="Week starts on"
              description="First day on the grid"
              htmlFor="week-start"
            >
              <Select
                value={String(preferences.weekStartsOn)}
                onValueChange={(v) =>
                  void patchPreference('weekStartsOn', Number(v))
                }
              >
                <SelectTrigger
                  id="week-start"
                  className={SELECT_W + ' h-7 text-[12px]'}
                >
                  <SelectValue placeholder="Day" />
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
              label="Desktop notifications"
              description="Upcoming events and tasks"
              htmlFor="notifications"
            >
              <Switch
                id="notifications"
                checked={preferences.notificationsEnabled}
                onCheckedChange={(checked) =>
                  void patchPreference('notificationsEnabled', checked)
                }
              />
            </SettingsRow>
          </>
        ) : null}

        <SettingsRow
          label="Task completion"
          description="Control style in list view"
          htmlFor="completion-control"
        >
          <Select
            value={taskCompletionControl}
            onValueChange={(v) =>
              setTaskCompletionControl(v as TaskCompletionControl)
            }
          >
            <SelectTrigger
              id="completion-control"
              className={SELECT_W + ' h-7 text-[12px]'}
            >
              <SelectValue placeholder="Control" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checkbox">
                <span className="inline-flex items-center gap-1.5">
                  <CheckSquare className="size-3.5" /> Checkbox
                </span>
              </SelectItem>
              <SelectItem value="status-tag">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="size-3.5" /> Status tag
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Sidebar analytics"
          description="Summary above task lists"
          htmlFor="sidebar-analytics"
        >
          <Switch
            id="sidebar-analytics"
            checked={showSidebarTaskAnalytics}
            onCheckedChange={setShowSidebarTaskAnalytics}
          />
        </SettingsRow>
      </SettingsSection>

      {prefsError && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{prefsError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
