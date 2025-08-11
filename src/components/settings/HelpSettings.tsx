import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { ExternalLink, Mail, MessageCircle, Book } from 'lucide-react';

export function HelpSettings() {
  const helpItems = [
    {
      title: 'Documentation',
      description: 'Comprehensive guides and tutorials',
      icon: Book,
      action: 'View Docs',
      href: 'https://developer.mozilla.org',
    },
    {
      title: 'Contact Support',
      description: 'Get help from our support team',
      icon: Mail,
      action: 'Contact Us',
      href: 'mailto:support@example.com',
    },
    {
      title: 'Community',
      description: 'Join our community discussions',
      icon: MessageCircle,
      action: 'Join Community',
      href: 'https://stackoverflow.com',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Help & Support</CardTitle>
          <CardDescription>
            Get help, find documentation, and contact support
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {helpItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-muted rounded-md">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(item.href, '_blank')}
                  >
                    {item.action}
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application Information</CardTitle>
          <CardDescription>Version and system information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version:</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated:</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment:</span>
              <span>{import.meta.env.DEV ? 'Development' : 'Production'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
