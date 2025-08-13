import * as React from "react"
import { Pencil, Trash2, PanelRight, PictureInPicture2, X } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface IntegratedActionBarProps {
  peekMode: 'center' | 'right'
  onPeekModeToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
  onClose?: () => void
  isDeleting?: boolean
  className?: string
  showPeekToggle?: boolean
}

export const IntegratedActionBar: React.FC<IntegratedActionBarProps> = ({
  peekMode,
  onPeekModeToggle,
  onEdit,
  onDelete,
  onClose,
  isDeleting = false,
  className,
  showPeekToggle = true
}) => {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="p-2 hover:bg-accent hover:text-accent-foreground"
          aria-label="Edit event"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="p-2 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-50"
          aria-label="Delete event"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      
      {showPeekToggle && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onPeekModeToggle}
          className="p-2 hover:bg-accent hover:text-accent-foreground"
          aria-label={`Switch to ${peekMode === 'center' ? 'right panel' : 'center'} mode`}
        >
          {peekMode === 'center' ? (
            <PanelRight className="h-4 w-4" />
          ) : (
            <PictureInPicture2 className="h-4 w-4" />
          )}
        </Button>
      )}

      {onClose && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="p-2 hover:bg-accent hover:text-accent-foreground"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}