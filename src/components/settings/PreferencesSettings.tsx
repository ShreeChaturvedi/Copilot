import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function PreferencesSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Workspace Preferences
            <Badge variant="outline" className="text-xs">
              Coming Soon
            </Badge>
          </CardTitle>
          <CardDescription>
            Customize your workspace settings and default preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 sm:py-8">
            <p className="text-muted-foreground text-lg">
              Workspace preferences will be available soon.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This will include theme settings, default views, and workspace
              customizations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
