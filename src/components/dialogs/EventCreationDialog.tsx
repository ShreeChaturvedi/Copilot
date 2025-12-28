import * as React from 'react';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { addHours, format } from 'date-fns';
import { parseLocalDate } from '@/utils/date';
import { MapPin, ArrowRight, Calendar, AtSign } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/Select';

import type { CalendarEvent } from '@shared/types';
import { useCalendars } from '@/hooks/useCalendars';
import { useCreateEvent, useUpdateEvent } from '@/hooks/useEvents';
import { useUIStore } from '@/stores/uiStore';
import { ConditionalDialogHeader } from './ConditionalDialogHeader';
import type { RecurrenceEditorOptions } from '@/utils/recurrence';
import { parseRRule, generateRRule, clampRRuleUntil } from '@/utils/recurrence';
import { CustomTimeInput } from '@/components/ui/CustomTimeInput';
import { useSettingsStore, type DateDisplayMode } from '@/stores/settingsStore';
//
import RecurrenceSection from './RecurrenceSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EventCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEventData?: Partial<CalendarEvent>;
}

interface EventFormData {
  title: string;
  startDate: Date | undefined;
  endDate: Date | undefined; // New field for all-day event support
  startTime: string;
  endTime: string;
  allDay: boolean;
  description: string;
  location: string;
  calendarName: string;
  recurrence?: string;
  exceptions?: string[];
}

export function CustomDateInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const [showPicker, setShowPicker] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPicker(true);
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    // Prevent the native date picker from opening
    e.preventDefault();
    // Allow normal text selection behavior
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const syntheticEvent = {
        target: { value: formattedDate },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
    }
    setShowPicker(false);
  };

  // Use parseLocalDate to avoid UTC midnight interpretation of YYYY-MM-DD strings
  const selectedDate = value ? parseLocalDate(value) : undefined;

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
  );
}

// CustomTimeInput moved to shared UI component

function EventCreationDialogContent({
  initialEventData,
  onClose,
}: {
  initialEventData?: Partial<CalendarEvent>;
  onClose: () => void;
}) {
  const dateDisplayMode = useSettingsStore((s) => s.dateDisplayMode);
  const { data: calendars = [] } = useCalendars();
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const { peekMode, setPeekMode } = useUIStore();

  // Check if we're editing an existing event
  const isEditing = Boolean(initialEventData?.id);

  // Get default calendar for initial form data
  const defaultCalendar = useMemo(() => {
    return calendars.find((cal) => cal.isDefault) || calendars[0] || null;
  }, [calendars]);

  // Form state with enhanced multi-day support
  const [formData, setFormData] = useState<EventFormData>(() => {
    const now = new Date();
    const oneHourLater = addHours(now, 1);

    const startBase =
      (initialEventData?.occurrenceInstanceStart ?? initialEventData?.start) ||
      now;
    const endBase =
      (initialEventData?.occurrenceInstanceEnd ?? initialEventData?.end) ||
      oneHourLater;

    return {
      title: initialEventData?.title || '',
      startDate: startBase,
      endDate: startBase, // Default to same day for all-day events
      startTime: format(startBase, 'HH:mm'),
      endTime: format(endBase, 'HH:mm'),
      allDay: initialEventData?.allDay || false,
      description: initialEventData?.description || '',
      location: initialEventData?.location || '',
      calendarName:
        initialEventData?.calendarName || defaultCalendar?.name || '',
      recurrence: initialEventData?.recurrence,
      exceptions: initialEventData?.exceptions || [],
    };
  });

  const [activeTab, setActiveTab] = useState('event');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<null | {
    start: Date;
    end: Date;
    data: {
      title: string;
      allDay: boolean;
      description: string;
      location: string;
      calendarName: string;
      recurrence?: string;
      exceptions?: string[];
    };
  }>(null);

  // Ref for the title input to focus it when creating
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus the title input when creating a new event (not editing)
  useEffect(() => {
    if (!isEditing && titleInputRef.current) {
      // Small delay to ensure the dialog is fully rendered
      const timeoutId = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isEditing]);

  // Reset form when initial data changes
  React.useEffect(() => {
    const now = new Date();
    const oneHourLater = addHours(now, 1);

    const startBase =
      (initialEventData?.occurrenceInstanceStart ?? initialEventData?.start) ||
      now;
    const endBase =
      (initialEventData?.occurrenceInstanceEnd ?? initialEventData?.end) ||
      oneHourLater;

    setFormData({
      title: initialEventData?.title || '',
      startDate: startBase,
      endDate: startBase, // Default to same day for all-day events
      startTime: format(startBase, 'HH:mm'),
      endTime: format(endBase, 'HH:mm'),
      allDay: initialEventData?.allDay || false,
      description: initialEventData?.description || '',
      location: initialEventData?.location || '',
      calendarName:
        initialEventData?.calendarName || defaultCalendar?.name || '',
      recurrence: initialEventData?.recurrence,
      exceptions: initialEventData?.exceptions || [],
    });
    setActiveTab('event');
  }, [initialEventData, defaultCalendar]);

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
    }));
  }, [calendars]);

  // Calculate width based on longest calendar name
  const calendarSelectWidth = useMemo(() => {
    if (calendars.length === 0) return 'w-48'; // Default fallback

    const longestName = calendars.reduce(
      (longest, calendar) =>
        calendar.name.length > longest.length ? calendar.name : longest,
      ''
    );

    // Estimate width: ~0.6rem per character + padding + icon space
    const estimatedChars = longestName.length + 8; // Extra for padding and icon

    if (estimatedChars <= 16) return 'w-32';
    if (estimatedChars <= 20) return 'w-40';
    if (estimatedChars <= 24) return 'w-48';
    if (estimatedChars <= 28) return 'w-56';
    if (estimatedChars <= 32) return 'w-64';
    return 'w-72'; // Max reasonable width
  }, [calendars]);

  const updateFormData = useCallback(
    <K extends keyof EventFormData>(field: K, value: EventFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateValue = e.target.value;
      if (dateValue) {
        // Use parseLocalDate to parse as local midnight, not UTC midnight
        const newStartDate = parseLocalDate(dateValue);
        updateFormData('startDate', newStartDate);

        // If start date is after end date, adjust end date
        if (formData.endDate && newStartDate > formData.endDate) {
          updateFormData('endDate', newStartDate);
        }
      }
    },
    [updateFormData, formData.endDate]
  );

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateValue = e.target.value;
      if (dateValue) {
        // Use parseLocalDate to parse as local midnight, not UTC midnight
        const newEndDate = parseLocalDate(dateValue);
        // Prevent end date from being before start date
        if (formData.startDate && newEndDate < formData.startDate) {
          return;
        }
        updateFormData('endDate', newEndDate);
      }
    },
    [updateFormData, formData.startDate]
  );

  const handleStartTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const timeValue = e.target.value;
      updateFormData('startTime', timeValue);

      // Auto-adjust end time if start time is after end time
      if (timeValue && formData.endTime && timeValue >= formData.endTime) {
        const startTime = new Date(`1970-01-01T${timeValue}:00`);
        const endTime = addHours(startTime, 1);
        updateFormData('endTime', format(endTime, 'HH:mm'));
      }
    },
    [formData.endTime, updateFormData]
  );

  const handleEndTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const timeValue = e.target.value;
      // Ensure end time is not before start time
      if (timeValue && formData.startTime && timeValue <= formData.startTime) {
        return;
      }
      updateFormData('endTime', timeValue);
    },
    [formData.startTime, updateFormData]
  );

  const handleAllDayChange = useCallback((allDay: boolean) => {
    setFormData((prev) => {
      if (allDay) {
        // When switching to all-day, ensure end date is set
        return {
          ...prev,
          allDay,
          endDate: prev.endDate || prev.startDate,
        };
      } else {
        // When switching to timed, keep the dates but focus on times
        return {
          ...prev,
          allDay,
        };
      }
    });
  }, []);

  // Create start and end Date objects for submission with multi-day support
  const getStartDateTime = useCallback(() => {
    if (!formData.startDate) return undefined;

    if (formData.allDay) {
      const startOfDay = new Date(formData.startDate);
      startOfDay.setHours(0, 0, 0, 0);
      return startOfDay;
    } else {
      const [hours, minutes] = formData.startTime.split(':').map(Number);
      const dateTime = new Date(formData.startDate);
      dateTime.setHours(hours, minutes, 0, 0);
      return dateTime;
    }
  }, [formData.startDate, formData.startTime, formData.allDay]);

  const getEndDateTime = useCallback(() => {
    if (formData.allDay) {
      if (!formData.endDate) return undefined;
      const endOfDay = new Date(formData.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      return endOfDay;
    } else {
      if (!formData.startDate) return undefined;
      const [hours, minutes] = formData.endTime.split(':').map(Number);
      const dateTime = new Date(formData.startDate);
      dateTime.setHours(hours, minutes, 0, 0);
      return dateTime;
    }
  }, [formData.startDate, formData.endDate, formData.endTime, formData.allDay]);

  // Get current frequency from recurrence string
  const currentFrequency = useMemo(():
    | 'none'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly' => {
    if (!formData.recurrence) return 'none';
    const parsed = parseRRule(formData.recurrence);
    return parsed ? parsed.frequency : 'none';
  }, [formData.recurrence]);

  // End condition derived from recurrence (controlled in the parent row)
  const currentEnds = useMemo((): 'never' | 'on' | 'after' => {
    const parsed = formData.recurrence ? parseRRule(formData.recurrence) : null;
    return parsed?.ends || 'never';
  }, [formData.recurrence]);

  const handleEndsChangeTopRow = useCallback(
    (ends: 'never' | 'on' | 'after') => {
      if (!formData.recurrence) return;
      const parsed = parseRRule(formData.recurrence);
      if (!parsed) return;
      const startDateTime = getStartDateTime() || new Date();
      const next: RecurrenceEditorOptions = {
        ...parsed,
        ends,
        until: ends === 'on' ? parsed.until || new Date(startDateTime) : null,
        count: ends === 'after' ? parsed.count || 10 : null,
      };
      updateFormData('recurrence', generateRRule(next, startDateTime));
    },
    [formData.recurrence, getStartDateTime, updateFormData]
  );

  // Simple repeat frequency handler
  const handleFrequencyChange = useCallback(
    (freq: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly') => {
      if (freq === 'none') {
        updateFormData('recurrence', undefined);
        return;
      }

      // Create a basic recurrence rule with sensible defaults
      const startDateTime = getStartDateTime() || new Date();
      const opts: RecurrenceEditorOptions = {
        frequency: freq,
        interval: 1,
        daysOfWeek: freq === 'weekly' ? [startDateTime.getDay()] : undefined,
        dayOfMonth: freq === 'monthly' ? startDateTime.getDate() : undefined,
        month: freq === 'yearly' ? startDateTime.getMonth() + 1 : undefined,
        yearDayOfMonth: freq === 'yearly' ? startDateTime.getDate() : undefined,
        ends: 'never',
        until: null,
        count: null,
      };

      const rrule = generateRRule(opts, startDateTime);
      updateFormData('recurrence', rrule);
    },
    [updateFormData, getStartDateTime]
  );

  // Enhanced form validation with multi-day event support
  const isFormValid = useMemo(() => {
    const hasTitle = formData.title.trim().length > 0;
    const hasCalendar = Boolean(formData.calendarName);
    const hasStartDate = Boolean(formData.startDate);

    if (formData.allDay) {
      const hasEndDate = Boolean(formData.endDate);
      const validDateRange =
        formData.startDate &&
        formData.endDate &&
        formData.endDate >= formData.startDate;
      return (
        hasTitle && hasCalendar && hasStartDate && hasEndDate && validDateRange
      );
    } else {
      const hasValidTimes = Boolean(formData.startTime && formData.endTime);
      const validTimeRange = formData.startTime < formData.endTime;
      return (
        hasTitle &&
        hasCalendar &&
        hasStartDate &&
        hasValidTimes &&
        validTimeRange
      );
    }
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    const startDateTime = getStartDateTime();
    const endDateTime = getEndDateTime();

    if (!startDateTime || !endDateTime) return;

    setIsSubmitting(true);

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
            },
          });
          setScopeDialogOpen(true);
          setIsSubmitting(false);
          return;
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
          },
        });
      } else {
        // Create new event
        // Optimistic create is handled in the hook; we can close immediately upon triggering
        createEventMutation.mutate({
          title: formData.title.trim(),
          start: startDateTime,
          end: endDateTime,
          allDay: formData.allDay,
          description: formData.description.trim(),
          location: formData.location.trim(),
          calendarName: formData.calendarName,
          recurrence: formData.recurrence,
          exceptions: formData.exceptions,
        });
      }

      onClose();
    } catch (error) {
      console.error(
        `Failed to ${isEditing ? 'update' : 'create'} event:`,
        error
      );
      // Error handling could be improved with toast notifications
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isFormValid,
    formData,
    createEventMutation,
    updateEventMutation,
    isEditing,
    initialEventData?.id,
    initialEventData?.recurrence,
    onClose,
    getStartDateTime,
    getEndDateTime,
  ]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const togglePeekMode = useCallback(() => {
    setPeekMode(peekMode === 'center' ? 'right' : 'center');
  }, [peekMode, setPeekMode]);

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
        <TabsContent
          value="event"
          className={`space-y-6 ${isEditing ? 'mt-0' : 'mt-6'}`}
        >
          {/* Event Name and Calendar Selection */}
          <div className="flex items-end gap-3 min-w-0">
            <div className="flex-1">
              <Input
                ref={titleInputRef}
                id="event-title"
                placeholder="Event name"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
                className="w-full"
              />
            </div>
            <div className={`${calendarSelectWidth} max-w-[50%]`}>
              <Combobox
                options={calendarOptions}
                value={formData.calendarName}
                onValueChange={(value) => updateFormData('calendarName', value)}
                placeholder="Select calendar..."
                searchPlaceholder="Search calendars..."
                emptyText="No calendars found."
                className="w-full"
              />
            </div>
          </div>

          {/* Date and Time Selection */}
          <div className="flex items-center gap-3 min-w-0">
            <CustomDateInput
              value={
                formData.startDate
                  ? format(formData.startDate, 'yyyy-MM-dd')
                  : ''
              }
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
                  value={
                    formData.endDate
                      ? format(formData.endDate, 'yyyy-MM-dd')
                      : ''
                  }
                  onChange={handleEndDateChange}
                  className="w-auto"
                />
              </>
            )}
          </div>

          {/* Date Display Mode (affects tag text only across app) */}
          <div className="flex items-center gap-2">
            <Label className="text-sm">Display</Label>
            <Select
              value={dateDisplayMode}
              onValueChange={(v) =>
                useSettingsStore
                  .getState()
                  .setDateDisplayMode(v as DateDisplayMode)
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Relative" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relative">Relative</SelectItem>
                <SelectItem value="absolute">Absolute</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* All Day + Repeat + Ends row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="all-day"
                checked={formData.allDay}
                onCheckedChange={handleAllDayChange}
              />
              <Label htmlFor="all-day" className="text-sm font-medium">
                All Day
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={currentFrequency}
                onValueChange={(val) =>
                  handleFrequencyChange(
                    val as 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
                  )
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Never Repeats" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Never Repeats</SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Frequency</SelectLabel>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {currentFrequency !== 'none' && (
              <div className="flex items-center gap-2">
                <Select
                  value={currentEnds}
                  onValueChange={(val) =>
                    handleEndsChangeTopRow(val as 'never' | 'on' | 'after')
                  }
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Never ends" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never ends</SelectItem>
                    <SelectItem value="on">On date…</SelectItem>
                    <SelectItem value="after">After N occurrences…</SelectItem>
                  </SelectContent>
                </Select>
                {currentEnds === 'on' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <Calendar className="h-4 w-4" />
                        {(() => {
                          const parsed = formData.recurrence
                            ? parseRRule(formData.recurrence)
                            : null;
                          return parsed?.until
                            ? format(parsed.until, 'yyyy-MM-dd')
                            : 'Pick date';
                        })()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={
                          (formData.recurrence &&
                            parseRRule(formData.recurrence)?.until) ||
                          undefined
                        }
                        onSelect={(d) => {
                          if (!formData.recurrence || !d) return;
                          const parsed = parseRRule(formData.recurrence);
                          if (!parsed) return;
                          const startDateTime =
                            getStartDateTime() || new Date();
                          const next: RecurrenceEditorOptions = {
                            ...parsed,
                            until: d,
                          };
                          updateFormData(
                            'recurrence',
                            generateRRule(next, startDateTime)
                          );
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Advanced Recurrence Options - should appear directly under repeat row */}
          {currentFrequency !== 'none' && (
            <RecurrenceSection
              startDateTime={getStartDateTime()}
              value={formData.recurrence}
              onChange={(rrule) =>
                updateFormData('recurrence', rrule || undefined)
              }
              onClearExceptions={() => updateFormData('exceptions', [])}
              exceptions={formData.exceptions || []}
              showSummary={false}
              endsControlled={true}
            />
          )}

          {/* Location */}
          <div className="relative min-w-0">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={formData.location}
              onChange={(e) => updateFormData('location', e.target.value)}
              placeholder="Add location"
              className="pl-10"
            />
          </div>

          {/* Description (WYSIWYG) - full width, no leading icon */}
          <div className="min-w-0">
            <RichTextEditor
              ariaLabel="Event description"
              value={formData.description}
              onChange={(html) => updateFormData('description', html)}
              placeholder="Add description"
              minHeight={96}
              className="text-base md:text-sm"
            />
          </div>
        </TabsContent>

        <TabsContent
          value="task"
          className={`space-y-4 ${isEditing ? 'mt-0' : 'mt-6'}`}
        >
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
        <Button onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
          {isSubmitting
            ? isEditing
              ? 'Saving...'
              : 'Creating...'
            : isEditing
              ? 'Save'
              : 'Create Event'}
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
                const iso = new Date(
                  initialEventData.occurrenceInstanceStart ||
                    initialEventData.start!
                ).toISOString();
                const exceptions = Array.from(
                  new Set([...(initialEventData.exceptions || []), iso])
                );
                await updateEventMutation.mutateAsync({
                  id: initialEventData.id as string,
                  data: { exceptions },
                });
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
                const occStart = new Date(
                  initialEventData.occurrenceInstanceStart ||
                    initialEventData.start!
                );
                const clamped = clampRRuleUntil(
                  initialEventData.recurrence!,
                  occStart
                );
                await updateEventMutation.mutateAsync({
                  id: initialEventData.id as string,
                  data: { recurrence: clamped },
                });
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
                  },
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
  );
}

export function EventCreationDialog({
  open,
  onOpenChange,
  initialEventData,
}: EventCreationDialogProps) {
  const { peekMode } = useUIStore();

  const handleClose = () => {
    onOpenChange(false);
  };

  // Render both Sheet and Dialog, but only one is open at a time
  // This prevents the flicker caused by unmounting one before mounting the other
  const isSheetMode = peekMode === 'right';

  return (
    <>
      {/* Sheet (right panel) - only open when open=true AND peekMode='right' */}
      <Sheet open={open && isSheetMode} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg md:max-w-xl p-6 overflow-y-auto [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              {initialEventData?.id ? 'Edit Event' : 'Create Event'}
            </SheetTitle>
            <SheetDescription>
              {initialEventData?.id
                ? 'Edit the selected event details'
                : 'Create a new event with title, date, time, location, and description'}
            </SheetDescription>
          </SheetHeader>
          <EventCreationDialogContent
            initialEventData={initialEventData}
            onClose={handleClose}
          />
        </SheetContent>
      </Sheet>

      {/* Dialog (center modal) - only open when open=true AND peekMode='center' */}
      <Dialog open={open && !isSheetMode} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          showCloseButton={false}
        >
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
    </>
  );
}
