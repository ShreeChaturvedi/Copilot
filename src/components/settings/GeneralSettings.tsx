import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
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

export function GeneralSettings() {
  const { user, authMethod } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [exportingData, setExportingData] = useState(false);
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

  // const userInfo = authMethod === 'google' ? googleUser : user;

  const handleExportData = async () => {
    try {
      setExportingData(true);
      // TODO: Implement data export
      console.log('Exporting user data...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = () => {
    // TODO: Implement account deletion confirmation dialog
    console.log('Delete account requested');
  };

  return (
    <div className="space-y-6">
      {/* Account Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Account Overview</CardTitle>
          <CardDescription>
            Your account information and current plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">
                Account Type
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={authMethod === 'google' ? 'secondary' : 'outline'}
                >
                  {authMethod === 'google' ? 'Google Account' : 'Local Account'}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">
                Member Since
              </Label>
              <p className="mt-1 text-sm">
                {authMethod === 'jwt' && user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize how the application looks and feels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                className="flex items-center gap-2"
              >
                <Sun className="h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                className="flex items-center gap-2"
              >
                <Moon className="h-4 w-4" />
                Dark
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
                className="flex items-center gap-2"
              >
                <Monitor className="h-4 w-4" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Application Preferences</CardTitle>
          <CardDescription>
            Configure default behavior and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="completion-control" className="whitespace-nowrap">
                Task Completion Control
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose whether to use a checkbox or a status tag icon in list
                view
              </p>
            </div>
            <div className="min-w-40">
              <Select
                value={taskCompletionControl}
                onValueChange={(v) =>
                  setTaskCompletionControl(v as TaskCompletionControl)
                }
              >
                <SelectTrigger id="completion-control" className="w-full">
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
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sidebar-analytics">
                Sidebar Task Analytics Summary
              </Label>
              <p className="text-sm text-muted-foreground">
                Show a compact analytics card above Task Lists in the sidebar
              </p>
            </div>
            <Switch
              id="sidebar-analytics"
              checked={showSidebarTaskAnalytics}
              onCheckedChange={setShowSidebarTaskAnalytics}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Desktop Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications for upcoming events and tasks
              </p>
            </div>
            <Switch id="notifications" />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-save">Auto-save Changes</Label>
              <p className="text-sm text-muted-foreground">
                Automatically save changes as you type
              </p>
            </div>
            <Switch id="auto-save" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="keyboard-shortcuts">Keyboard Shortcuts</Label>
              <p className="text-sm text-muted-foreground">
                Enable keyboard shortcuts for quick navigation
              </p>
            </div>
            <Switch id="keyboard-shortcuts" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="default-view" className="whitespace-nowrap">
              Default View
            </Label>
            <div className="min-w-40">
              <Select defaultValue="calendar">
                <SelectTrigger id="default-view" className="w-full">
                  <SelectValue placeholder="Select default view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar">Calendar View</SelectItem>
                  <SelectItem value="tasks">Task View</SelectItem>
                  <SelectItem value="last-used">Remember Last Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>
            Export your data or delete your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Export Data</h4>
              <p className="text-sm text-muted-foreground">
                Download all your tasks, events, and settings
              </p>
            </div>
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
          </div>

          <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-destructive/5">
            <div>
              <h4 className="font-medium text-destructive">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleDeleteAccount}
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
