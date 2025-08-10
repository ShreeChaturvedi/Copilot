import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SecuritySettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Security & Authentication
            <Badge variant="outline" className="text-xs">
              Coming Soon
            </Badge>
          </CardTitle>
          <CardDescription>
            Manage your password, two-factor authentication, and security
            preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 sm:py-8">
            <p className="text-muted-foreground text-lg">
              Security settings will be available soon.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This will include password changes, 2FA setup, and security
              preferences.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
