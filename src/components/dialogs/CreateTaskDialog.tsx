import React, { useState, useEffect } from 'react';
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
// popover and icon picker removed
import { COLOR_PRESETS, ColorPreset } from '@/constants/colors';

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
    iconId: string;
    color: string;
  }) => void;
}

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onOpenChange,
  onCreateTask,
  onCreateCalendar: _onCreateCalendar, // eslint-disable-line @typescript-eslint/no-unused-vars
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [selectedColor, setSelectedColor] = useState<ColorPreset>(COLOR_PRESETS[0]);
  // legacy state removed

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setEmoji('📁');
      setSelectedColor(COLOR_PRESETS[0]);
    }
  }, [open]);

  const handleEmojiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmoji(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onCreateTask?.({
      name: trimmedName,
      description: description.trim(),
      emoji,
      color: selectedColor
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
            <DialogTitle>Create New Task List</DialogTitle>
            <DialogDescription>
              Create a new task group to organize your to-dos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Emoji and Name Row */}
            <div className="grid gap-3">
              <Label htmlFor="task-name">Name</Label>
              <div className="flex items-center gap-3">
                {/* Emoji Input */}
                <input
                  type="text"
                  value={emoji}
                  onChange={handleEmojiChange}
                  maxLength={4}
                  className="w-12 h-10 text-xl text-center rounded-md border"
                  aria-label="Task list emoji"
                  style={{ backgroundColor: selectedColor + '20', borderColor: selectedColor }}
                />
                
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
                {COLOR_PRESETS.map(color => (
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
            <Button 
              type="submit" 
              disabled={!name.trim()}
            >
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;