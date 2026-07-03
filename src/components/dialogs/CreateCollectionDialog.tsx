/**
 * One anatomy for Create list / Create calendar (design-brief §4.5):
 * icon tile + name row, the ten curated 24px swatches, verb-first copy.
 * CreateTaskDialog and CreateCalendarDialog are thin wrappers over this so
 * the two jobs stop shipping two designs (audit §3.9).
 */
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { getIconByName } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  COLOR_PRESETS,
  COLOR_PRESET_NAMES,
  ColorPreset,
  DEFAULT_PRESET_COLOR,
} from '@/constants/colors';

const EmojiPicker = lazy(async () => ({
  default: (await import('@/components/ui/emoji-picker')).EmojiPicker,
}));
const IconPicker = lazy(async () => ({
  default: (await import('@/components/ui/icon-picker')).IconPicker,
}));

export interface CollectionFormData {
  name: string;
  description: string;
  /** Emoji character for lists, lucide icon id for calendars. */
  emoji: string;
  color: string;
}

export interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lists pick an emoji (stored on the task list); calendars a lucide icon. */
  kind: 'list' | 'calendar';
  onSubmit: (data: CollectionFormData) => void;
  initialName?: string;
  initialDescription?: string;
  /** Emoji character (list) or icon id (calendar). */
  initialIcon?: string;
  initialColor?: string;
  submitLabel?: string;
  titleLabel?: string;
}

const COPY = {
  list: {
    title: 'Create list',
    description: 'A list groups related tasks.',
    submit: 'Create list',
    namePlaceholder: 'Errands',
    defaultIcon: '📁',
  },
  calendar: {
    title: 'Create calendar',
    description: 'A calendar holds your scheduled events.',
    submit: 'Create calendar',
    namePlaceholder: 'Personal',
    defaultIcon: 'Calendar',
  },
} as const;

export const CreateCollectionDialog: React.FC<CreateCollectionDialogProps> = ({
  open,
  onOpenChange,
  kind,
  onSubmit,
  initialName,
  initialDescription,
  initialIcon,
  initialColor,
  submitLabel,
  titleLabel,
}) => {
  const copy = COPY[kind];
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [icon, setIcon] = useState(initialIcon ?? copy.defaultIcon);
  const [selectedColor, setSelectedColor] = useState<ColorPreset>(
    (initialColor as ColorPreset) ?? DEFAULT_PRESET_COLOR
  );
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setDescription(initialDescription ?? '');
      setIcon(initialIcon ?? copy.defaultIcon);
      setSelectedColor((initialColor as ColorPreset) ?? DEFAULT_PRESET_COLOR);
      setShowIconPicker(false);
      setNameTouched(false);
    }
  }, [
    open,
    initialName,
    initialDescription,
    initialIcon,
    initialColor,
    copy.defaultIcon,
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      emoji: icon,
      color: selectedColor,
    });
    onOpenChange(false);
  };

  const CalendarIconComponent =
    kind === 'calendar' ? getIconByName(icon) : null;
  const fieldId = `${kind}-name`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{titleLabel || copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Icon tile + name row (one anatomy for both dialogs) */}
            <div className="grid gap-2">
              <Label htmlFor={fieldId}>Name</Label>
              <div className="flex items-center gap-3">
                <Popover open={showIconPicker} onOpenChange={setShowIconPicker}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={
                        kind === 'list' ? 'Choose an emoji' : 'Choose an icon'
                      }
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline-strong text-lg transition-colors duration-150 hover:border-faint outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1"
                      style={{ backgroundColor: `${selectedColor}1f` }}
                    >
                      {kind === 'list'
                        ? icon
                        : CalendarIconComponent && (
                            <span
                              style={{ color: selectedColor }}
                              className="flex items-center justify-center"
                            >
                              <CalendarIconComponent className="h-5 w-5" />
                            </span>
                          )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={kind === 'list' ? 'w-fit p-0' : 'w-auto p-3'}
                    align="start"
                  >
                    <Suspense
                      fallback={
                        <div className="p-4 text-sm text-muted-foreground flex items-center gap-1">
                          Loading
                          <span className="flex gap-0.5">
                            <span
                              className="animate-pulse"
                              style={{ animationDelay: '0ms' }}
                            >
                              .
                            </span>
                            <span
                              className="animate-pulse"
                              style={{ animationDelay: '150ms' }}
                            >
                              .
                            </span>
                            <span
                              className="animate-pulse"
                              style={{ animationDelay: '300ms' }}
                            >
                              .
                            </span>
                          </span>
                        </div>
                      }
                    >
                      {kind === 'list' ? (
                        <EmojiPicker
                          selectedEmoji={icon}
                          onEmojiSelect={(e) => {
                            setIcon(e);
                            setShowIconPicker(false);
                          }}
                        />
                      ) : (
                        <IconPicker
                          selectedIcon={icon}
                          onIconSelect={(id) => {
                            setIcon(id);
                            setShowIconPicker(false);
                          }}
                        />
                      )}
                    </Suspense>
                  </PopoverContent>
                </Popover>

                <Input
                  id={fieldId}
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  placeholder={copy.namePlaceholder}
                  className="flex-1"
                  autoFocus
                  required
                  aria-invalid={nameTouched && !name.trim()}
                />
              </div>
              {nameTouched && !name.trim() && (
                <p className="text-xs text-destructive">Name is required.</p>
              )}
            </div>

            {/* The ten curated 24px swatches (§2.4) */}
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2.5">
                {COLOR_PRESETS.map((color) => {
                  const selected = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      aria-label={COLOR_PRESET_NAMES[color]}
                      aria-pressed={selected}
                      className="h-6 w-6 rounded-full transition-shadow duration-150 outline-none hover:shadow-[0_0_0_2px_var(--surface-3),0_0_0_3px_var(--hairline-strong)] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1"
                      style={{
                        backgroundColor: color,
                        boxShadow: selected
                          ? `0 0 0 2px var(--surface-3), 0 0 0 4px ${color}`
                          : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor={`${kind}-description`}>Description</Label>
              <Textarea
                id={`${kind}-description`}
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {submitLabel || copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCollectionDialog;
