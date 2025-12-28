import React, { useState, useEffect, Suspense } from 'react';
// Icon picker removed; use emoji
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
import { lazy } from 'react';
import { COLOR_PRESETS, ColorPreset } from '@/constants/colors';

const EmojiPicker = lazy(async () => ({
  default: (await import('@/components/ui/emoji-picker')).EmojiPicker,
}));

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask?: (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => void;
  onCreateCalendar?: (data: {
    name: string;
    description: string;
    emoji: string;
    color: string;
  }) => void;
  // Optional initial values to support edit reuse
  initialName?: string;
  initialDescription?: string;
  initialEmoji?: string;
  initialColor?: string;
  submitLabel?: string;
  titleLabel?: string;
}

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onOpenChange,
  onCreateTask,
  onCreateCalendar: _onCreateCalendar,
  initialName,
  initialDescription,
  initialEmoji,
  initialColor,
  submitLabel,
  titleLabel,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState(initialEmoji ?? '📁');
  const [selectedColor, setSelectedColor] = useState<ColorPreset>(
    (initialColor as ColorPreset) ?? COLOR_PRESETS[0]
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(initialName ?? '');
      setDescription(initialDescription ?? '');
      setEmoji(initialEmoji ?? '📁');
      setSelectedColor((initialColor as ColorPreset) ?? COLOR_PRESETS[0]);
    }
  }, [open, initialName, initialDescription, initialEmoji, initialColor]);

  const handleEmojiSelect = (selectedEmoji: string) => {
    setEmoji(selectedEmoji);
    setShowEmojiPicker(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    onCreateTask?.({
      name: trimmedName,
      description: description.trim(),
      emoji,
      color: selectedColor,
    });

    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{titleLabel || 'Create New Task List'}</DialogTitle>
            <DialogDescription>
              Create a new task group to organize your to-dos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Emoji and Name Row */}
            <div className="grid gap-3">
              <Label htmlFor="task-name">Name</Label>
              <div className="flex items-center gap-3">
                {/* Emoji Picker */}
                <Popover
                  open={showEmojiPicker}
                  onOpenChange={setShowEmojiPicker}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-12 h-10 text-xl p-0"
                      aria-label="Select emoji"
                      style={{
                        backgroundColor: selectedColor + '20',
                        borderColor: selectedColor,
                      }}
                    >
                      {emoji}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-fit p-0" align="start">
                    <Suspense fallback={<div className="p-4">Loading...</div>}>
                      <EmojiPicker
                        selectedEmoji={emoji}
                        onEmojiSelect={handleEmojiSelect}
                      />
                    </Suspense>
                  </PopoverContent>
                </Popover>

                {/* Name Input */}
                <Input
                  id="task-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Home Management"
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
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      selectedColor === color
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
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Getting groceries, paying bills, cleaning, renovation, kids, etc."
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
              {submitLabel || 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;
