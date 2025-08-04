import * as React from "react"
import { PanelRight, PictureInPicture2 } from "lucide-react"

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { IntegratedActionBar } from "./IntegratedActionBar"

interface ConditionalDialogHeaderProps {
  isEditing: boolean
  activeTab: string
  onTabChange: (tab: string) => void
  peekMode: 'center' | 'right'
  onPeekModeToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
  onClose?: () => void
  isDeleting?: boolean
  className?: string
}

export const ConditionalDialogHeader: React.FC<ConditionalDialogHeaderProps> = ({
  isEditing,
  activeTab,
  onTabChange,
  peekMode,
  onPeekModeToggle,
  onEdit,
  onDelete,
  onClose,
  isDeleting,
  className
}) => {
  if (isEditing) {
    // Edit mode: Show IntegratedActionBar with proper button positioning
    return (
      <div className={cn("flex items-center justify-end mb-4", className)}>
        <IntegratedActionBar
          peekMode={peekMode}
          onPeekModeToggle={onPeekModeToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onClose={onClose}
          isDeleting={isDeleting}
        />
      </div>
    )
  }

  // Create mode: Show tabs with peek mode switcher
  return (
    <div className={cn("space-y-4", className)}>
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
          size="sm"
          onClick={onPeekModeToggle}
          className="ml-3 p-2 shrink-0"
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
  )
}