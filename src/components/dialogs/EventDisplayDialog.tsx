import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock as ClockIcon, MapPin, FileText, ArrowRight, AtSign } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { IntegratedActionBar } from "./IntegratedActionBar"

import type { CalendarEvent } from "@/types"
import { useCalendars } from "@/hooks/useCalendars"
import { useDeleteEvent } from "@/hooks/useEvents"
import { useUIStore } from "@/stores/uiStore"

interface EventDisplayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: CalendarEvent | null
  onEdit?: (event: CalendarEvent) => void
}

function EventDisplayDialogContent({
  event,
  onEdit,
  onClose,
}: {
  event: CalendarEvent
  onEdit?: (event: CalendarEvent) => void
  onClose: () => void
}) {
  const { data: calendars = [] } = useCalendars()

  const [isDeleting, setIsDeleting] = React.useState(false)

  const calendar = React.useMemo(() => {
    if (!event) return null
    return calendars.find(cal => cal.name === event.calendarName) || null
  }, [calendars, event])

  const formatDateTime = React.useCallback((start: Date, end: Date, allDay?: boolean) => {
    const startDate = format(start, "MMM dd, yyyy")
    
    if (allDay) {
      const endDate = format(end, "MMM dd, yyyy")
      return startDate === endDate ? startDate : `${startDate} - ${endDate}`
    } else {
      const endDate = format(end, "MMM dd, yyyy")
      const startTime = format(start, "h:mm a")
      const endTime = format(end, "h:mm a")
      
      if (startDate === endDate) {
        return { date: startDate, startTime, endTime }
      } else {
        return { text: `${startDate} at ${startTime} - ${endDate} at ${endTime}` }
      }
    }
  }, [])

  const handleEdit = React.useCallback(() => {
    if (event && onEdit) {
      onEdit(event)
      onClose()
    }
  }, [event, onEdit, onClose])


  const dateTimeInfo = formatDateTime(new Date(event.start), new Date(event.end), event.allDay)

  return (
    <>
      {/* Hidden element to receive initial focus instead of edit button */}
      <div tabIndex={0} className="sr-only" />
      
      {/* Title with Calendar Color and Name */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {calendar && (
            <div
              className="w-4 h-4 rounded-sm border-2 flex-shrink-0"
              style={{ 
                backgroundColor: calendar.color,
                borderColor: calendar.color,
              }}
            />
          )}
          <h2 className="text-xl font-semibold leading-tight">
            {event.title}
            {calendar && (
              <span className="text-sm text-muted-foreground font-normal ml-2">
                ({calendar.name})
              </span>
            )}
          </h2>
        </div>
        
        {event.allDay && (
          <Badge variant="secondary" className="w-fit">
            All Day
          </Badge>
        )}
      </div>

      <div className="space-y-6">
        {/* Date and Time */}
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground flex-shrink-0">
            {event.allDay ? (
              <CalendarIcon className="h-4 w-4" />
            ) : (
              <ClockIcon className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1">
            {event.allDay ? (
              <p className="text-sm font-medium">
                {typeof dateTimeInfo === 'string' ? dateTimeInfo : ''}
              </p>
            ) : (
              <div className="flex items-center gap-3 text-sm font-medium">
                {typeof dateTimeInfo === 'object' && 'date' in dateTimeInfo ? (
                  <>
                    <span>{dateTimeInfo.date}</span>
                    <AtSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{dateTimeInfo.startTime}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span>{dateTimeInfo.endTime}</span>
                  </>
                ) : (
                  <span>{typeof dateTimeInfo === 'object' && 'text' in dateTimeInfo ? dateTimeInfo.text : ''}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground flex-shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm">{event.location}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {event.description && (
          <div className="flex items-start gap-3">
            <div className="text-muted-foreground flex-shrink-0 mt-1">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm whitespace-pre-wrap">
                {event.description}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export function EventDisplayDialog({
  open,
  onOpenChange,
  event,
  onEdit,
}: EventDisplayDialogProps) {
  const { peekMode, setPeekMode } = useUIStore()
  const deleteEventMutation = useDeleteEvent()
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleEdit = React.useCallback(() => {
    if (event && onEdit) {
      onEdit(event)
      handleClose()
    }
  }, [event, onEdit])

  const handleDelete = React.useCallback(async () => {
    if (!event) return

    setIsDeleting(true)
    
    try {
      await deleteEventMutation.mutateAsync(event.id)
      handleClose()
    } catch (error) {
      console.error("Failed to delete event:", error)
    } finally {
      setIsDeleting(false)
    }
  }, [event, deleteEventMutation])

  const togglePeekMode = React.useCallback(() => {
    setPeekMode(peekMode === 'center' ? 'right' : 'center')
  }, [peekMode, setPeekMode])

  if (!event) {
    return null
  }

  const actionButtons = (
    <div className="absolute top-4 right-4">
      <IntegratedActionBar
        peekMode={peekMode}
        onPeekModeToggle={togglePeekMode}
        onEdit={onEdit ? handleEdit : undefined}
        onDelete={handleDelete}
        onClose={handleClose}
        isDeleting={isDeleting}
      />
    </div>
  )

  if (peekMode === 'right') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-sm p-6 [&>button]:hidden">
          <EventDisplayDialogContent
            event={event}
            onEdit={onEdit}
            onClose={handleClose}
          />
          {actionButtons}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <DialogTitle className="sr-only">{event.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Event details for {event.title} - view, edit, or delete this event
        </DialogDescription>
        <EventDisplayDialogContent
          event={event}
          onEdit={onEdit}
          onClose={handleClose}
        />
        {actionButtons}
      </DialogContent>
    </Dialog>
  )
}