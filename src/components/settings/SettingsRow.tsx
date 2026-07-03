import type React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface SettingsRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  /** 'start' when the control is multi-line/wide (SharedToggleButton, RangeSlider). */
  align?: 'center' | 'start';
  /** The control. */
  children: React.ReactNode;
}

/**
 * Structural label/control row for a Settings panel. No hover/focus of its
 * own — the row is not itself an activation target; the control in the slot
 * (Switch/Select/Button/…) already carries the correct interaction states.
 * Meant to sit inside a `SettingsSection`'s `divide-y` container, or stand
 * alone in `space-y-*` for single-topic panels that need no heading.
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
        'flex gap-4 py-3.5 justify-between',
        align === 'start' ? 'items-start' : 'items-center'
      )}
    >
      <div className="space-y-0.5 min-w-0">
        <Label
          htmlFor={htmlFor}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </Label>
        {description && (
          <p className="text-[0.8125rem] text-ink-muted">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default SettingsRow;
