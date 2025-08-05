import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
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
import { IconPicker } from '@/components/ui/icon-picker';
import { COLOR_PRESETS } from '@/constants/colors';

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (data: {
    name: string;
    description: string;
    iconId: string;
    color: string;
  }) => void;
}

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onOpenChange,
  onCreateTask
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Home');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setSelectedIcon('Home');
      setSelectedColor(COLOR_PRESETS[0]);
      setShowIconPicker(false);
    }
  }, [open]);

  const handleIconSelect = (iconId: string) => {
    setSelectedIcon(iconId);
    setShowIconPicker(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) return;

    onCreateTask({
      name: trimmedName,
      description: description.trim(),
      iconId: selectedIcon,
      color: selectedColor
    });

    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const SelectedIconComponent = LucideIcons[selectedIcon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>;

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
            {/* Icon and Name Row */}
            <div className="grid gap-3">
              <Label htmlFor="task-name">Name</Label>
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
                          <SelectedIconComponent 
                            className="w-5 h-5" 
                            style={{ color: selectedColor }}
                          />
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <IconPicker
                        selectedIcon={selectedIcon}
                        onIconSelect={handleIconSelect}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
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