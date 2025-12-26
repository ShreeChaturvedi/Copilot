import React, { useState, useEffect } from 'react';
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
import { lazy, Suspense } from 'react';
const IconPicker = lazy(async () => ({ default: (await import('@/components/ui/icon-picker')).IconPicker }));
import { COLOR_PRESETS, ColorPreset } from '@/constants/colors';

export interface CreateCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCalendar?: (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => void;
  onCreateTask?: (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => void;
  // Optional initial values to support edit reuse
  initialName?: string;
  initialDescription?: string;
  initialIconId?: string;
  initialColor?: string;
  submitLabel?: string;
  titleLabel?: string;
}

export const CreateCalendarDialog: React.FC<CreateCalendarDialogProps> = ({
  open,
  onOpenChange,
  onCreateCalendar,
  onCreateTask,
  initialName,
  initialDescription,
  initialIconId,
  initialColor,
  submitLabel,
  titleLabel,
}) => {
  const [name, setName] = useState(initialName ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');
  const [selectedIcon, setSelectedIcon] = useState(initialIconId ?? 'Calendar');
  const [selectedColor, setSelectedColor] = useState<ColorPreset>((initialColor as ColorPreset) ?? COLOR_PRESETS[0]);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setDescription(initialDescription ?? '');
      setSelectedIcon(initialIconId ?? 'Calendar');
      setSelectedColor((initialColor as ColorPreset) ?? COLOR_PRESETS[0]);
      setShowIconPicker(false);
    }
  }, [open, initialName, initialDescription, initialIconId, initialColor]);

  const handleIconSelect = (iconId: string) => {
    setSelectedIcon(iconId);
    setShowIconPicker(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    const data = {
      name: trimmedName,
      description: description.trim(),
      emoji: selectedIcon,
      color: selectedColor
    };

    // Call whichever callback is provided
    if (onCreateCalendar) {
      onCreateCalendar(data);
    } else if (onCreateTask) {
      onCreateTask(data);
    }

    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const SelectedIconComponent = getIconByName(selectedIcon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{titleLabel || 'Create New Calendar'}</DialogTitle>
            <DialogDescription>
              Create a new calendar to organize your events and appointments.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Icon and Name Row */}
            <div className="grid gap-3">
              <Label htmlFor="calendar-name">Name</Label>
              <div className="flex items-center gap-3">
                {/* Icon Display - Clickable */}
                <div className="flex-shrink-0">
                  <Popover open={showIconPicker} onOpenChange={setShowIconPicker}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-10 h-10 p-0 hover:bg-accent"
                        style={{ backgroundColor: selectedColor + '20', borderColor: selectedColor }}
                      >
                        {SelectedIconComponent && (
                          <div style={{ color: selectedColor }}>
                            <SelectedIconComponent className="w-5 h-5" />
                          </div>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <Suspense fallback={null}>
                        <IconPicker
                          selectedIcon={selectedIcon}
                          onIconSelect={handleIconSelect}
                        />
                      </Suspense>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Name Input */}
                <Input
                  id="calendar-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Holiday Planning"
                  className="flex-1"
                  autoFocus
                  required
                />
              </div>
            </div>



            {/* Color Picker */}
            <div className="grid gap-3">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:border-border'
                      }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-3">
              <Label htmlFor="calendar-description">Description</Label>
              <Textarea
                id="calendar-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Travelling, food, life, and social events. On road way to 100+ countries!"
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {submitLabel || 'Create Calendar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCalendarDialog;