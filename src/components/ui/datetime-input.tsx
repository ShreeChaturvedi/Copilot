import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Calendar as CalendarIcon, Clock as ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "./Input"
import { Button } from "./Button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Switch } from "./switch"
import { Label } from "./label"

interface DateTimeInputProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  allDayToggle?: boolean
  isAllDay?: boolean
  onAllDayChange?: (allDay: boolean) => void
}

export function DateTimeInput({
  value,
  onChange,
  placeholder = "Select date & time...",
  className,
  disabled = false,
  allDayToggle = false,
  isAllDay = false,
  onAllDayChange,
}: DateTimeInputProps) {
  const [open, setOpen] = React.useState(false)
  const [dateInput, setDateInput] = React.useState("")
  const [timeInput, setTimeInput] = React.useState("")

  // Update internal state when value changes
  React.useEffect(() => {
    if (value) {
      setDateInput(format(value, "yyyy-MM-dd"))
      setTimeInput(format(value, "HH:mm"))
    } else {
      setDateInput("")
      setTimeInput("")
    }
  }, [value])

  const handleDateChange = (newDate: string) => {
    setDateInput(newDate)
    updateDateTime(newDate, timeInput)
  }

  const handleTimeChange = (newTime: string) => {
    setTimeInput(newTime)
    updateDateTime(dateInput, newTime)
  }

  const updateDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr) {
      onChange?.(undefined)
      return
    }

    try {
      let dateTime: Date
      
      if (isAllDay || !timeStr) {
        // For all-day events, use the date at midnight
        dateTime = parse(`${dateStr} 00:00`, "yyyy-MM-dd HH:mm", new Date())
      } else {
        dateTime = parse(`${dateStr} ${timeStr}`, "yyyy-MM-dd HH:mm", new Date())
      }

      if (isValid(dateTime)) {
        onChange?.(dateTime)
      } else {
        onChange?.(undefined)
      }
    } catch (error) {
      console.error("Error parsing date/time:", error)
      onChange?.(undefined)
    }
  }

  const displayValue = React.useMemo(() => {
    if (!value) return placeholder

    if (isAllDay) {
      return format(value, "MMM dd, yyyy")
    } else {
      return format(value, "MMM dd, yyyy 'at' h:mm a")
    }
  }, [value, isAllDay, placeholder])

  return (
    <div className={cn("grid gap-2", className)}>
      {allDayToggle && (
        <div className="flex items-center space-x-2">
          <Switch
            id="all-day"
            checked={isAllDay}
            onCheckedChange={onAllDayChange}
            disabled={disabled}
          />
          <Label htmlFor="all-day" className="text-sm font-medium">
            All day
          </Label>
        </div>
      )}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayValue}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="start">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date" className="text-sm font-medium">Date</Label>
              <Input
                id="date"
                type="date"
                value={dateInput}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full"
              />
            </div>
            
            {!isAllDay && (
              <div className="grid gap-2">
                <Label htmlFor="time" className="text-sm font-medium flex items-center gap-2">
                  <ClockIcon className="h-3 w-3" />
                  Time
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={timeInput}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="w-full"
                />
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateInput("")
                  setTimeInput("")
                  onChange?.(undefined)
                  setOpen(false)
                }}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}