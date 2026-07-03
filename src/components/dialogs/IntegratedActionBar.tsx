import * as React from 'react';
import { Pencil, Trash2, PanelRight, PictureInPicture2, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface IntegratedActionBarProps {
  peekMode: 'center' | 'right';
  onPeekModeToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
  isDeleting?: boolean;
  className?: string;
  showPeekToggle?: boolean;
  /** What the actions operate on; used in aria-labels ("Edit task", #58) */
  subject?: string;
}

export const IntegratedActionBar: React.FC<IntegratedActionBarProps> = ({
  peekMode,
  onPeekModeToggle,
  onEdit,
  onDelete,
  onClose,
  isDeleting = false,
  className,
  showPeekToggle = true,
  subject = 'event',
}) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {onEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="p-2"
              aria-label={`Edit ${subject}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      )}

      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="p-2 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
              aria-label={`Delete ${subject}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete</TooltipContent>
        </Tooltip>
      )}

      {showPeekToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onPeekModeToggle}
              className="p-2"
              aria-label={`Switch to ${peekMode === 'center' ? 'right panel' : 'center'} mode`}
            >
              {peekMode === 'center' ? (
                <PanelRight className="h-4 w-4" />
              ) : (
                <PictureInPicture2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {peekMode === 'center'
              ? 'Switch to right panel'
              : 'Switch to center'}
          </TooltipContent>
        </Tooltip>
      )}

      {onClose && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Close</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
