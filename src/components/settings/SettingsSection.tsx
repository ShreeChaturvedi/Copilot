import type React from 'react';
import { cn } from '@/lib/utils';

export interface SettingsSectionProps {
  title?: string;
  description?: string;
  first?: boolean;
  children: React.ReactNode;
}

/**
 * Section block: hairline between sections, divide-y rows inside.
 * Spacing scale locked for the settings preference window.
 */
export function SettingsSection({
  title,
  description,
  first = false,
  children,
}: SettingsSectionProps) {
  return (
    <section
      className={cn('space-y-2', !first && 'border-t border-hairline pt-5')}
    >
      {title && (
        <div className="space-y-0.5 pb-0.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            {title}
          </h3>
          {description && (
            <p className="text-[12px] text-ink-muted font-normal normal-case tracking-normal">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="divide-y divide-hairline">{children}</div>
    </section>
  );
}

export default SettingsSection;
