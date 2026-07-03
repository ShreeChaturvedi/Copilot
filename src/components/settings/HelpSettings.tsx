import { Button } from '@/components/ui/Button';
import { ExternalLink } from 'lucide-react';
import { SettingsRow } from './SettingsRow';

const helpItems = [
  {
    title: 'Documentation',
    description: 'Comprehensive guides and tutorials',
    action: 'View Docs',
    href: 'https://developer.mozilla.org',
  },
  {
    title: 'Contact Support',
    description: 'Get help from our support team',
    action: 'Contact Us',
    href: 'mailto:support@example.com',
  },
  {
    title: 'Community',
    description: 'Join our community discussions',
    action: 'Join Community',
    href: 'https://stackoverflow.com',
  },
];

export function HelpSettings() {
  // Single-topic panel — no section heading, the dialog header already says
  // "Help & Support / Get help, documentation, and support" once (§2.7).
  return (
    <div>
      <div className="divide-y divide-hairline">
        {helpItems.map((item) => (
          <SettingsRow
            key={item.title}
            label={item.title}
            description={item.description}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(item.href, '_blank')}
            >
              {item.action}
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          </SettingsRow>
        ))}
      </div>

      {/* Quiet mono meta-footer, replacing the old "Application Information"
          Card. "Last Updated" is dropped entirely — it rendered new Date()
          on every render, which was simply wrong, not just unstyled (§1.F). */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-hairline pt-4 font-mono text-[0.6875rem] tracking-[0.04em] uppercase text-ink-muted">
        <span>v1.0.0</span>
        <span aria-hidden="true">·</span>
        <span>{import.meta.env.DEV ? 'Development' : 'Production'}</span>
      </div>
    </div>
  );
}
