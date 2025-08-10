/**
 * Form validation utility functions for data integrity
 */

import type { ValidationError } from '@shared/types';
import { isValid, parseISO } from 'date-fns';

/**
 * Validation result type
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Create a validation error
 */
const createError = (field: string, message: string): ValidationError => ({
  field,
  message,
});

/**
 * Validate required string fields
 */
export const validateRequired = (value: string | undefined | null, fieldName: string): ValidationError | null => {
  if (!value || value.trim().length === 0) {
    return createError(fieldName, `${fieldName} is required`);
  }
  return null;
};

/**
 * Validate string length constraints
 */
export const validateLength = (
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): ValidationError | null => {
  if (min !== undefined && value.length < min) {
    return createError(fieldName, `${fieldName} must be at least ${min} characters long`);
  }
  
  if (max !== undefined && value.length > max) {
    return createError(fieldName, `${fieldName} must be no more than ${max} characters long`);
  }
  
  return null;
};

/**
 * Validate email format
 */
export const validateEmail = (email: string, fieldName: string = 'Email'): ValidationError | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return createError(fieldName, 'Please enter a valid email address');
  }
  
  return null;
};

/**
 * Validate URL format
 */
export const validateUrl = (url: string, fieldName: string = 'URL'): ValidationError | null => {
  try {
    new URL(url);
    return null;
  } catch {
    return createError(fieldName, 'Please enter a valid URL');
  }
};

/**
 * Validate date format and validity
 */
export const validateDate = (dateValue: string | Date, fieldName: string = 'Date'): ValidationError | null => {
  let date: Date;
  
  if (typeof dateValue === 'string') {
    if (!dateValue.trim()) {
      return createError(fieldName, `${fieldName} is required`);
    }
    
    date = parseISO(dateValue);
  } else {
    date = dateValue;
  }
  
  if (!isValid(date)) {
    return createError(fieldName, 'Please enter a valid date');
  }
  
  return null;
};

/**
 * Validate that end date is after start date
 */
export const validateDateRange = (
  startDate: Date,
  endDate: Date,
  startFieldName: string = 'Start date',
  endFieldName: string = 'End date'
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  const startError = validateDate(startDate, startFieldName);
  const endError = validateDate(endDate, endFieldName);
  
  if (startError) errors.push(startError);
  if (endError) errors.push(endError);
  
  // Only check range if both dates are valid
  if (!startError && !endError && endDate <= startDate) {
    errors.push(createError(endFieldName, 'End date must be after start date'));
  }
  
  return errors;
};

/**
 * Validate time format (HH:mm)
 */
export const validateTime = (time: string, fieldName: string = 'Time'): ValidationError | null => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  
  if (!timeRegex.test(time)) {
    return createError(fieldName, 'Please enter a valid time (HH:mm format)');
  }
  
  return null;
};

/**
 * Validate hex color format
 */
export const validateColor = (color: string, fieldName: string = 'Color'): ValidationError | null => {
  const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  
  if (!colorRegex.test(color)) {
    return createError(fieldName, 'Please enter a valid hex color (e.g., #FF0000)');
  }
  
  return null;
};

/**
 * Validate task title
 */
export const validateTaskTitle = (title: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  const requiredError = validateRequired(title, 'Task title');
  if (requiredError) {
    errors.push(requiredError);
    return errors; // Don't check length if empty
  }
  
  const lengthError = validateLength(title.trim(), 'Task title', 1, 200);
  if (lengthError) {
    errors.push(lengthError);
  }
  
  return errors;
};

/**
 * Validate event data
 */
export const validateEvent = (event: {
  title: string;
  start: Date;
  end: Date;
  calendarName: string;
  location?: string;
  description?: string;
}): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Validate title
  const titleErrors = validateTaskTitle(event.title);
  errors.push(...titleErrors);
  
  // Validate calendar name
  const calendarError = validateRequired(event.calendarName, 'Calendar');
  if (calendarError) {
    errors.push(calendarError);
  }
  
  // Validate date range
  const dateErrors = validateDateRange(event.start, event.end);
  errors.push(...dateErrors);
  
  // Validate optional fields
  if (event.location) {
    const locationError = validateLength(event.location, 'Location', undefined, 500);
    if (locationError) {
      errors.push(locationError);
    }
  }
  
  if (event.description) {
    const descriptionError = validateLength(event.description, 'Description', undefined, 2000);
    if (descriptionError) {
      errors.push(descriptionError);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate calendar data
 */
export const validateCalendar = (calendar: {
  name: string;
  color: string;
  description?: string;
}): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Validate name
  const nameError = validateRequired(calendar.name, 'Calendar name');
  if (nameError) {
    errors.push(nameError);
  } else {
    const nameLengthError = validateLength(calendar.name, 'Calendar name', 1, 50);
    if (nameLengthError) {
      errors.push(nameLengthError);
    }
  }
  
  // Validate color
  const colorError = validateColor(calendar.color);
  if (colorError) {
    errors.push(colorError);
  }
  
  // Validate optional description
  if (calendar.description) {
    const descriptionError = validateLength(calendar.description, 'Description', undefined, 200);
    if (descriptionError) {
      errors.push(descriptionError);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitize HTML content to prevent XSS
 */
export const sanitizeHtml = (html: string): string => {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

/**
 * Validate and sanitize rich text content
 */
export const validateRichText = (content: string, fieldName: string = 'Content'): ValidationResult => {
  const errors: ValidationError[] = [];
  
  // Check length (HTML content can be longer)
  if (content.length > 10000) {
    errors.push(createError(fieldName, 'Content is too long (maximum 10,000 characters)'));
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Combine multiple validation results
 */
export const combineValidationResults = (...results: ValidationResult[]): ValidationResult => {
  const allErrors = results.flatMap(result => result.errors);
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
};

/**
 * Get first error message for a specific field
 */
export const getFieldError = (errors: ValidationError[], fieldName: string): string | null => {
  const fieldError = errors.find(error => error.field === fieldName);
  return fieldError ? fieldError.message : null;
};

/**
 * Check if a field has any errors
 */
export const hasFieldError = (errors: ValidationError[], fieldName: string): boolean => {
  return errors.some(error => error.field === fieldName);
};