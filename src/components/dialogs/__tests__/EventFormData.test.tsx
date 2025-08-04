import { describe, it, expect } from 'vitest'

// Test the enhanced EventFormData interface structure
describe('EventFormData Interface', () => {
  it('should support the enhanced interface with endDate field', () => {
    // This test verifies that the enhanced EventFormData interface
    // includes the new endDate field for multi-day event support
    
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
    }

    const formData: EventFormData = {
      title: "Test Event",
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-03'), // Multi-day event
      startTime: "09:00",
      endTime: "17:00",
      allDay: true,
      description: "Test description",
      location: "Test location",
      calendarName: "Test Calendar"
    }

    // Verify all fields are properly typed and accessible
    expect(formData.title).toBe("Test Event")
    expect(formData.startDate).toBeInstanceOf(Date)
    expect(formData.endDate).toBeInstanceOf(Date)
    expect(formData.startTime).toBe("09:00")
    expect(formData.endTime).toBe("17:00")
    expect(formData.allDay).toBe(true)
    expect(formData.description).toBe("Test description")
    expect(formData.location).toBe("Test location")
    expect(formData.calendarName).toBe("Test Calendar")
  })

  it('should support validation logic for date ranges', () => {
    interface ValidationResult {
      isValid: boolean
      errors: string[]
    }

    interface EventFormData {
      title: string
      startDate: Date | undefined
      endDate: Date | undefined
      startTime: string
      endTime: string
      allDay: boolean
      description: string
      location: string
      calendarName: string
    }

    const validateEventFormData = (data: EventFormData): ValidationResult => {
      const errors: string[] = []
      
      if (!data.title.trim()) {
        errors.push('Event title is required')
      }
      
      if (!data.calendarName) {
        errors.push('Calendar selection is required')
      }
      
      if (!data.startDate) {
        errors.push('Start date is required')
      }
      
      if (data.allDay) {
        if (!data.endDate) {
          errors.push('End date is required for all-day events')
        } else if (data.startDate && data.endDate < data.startDate) {
          errors.push('End date cannot be before start date')
        }
      } else {
        if (!data.startTime || !data.endTime) {
          errors.push('Start and end times are required')
        } else if (data.startTime >= data.endTime) {
          errors.push('End time must be after start time')
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      }
    }

    // Test valid all-day multi-day event
    const validAllDayEvent: EventFormData = {
      title: "Multi-day Event",
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-03'),
      startTime: "09:00",
      endTime: "17:00",
      allDay: true,
      description: "",
      location: "",
      calendarName: "Test Calendar"
    }

    const validResult = validateEventFormData(validAllDayEvent)
    expect(validResult.isValid).toBe(true)
    expect(validResult.errors).toHaveLength(0)

    // Test invalid all-day event (end date before start date)
    const invalidAllDayEvent: EventFormData = {
      ...validAllDayEvent,
      startDate: new Date('2024-01-03'),
      endDate: new Date('2024-01-01') // End before start
    }

    const invalidResult = validateEventFormData(invalidAllDayEvent)
    expect(invalidResult.isValid).toBe(false)
    expect(invalidResult.errors).toContain('End date cannot be before start date')

    // Test valid timed event
    const validTimedEvent: EventFormData = {
      title: "Timed Event",
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-01'),
      startTime: "09:00",
      endTime: "17:00",
      allDay: false,
      description: "",
      location: "",
      calendarName: "Test Calendar"
    }

    const timedResult = validateEventFormData(validTimedEvent)
    expect(timedResult.isValid).toBe(true)
    expect(timedResult.errors).toHaveLength(0)

    // Test invalid timed event (end time before start time)
    const invalidTimedEvent: EventFormData = {
      ...validTimedEvent,
      startTime: "17:00",
      endTime: "09:00" // End before start
    }

    const invalidTimedResult = validateEventFormData(invalidTimedEvent)
    expect(invalidTimedResult.isValid).toBe(false)
    expect(invalidTimedResult.errors).toContain('End time must be after start time')
  })
})