import type React from 'react';
import { cn } from '@/lib/utils';

export interface SettingsSectionProps {
  /** Omit entirely for single-topic panels whose heading is already stated once at the dialog level. */
  title?: string;
  /** Sparing use — only when it adds information the title doesn't already say. */
  description?: string;
  /** True on the first section in a panel: no top rule, no top padding. */
  first?: boolean;
  children: React.ReactNode;
}

/**
 * Structural section wrapper for a Settings panel — no border/background/shadow
 * of its own. Section-to-section separation is a single `border-t border-hairline`
 * rule (never a box); row-to-row separation inside is a single hairline via
 * `divide-y` on the row container. Two scopes of the same token, replacing the
 * Card-in-Card-in-Card nesting the pre-redesign panels used.
 */
export function SettingsSection({
  title,
  description,
  first = false,
  children,
}: SettingsSectionProps) {
  return (
    <section
      className={cn('space-y-3', !first && 'border-t border-hairline pt-8')}
    >
      {title && (
        <div className="space-y-0.5">
          <h3 className="text-[0.9375rem] font-semibold tracking-[-0.005em] text-foreground">
            {title}
          </h3>
          {description && (
            <p className="text-[0.8125rem] text-ink-muted">{description}</p>
          )}
        </div>
      )}
      <div className="divide-y divide-hairline">{children}</div>
    </section>
  );
}

export default SettingsSection;
