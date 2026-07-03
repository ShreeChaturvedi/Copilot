import * as React from 'react';
import { PanelRight, PictureInPicture2 } from 'lucide-react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { IntegratedActionBar } from './IntegratedActionBar';

interface ConditionalDialogHeaderProps {
  isEditing: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  peekMode: 'center' | 'right';
  onPeekModeToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  isDeleting?: boolean;
  className?: string;
  /** Edit-mode anchor so mid-edit there's still an on-screen confirmation of
   *  which record is being edited. Omit to keep the action bar right-aligned
   *  on its own (no left-side content). */
  title?: string;
}

export const ConditionalDialogHeader: React.FC<
  ConditionalDialogHeaderProps
> = ({
  isEditing,
  activeTab,
  onTabChange,
  peekMode,
  onPeekModeToggle,
  onEdit,
  onDelete,
  onClose,
  isDeleting,
  className,
  title,
}) => {
  if (isEditing) {
    // Edit mode: title (when given) anchors the left side; IntegratedActionBar
    // stays right-aligned. No title falls back to justify-end so the action
    // bar keeps its original position.
    return (
      <div
        className={cn(
          'flex items-center gap-2 mb-4',
          title ? 'justify-between' : 'justify-end',
          className
        )}
      >
        {title && (
          <h2 className="text-base font-semibold tracking-[-0.01em] leading-tight truncate min-w-0">
            {title}
          </h2>
        )}
        <IntegratedActionBar
          peekMode={peekMode}
          onPeekModeToggle={onPeekModeToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onClose={onClose}
          isDeleting={isDeleting}
          className="shrink-0"
        />
      </div>
    );
  }

  // Create mode: Show tabs with peek mode switcher
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="event" aria-label="Create event">
              Event
            </TabsTrigger>
            <TabsTrigger value="task" aria-label="Create task">
              Task
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon"
          onClick={onPeekModeToggle}
          className="ml-3 shrink-0"
          aria-label={`Switch to ${peekMode === 'center' ? 'right panel' : 'center'} mode`}
        >
          {peekMode === 'center' ? (
            <PanelRight className="h-4 w-4" />
          ) : (
            <PictureInPicture2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
