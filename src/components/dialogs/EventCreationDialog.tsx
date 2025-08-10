import * as React from "react"
import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { addHours, format } from "date-fns"
import { MapPin, FileText, ArrowRight, Calendar, Clock, Check, AtSign } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import {
  Tabs,
  TabsContent,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarPicker } from "@/components/ui/calendar"

import type { CalendarEvent } from "@shared/types"
import { useCalendars } from "@/hooks/useCalendars"
import { useCreateEvent, useUpdateEvent } from "@/hooks/useEvents"
import { useUIStore } from "@/stores/uiStore"
import { ConditionalDialogHeader } from "./ConditionalDialogHeader"
//
import RecurrenceSection from "./RecurrenceSection"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface EventCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEventData?: Partial<CalendarEvent>
}

interface EventFormData {
  title: string
  startDate: Date | undefined
  endDate: Date | undefined  // New field for all-day event support
  startTime: string
  endTime: string
  allDay: boolean
  description: string
  location: string
  calendarName: string
  recurrence?: string
  exceptions?: string[]
}


function CustomDateInput({ value, onChange, className }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}) {
  const [showPicker, setShowPicker] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleIconClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowPicker(true)
  }

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Prevent the native date picker from opening
    e.preventDefault()
    // Allow normal text selection behavior
    if (inputRef.current) {
      inputRef.current.select()
    }
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      const syntheticEvent = {
        target: { value: formattedDate }
      } as React.ChangeEvent<HTMLInputElement>
      onChange(syntheticEvent)
    }
    setShowPicker(false)
  }

  const selectedDate = value ? new Date(value) : undefined

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="date"
        value={value}
        onChange={onChange}
        onClick={handleInputClick}
        className={`pr-8 [&::-webkit-calendar-picker-indicator]:hidden ${className}`}
      />
      <Popover open={showPicker} onOpenChange={setShowPicker} modal={true}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleIconClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors z-10"
          >
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            captionLayout="dropdown"
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

function CustomTimeInput({ value, onChange, className }: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}) {
  const [showPicker, setShowPicker] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [selectedHour, setSelectedHour] = React.useState<number>(12)
  const [selectedMinute, setSelectedMinute] = React.useState<number>(0)
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>('AM')

  const handleIconClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowPicker(true)
  }

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Prevent the native time picker from opening
    e.preventDefault()
    // Allow normal text selection behavior
    if (inputRef.current) {
      inputRef.current.select()
    }
  }

  // Parse current time value and sync with local state
  React.useEffect(() => {
    if (!value) {
      setSelectedHour(12)
      setSelectedMinute(0)
      setSelectedPeriod('AM')
      return
    }
    
    const [hours, minutes] = value.split(':').map(Number)
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    const period = hours >= 12 ? 'PM' : 'AM'
    
    setSelectedHour(hour12)
    setSelectedMinute(minutes)
    setSelectedPeriod(period)
  }, [value])

  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour)
  }

  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute)
  }

  const handlePeriodSelect = (period: string) => {
    setSelectedPeriod(period)
  }

  const handleConfirm = () => {
    const hour24 = selectedPeriod === 'AM' 
      ? (selectedHour === 12 ? 0 : selectedHour)
      : (selectedHour === 12 ? 12 : selectedHour + 12)
    
    const timeString = `${hour24.toString().padStart(2, '0')}:${selectedMinute.toString().padStart(2, '0')}`
    const syntheticEvent = {
      target: { value: timeString }
    } as React.ChangeEvent<HTMLInputElement>
    onChange(syntheticEvent)
    setShowPicker(false)
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="time"
        value={value}
        onChange={onChange}
        onClick={handleInputClick}
        className={`pr-8 [&::-webkit-calendar-picker-indicator]:hidden ${className}`}
      />
      <Popover open={showPicker} onOpenChange={setShowPicker} modal={true}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={handleIconClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors z-10"
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="flex gap-1">
              {/* Hours Column */}
              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">Hour</div>
                <div className="h-32 w-16 rounded border border-border relative overflow-hidden">
                  {/* Fade overlays */}
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-popover to-transparent pointer-events-none z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-popover to-transparent pointer-events-none z-10" />
                  
                  <div 
                    className="h-full w-full scrollbar-hide"
                    style={{
                      overflowY: 'scroll',
                      overflowX: 'hidden',
                      touchAction: 'pan-y'
                    }}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                      <div
                        key={hour}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleHourSelect(hour)
                        }}
                        className={`w-full px-2 py-2 text-sm transition-colors flex items-center justify-center cursor-pointer ${
                          selectedHour === hour 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-accent'
                        }`}
                        style={{ height: '32px', minHeight: '32px' }}
                      >
                        {hour}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Minutes Column */}
              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">Min</div>
                <div className="h-32 w-16 rounded border border-border relative overflow-hidden">
                  {/* Fade overlays */}
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-popover to-transparent pointer-events-none z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-popover to-transparent pointer-events-none z-10" />
                  
                  <div 
                    className="h-full w-full scrollbar-hide"
                    style={{
                      overflowY: 'scroll',
                      overflowX: 'hidden',
                      touchAction: 'pan-y'
                    }}
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                      <div
                        key={minute}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMinuteSelect(minute)
                        }}
                        className={`w-full px-2 py-2 text-sm transition-colors flex items-center justify-center cursor-pointer ${
                          selectedMinute === minute 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-accent'
                        }`}
                        style={{ height: '32px', minHeight: '32px' }}
                      >
                        {minute.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AM/PM Column */}
              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">Period</div>
                <div className="h-32 w-16 rounded border border-border relative flex flex-col">
                  {['AM', 'PM'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePeriodSelect(period)
                      }}
                      className={`flex-1 px-2 py-4 text-sm transition-colors ${
                        selectedPeriod === period 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-accent'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date()
                  const currentHour = now.getHours()
                  const currentMinute = now.getMinutes()
                  const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour
                  const period = currentHour >= 12 ? 'PM' : 'AM'
                  setSelectedHour(hour12)
                  setSelectedMinute(currentMinute)
                  setSelectedPeriod(period)
                  handleConfirm()
                }}
              >
                Now
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleConfirm}
                className="p-2"
              >
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}


function EventCreationDialogContent({
  initialEventData,
  onClose,
}: {
  initialEventData?: Partial<CalendarEvent>
  onClose: () => void
}) {
  const { data: calendars = [] } = useCalendars()
  const createEventMutation = useCreateEvent()
  const updateEventMutation = useUpdateEvent()
  const { peekMode, setPeekMode } = useUIStore()
  
  // Check if we're editing an existing event
  const isEditing = Boolean(initialEventData?.id)

  // Get default calendar for initial form data
  const defaultCalendar = useMemo(() => {
    return calendars.find(cal => cal.isDefault) || calendars[0] || null
  }, [calendars])

  // Form state with enhanced multi-day support
  const [formData, setFormData] = useState<EventFormData>(() => {
    const now = new Date()
    const oneHourLater = addHours(now, 1)
    
    return {
      title: initialEventData?.title || "",
      startDate: initialEventData?.start || now,
      endDate: initialEventData?.end || now, // Default to same day for all-day events
      startTime: initialEventData?.start ? format(initialEventData.start, 'HH:mm') : format(now, 'HH:mm'),
      endTime: initialEventData?.end ? format(initialEventData.end, 'HH:mm') : format(oneHourLater, 'HH:mm'),
      allDay: initialEventData?.allDay || false,
      description: initialEventData?.description || "",
      location: initialEventData?.location || "",
      calendarName: initialEventData?.calendarName || defaultCalendar?.name || "",
      recurrence: initialEventData?.recurrence,
      exceptions: initialEventData?.exceptions || [],
    }
  })

  const [activeTab, setActiveTab] = useState("event")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<null | {
    start: Date,
    end: Date,
    data: {
      title: string,
      allDay: boolean,
      description: string,
      location: string,
      calendarName: string,
      recurrence?: string,
      exceptions?: string[],
    }
  }>(null)
  
  // Ref for the title input to focus it when creating
  const titleInputRef = useRef<HTMLInputElement>(null)
  
  // Focus the title input when creating a new event (not editing)
  useEffect(() => {
    if (!isEditing && titleInputRef.current) {
      // Small delay to ensure the dialog is fully rendered
      const timeoutId = setTimeout(() => {
        titleInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isEditing])

  // Reset form when initial data changes
  React.useEffect(() => {
    const now = new Date()
    const oneHourLater = addHours(now, 1)
    
    setFormData({
      title: initialEventData?.title || "",
      startDate: initialEventData?.start || now,
      endDate: initialEventData?.end || now, // Default to same day for all-day events
      startTime: initialEventData?.start ? format(initialEventData.start, 'HH:mm') : format(now, 'HH:mm'),
      endTime: initialEventData?.end ? format(initialEventData.end, 'HH:mm') : format(oneHourLater, 'HH:mm'),
      allDay: initialEventData?.allDay || false,
      description: initialEventData?.description || "",
      location: initialEventData?.location || "",
      calendarName: initialEventData?.calendarName || defaultCalendar?.name || "",
      recurrence: initialEventData?.recurrence,
      exceptions: initialEventData?.exceptions || [],
    })
    setActiveTab("event")
  }, [initialEventData, defaultCalendar])

  // Create calendar options for combobox
  const calendarOptions: ComboboxOption[] = useMemo(() => {
    return calendars.map((calendar) => ({
      value: calendar.name,
      label: calendar.name,
      icon: (
        <div
          className="w-3 h-3 rounded-sm border"
          style={{ 
            backgroundColor: calendar.color,
            borderColor: calendar.color,
          }}
        />
      ),
    }))
  }, [calendars])

  // Calculate width based on longest calendar name
  const calendarSelectWidth = useMemo(() => {
    if (calendars.length === 0) return "w-48" // Default fallback
    
    const longestName = calendars.reduce((longest, calendar) => 
      calendar.name.length > longest.length ? calendar.name : longest, ""
    )
    
    // Estimate width: ~0.6rem per character + padding + icon space
    const estimatedChars = longestName.length + 8 // Extra for padding and icon
    
    if (estimatedChars <= 16) return "w-32"
    if (estimatedChars <= 20) return "w-40" 
    if (estimatedChars <= 24) return "w-48"
    if (estimatedChars <= 28) return "w-56"
    if (estimatedChars <= 32) return "w-64"
    return "w-72" // Max reasonable width
  }, [calendars])



  const updateFormData = useCallback(<K extends keyof EventFormData>(
    field: K,
    value: EventFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleStartDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value
    if (dateValue) {
      const newStartDate = new Date(dateValue)
      updateFormData("startDate", newStartDate)
      
      // If start date is after end date, adjust end date
      if (formData.endDate && newStartDate > formData.endDate) {
        updateFormData("endDate", newStartDate)
      }
    }
  }, [updateFormData, formData.endDate])

  const handleEndDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value
    if (dateValue) {
      const newEndDate = new Date(dateValue)
      // Prevent end date from being before start date
      if (formData.startDate && newEndDate < formData.startDate) {
        return
      }
      updateFormData("endDate", newEndDate)
    }
  }, [updateFormData, formData.startDate])

  const handleStartTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value
    updateFormData("startTime", timeValue)
    
    // Auto-adjust end time if start time is after end time
    if (timeValue && formData.endTime && timeValue >= formData.endTime) {
      const startTime = new Date(`1970-01-01T${timeValue}:00`)
      const endTime = addHours(startTime, 1)
      updateFormData("endTime", format(endTime, 'HH:mm'))
    }
  }, [formData.endTime, updateFormData])

  const handleEndTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value
    // Ensure end time is not before start time
    if (timeValue && formData.startTime && timeValue <= formData.startTime) {
      return
    }
    updateFormData("endTime", timeValue)
  }, [formData.startTime, updateFormData])

  const handleAllDayChange = useCallback((allDay: boolean) => {
    setFormData(prev => {
      if (allDay) {
        // When switching to all-day, ensure end date is set
        return {
          ...prev,
          allDay,
          endDate: prev.endDate || prev.startDate
        }
      } else {
        // When switching to timed, keep the dates but focus on times
        return {
          ...prev,
          allDay
        }
      }
    })
  }, [])

  // Create start and end Date objects for submission with multi-day support
  const getStartDateTime = useCallback(() => {
    if (!formData.startDate) return undefined
    
    if (formData.allDay) {
      const startOfDay = new Date(formData.startDate)
      startOfDay.setHours(0, 0, 0, 0)
      return startOfDay
    } else {
      const [hours, minutes] = formData.startTime.split(':').map(Number)
      const dateTime = new Date(formData.startDate)
      dateTime.setHours(hours, minutes, 0, 0)
      return dateTime
    }
  }, [formData.startDate, formData.startTime, formData.allDay])

  const getEndDateTime = useCallback(() => {
    if (formData.allDay) {
      if (!formData.endDate) return undefined
      const endOfDay = new Date(formData.endDate)
      endOfDay.setHours(23, 59, 59, 999)
      return endOfDay
    } else {
      if (!formData.startDate) return undefined
      const [hours, minutes] = formData.endTime.split(':').map(Number)
      const dateTime = new Date(formData.startDate)
      dateTime.setHours(hours, minutes, 0, 0)
      return dateTime
    }
  }, [formData.startDate, formData.endDate, formData.endTime, formData.allDay])

  // Enhanced form validation with multi-day event support
  const isFormValid = useMemo(() => {
    const hasTitle = formData.title.trim().length > 0
    const hasCalendar = Boolean(formData.calendarName)
    const hasStartDate = Boolean(formData.startDate)
    
    if (formData.allDay) {
      const hasEndDate = Boolean(formData.endDate)
      const validDateRange = formData.startDate && formData.endDate && 
                            formData.endDate >= formData.startDate
      return hasTitle && hasCalendar && hasStartDate && hasEndDate && validDateRange
    } else {
      const hasValidTimes = Boolean(formData.startTime && formData.endTime)
      const validTimeRange = formData.startTime < formData.endTime
      return hasTitle && hasCalendar && hasStartDate && hasValidTimes && validTimeRange
    }
  }, [formData])

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return

    const startDateTime = getStartDateTime()
    const endDateTime = getEndDateTime()
    
    if (!startDateTime || !endDateTime) return

    setIsSubmitting(true)
    
    try {
      if (isEditing && initialEventData?.id) {
        // If original event is recurring, show scope dialog AFTER save
        if (initialEventData?.recurrence) {
          setPendingPayload({
            start: startDateTime,
            end: endDateTime,
            data: {
              title: formData.title.trim(),
              allDay: formData.allDay,
              description: formData.description.trim(),
              location: formData.location.trim(),
              calendarName: formData.calendarName,
              recurrence: formData.recurrence,
              exceptions: formData.exceptions,
            }
          })
          setScopeDialogOpen(true)
          setIsSubmitting(false)
          return
        }
        // Non-recurring: regular update
        await updateEventMutation.mutateAsync({
          id: initialEventData.id,
          data: {
            title: formData.title.trim(),
            start: startDateTime,
            end: endDateTime,
            allDay: formData.allDay,
            description: formData.description.trim(),
            location: formData.location.trim(),
            calendarName: formData.calendarName,
            recurrence: formData.recurrence,
            exceptions: formData.exceptions,
          }
        })
      } else {
        // Create new event
        await createEventMutation.mutateAsync({
          title: formData.title.trim(),
          start: startDateTime,
          end: endDateTime,
          allDay: formData.allDay,
          description: formData.description.trim(),
          location: formData.location.trim(),
          calendarName: formData.calendarName,
          recurrence: formData.recurrence,
          exceptions: formData.exceptions,
        })
      }

      onClose()
    } catch (error) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} event:`, error)
      // Error handling could be improved with toast notifications
    } finally {
      setIsSubmitting(false)
    }
  }, [isFormValid, formData, createEventMutation, updateEventMutation, isEditing, initialEventData?.id, onClose, getStartDateTime, getEndDateTime])

  const handleCancel = useCallback(() => {
    onClose()
  }, [onClose])

  const togglePeekMode = useCallback(() => {
    setPeekMode(peekMode === 'center' ? 'right' : 'center')
  }, [peekMode, setPeekMode])

  return (
    <>
      {/* Hidden element to receive initial focus instead of form elements */}
      <div tabIndex={0} className="sr-only" />
      
      <ConditionalDialogHeader
        isEditing={isEditing}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        peekMode={peekMode}
        onPeekModeToggle={togglePeekMode}
        onClose={onClose}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="event" className={`space-y-6 ${isEditing ? 'mt-0' : 'mt-6'}`}>
          {/* Event Name and Calendar Selection */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                ref={titleInputRef}
                id="event-title"
                placeholder="Event name"
                value={formData.title}
                onChange={(e) => updateFormData("title", e.target.value)}
                className="w-full"
              />
            </div>
            <div className={`${calendarSelectWidth} max-w-[50%]`}>
              <Combobox
                options={calendarOptions}
                value={formData.calendarName}
                onValueChange={(value) => updateFormData("calendarName", value)}
                placeholder="Select calendar..."
                searchPlaceholder="Search calendars..."
                emptyText="No calendars found."
                className="w-full"
              />
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="all-day"
              checked={formData.allDay}
              onCheckedChange={handleAllDayChange}
            />
            <Label htmlFor="all-day" className="text-sm font-medium">
              All day
            </Label>
          </div>

          {/* Date and Time Selection */}
          <div className="flex items-center gap-3">
            <CustomDateInput
              value={formData.startDate ? format(formData.startDate, 'yyyy-MM-dd') : ''}
              onChange={handleStartDateChange}
              className="w-auto"
            />
            {!formData.allDay && (
              <>
                <AtSign className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <CustomTimeInput
                  value={formData.startTime}
                  onChange={handleStartTimeChange}
                  className="w-auto"
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <CustomTimeInput
                  value={formData.endTime}
                  onChange={handleEndTimeChange}
                  className="w-auto"
                />
              </>
            )}
            {formData.allDay && (
              <>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <CustomDateInput
                  value={formData.endDate ? format(formData.endDate, 'yyyy-MM-dd') : ''}
                  onChange={handleEndDateChange}
                  className="w-auto"
                />
              </>
            )}
          </div>

          {/* Location */}
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={formData.location}
              onChange={(e) => updateFormData("location", e.target.value)}
              placeholder="Add location"
              className="pl-10"
            />
          </div>

          {/* Description */}
          <div className="relative">
            <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Textarea
              value={formData.description}
              onChange={(e) => updateFormData("description", e.target.value)}
              placeholder="Add description"
              className="pl-10 min-h-[40px] resize-none"
              style={{
                maxHeight: '4.5rem',
                overflowY: formData.description.split('\n').length > 3 ? 'auto' : 'hidden'
              }}
              rows={1}
            />
          </div>

          {/* Recurrence (Repeat) Section */}
          <RecurrenceSection
            startDateTime={getStartDateTime()}
            value={formData.recurrence}
            onChange={(rrule) => updateFormData('recurrence', rrule || undefined)}
            onClearExceptions={() => updateFormData('exceptions', [])}
            exceptions={formData.exceptions || []}
            showSummary={false}
          />
        </TabsContent>

        <TabsContent value="task" className={`space-y-4 ${isEditing ? 'mt-0' : 'mt-6'}`}>
          <div className="text-center py-8 text-muted-foreground">
            <p>Task creation form will be implemented here.</p>
            <p className="text-sm mt-2">Coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 mt-6">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save" : "Create Event")}
        </Button>
      </div>

      {/* Post-save scope dialog for editing recurring events */}
      <AlertDialog open={scopeDialogOpen} onOpenChange={setScopeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply changes</AlertDialogTitle>
            <AlertDialogDescription>
              This is a recurring event. Which events should be updated?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!initialEventData?.id || !pendingPayload) return;
                // This event: exclude the occurrence, create one-off with changes
                const iso = new Date(initialEventData.occurrenceInstanceStart || initialEventData.start!).toISOString();
                const exceptions = Array.from(new Set([...(initialEventData.exceptions || []), iso]));
                await updateEventMutation.mutateAsync({ id: initialEventData.id as string, data: { exceptions } });
                await createEventMutation.mutateAsync({
                  title: pendingPayload.data.title,
                  start: pendingPayload.start,
                  end: pendingPayload.end,
                  allDay: pendingPayload.data.allDay,
                  description: pendingPayload.data.description,
                  location: pendingPayload.data.location,
                  calendarName: pendingPayload.data.calendarName,
                  color: initialEventData.color,
                });
                setScopeDialogOpen(false);
                onClose();
              }}
            >
              This event
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                if (!initialEventData?.id || !pendingPayload) return;
                // This and following: clamp rule to UNTIL just before this occurrence, then create follow-up updated rule if needed
                const { clampRRuleUntil } = await import('@/utils/recurrence');
                const occStart = new Date(initialEventData.occurrenceInstanceStart || initialEventData.start!);
                const clamped = clampRRuleUntil(initialEventData.recurrence!, occStart);
                await updateEventMutation.mutateAsync({ id: initialEventData.id as string, data: { recurrence: clamped } });
                // Create a new event to represent the updated rule from this point forward if user kept a recurrence.
                await createEventMutation.mutateAsync({
                  title: pendingPayload.data.title,
                  start: pendingPayload.start,
                  end: pendingPayload.end,
                  allDay: pendingPayload.data.allDay,
                  description: pendingPayload.data.description,
                  location: pendingPayload.data.location,
                  calendarName: pendingPayload.data.calendarName,
                  color: initialEventData.color,
                  recurrence: pendingPayload.data.recurrence,
                });
                setScopeDialogOpen(false);
                onClose();
              }}
            >
              This and following
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (!initialEventData?.id || !pendingPayload) return;
                // All events: update the master with new values
                await updateEventMutation.mutateAsync({
                  id: initialEventData.id as string,
                  data: {
                    title: pendingPayload.data.title,
                    start: pendingPayload.start,
                    end: pendingPayload.end,
                    allDay: pendingPayload.data.allDay,
                    description: pendingPayload.data.description,
                    location: pendingPayload.data.location,
                    calendarName: pendingPayload.data.calendarName,
                    recurrence: pendingPayload.data.recurrence,
                    exceptions: pendingPayload.data.exceptions,
                  }
                });
                setScopeDialogOpen(false);
                onClose();
              }}
            >
              All events
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function EventCreationDialog({
  open,
  onOpenChange,
  initialEventData,
}: EventCreationDialogProps) {
  const { peekMode } = useUIStore()

  const handleClose = () => {
    onOpenChange(false)
  }

  if (peekMode === 'right') {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-6 [&>button]:hidden">
          <EventCreationDialogContent
            initialEventData={initialEventData}
            onClose={handleClose}
          />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] md:max-w-[640px] max-h-[90vh] overflow-y-auto" showCloseButton={false}>
        <DialogTitle className="sr-only">Create Event</DialogTitle>
        <DialogDescription className="sr-only">
          Create a new event with title, date, time, location, and description
        </DialogDescription>
        <EventCreationDialogContent
          initialEventData={initialEventData}
          onClose={handleClose}
        />
      </DialogContent>
    </Dialog>
  )
}