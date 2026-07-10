import type React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  /** 'start' when the control is multi-line/wide (segmented, slider). */
  align?: 'center' | 'start';
  children: React.ReactNode;
}

/**
 * Label left / control right. Control column min-width keeps selects aligned.
 */
export function SettingsRow({
  label,
  description,
  htmlFor,
  align = 'center',
  children,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'flex gap-6 py-2.5 justify-between',
        align === 'start' ? 'items-start' : 'items-center'
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5 pr-2">
        <Label
          htmlFor={htmlFor}
          className="text-[13px] font-medium text-foreground leading-snug"
        >
          {label}
        </Label>
        {description && (
          <p className="text-[12px] leading-snug text-ink-muted max-w-[22rem]">
            {description}
          </p>
        )}
      </div>
      <div
        className={cn(
          'shrink-0 flex justify-end',
          align === 'start' && 'pt-0.5'
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default SettingsRow;
