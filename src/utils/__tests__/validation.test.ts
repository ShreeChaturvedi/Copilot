/**
 * Unit tests for validation utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  validateLength,
  validateEmail,
  validateUrl,
  validateDate,
  validateDateRange,
  validateTime,
  validateColor,
  validateTaskTitle,
  validateEvent,
  validateCalendar,
  sanitizeHtml,
  validateRichText,
  combineValidationResults,
  getFieldError,
  hasFieldError,
} from '../validation';

describe('Validation Utilities', () => {
  describe('validateRequired', () => {
    it('should return null for valid non-empty string', () => {
      expect(validateRequired('valid text', 'field')).toBeNull();
    });

    it('should return error for empty string', () => {
      const error = validateRequired('', 'field');
      expect(error).toEqual({
        field: 'field',
        message: 'field is required',
      });
    });

    it('should return error for whitespace-only string', () => {
      const error = validateRequired('   ', 'field');
      expect(error).toEqual({
        field: 'field',
        message: 'field is required',
      });
    });

    it('should return error for null/undefined', () => {
      expect(validateRequired(null, 'field')).toEqual({
        field: 'field',
        message: 'field is required',
      });
      
      expect(validateRequired(undefined, 'field')).toEqual({
        field: 'field',
        message: 'field is required',
      });
    });
  });

  describe('validateLength', () => {
    it('should return null for valid length', () => {
      expect(validateLength('hello', 'field', 3, 10)).toBeNull();
    });

    it('should return error for too short string', () => {
      const error = validateLength('hi', 'field', 3, 10);
      expect(error).toEqual({
        field: 'field',
        message: 'field must be at least 3 characters long',
      });
    });

    it('should return error for too long string', () => {
      const error = validateLength('this is too long', 'field', 3, 10);
      expect(error).toEqual({
        field: 'field',
        message: 'field must be no more than 10 characters long',
      });
    });

    it('should work with only min constraint', () => {
      expect(validateLength('hello', 'field', 3)).toBeNull();
      expect(validateLength('hi', 'field', 3)).not.toBeNull();
    });

    it('should work with only max constraint', () => {
      expect(validateLength('hello', 'field', undefined, 10)).toBeNull();
      expect(validateLength('this is too long', 'field', undefined, 10)).not.toBeNull();
    });
  });

  describe('validateEmail', () => {
    it('should return null for valid email', () => {
      expect(validateEmail('test@example.com')).toBeNull();
      expect(validateEmail('user.name+tag@domain.co.uk')).toBeNull();
    });

    it('should return error for invalid email', () => {
      const error = validateEmail('invalid-email');
      expect(error).toEqual({
        field: 'Email',
        message: 'Please enter a valid email address',
      });
    });

    it('should use custom field name', () => {
      const error = validateEmail('invalid', 'User Email');
      expect(error?.field).toBe('User Email');
    });
  });

  describe('validateUrl', () => {
    it('should return null for valid URL', () => {
      expect(validateUrl('https://example.com')).toBeNull();
      expect(validateUrl('http://localhost:3000')).toBeNull();
      expect(validateUrl('ftp://files.example.com')).toBeNull();
    });

    it('should return error for invalid URL', () => {
      const error = validateUrl('not-a-url');
      expect(error).toEqual({
        field: 'URL',
        message: 'Please enter a valid URL',
      });
    });
  });

  describe('validateDate', () => {
    it('should return null for valid Date object', () => {
      expect(validateDate(new Date('2024-01-15'))).toBeNull();
    });

    it('should return null for valid date string', () => {
      expect(validateDate('2024-01-15T10:30:00Z')).toBeNull();
    });

    it('should return error for invalid Date object', () => {
      const error = validateDate(new Date('invalid'));
      expect(error).toEqual({
        field: 'Date',
        message: 'Please enter a valid date',
      });
    });

    it('should return error for empty string', () => {
      const error = validateDate('');
      expect(error).toEqual({
        field: 'Date',
        message: 'Date is required',
      });
    });

    it('should return error for invalid date string', () => {
      const error = validateDate('invalid-date');
      expect(error).toEqual({
        field: 'Date',
        message: 'Please enter a valid date',
      });
    });
  });

  describe('validateDateRange', () => {
    it('should return empty array for valid date range', () => {
      const start = new Date('2024-01-15T10:00:00Z');
      const end = new Date('2024-01-15T12:00:00Z');
      
      expect(validateDateRange(start, end)).toEqual([]);
    });

    it('should return error when end is before start', () => {
      const start = new Date('2024-01-15T12:00:00Z');
      const end = new Date('2024-01-15T10:00:00Z');
      
      const errors = validateDateRange(start, end);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('End date must be after start date');
    });

    it('should return error when end equals start', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      
      const errors = validateDateRange(date, date);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('End date must be after start date');
    });

    it('should return errors for invalid dates', () => {
      const validDate = new Date('2024-01-15T10:00:00Z');
      const invalidDate = new Date('invalid');
      
      const errors = validateDateRange(invalidDate, validDate);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('Start date');
    });
  });

  describe('validateTime', () => {
    it('should return null for valid time formats', () => {
      expect(validateTime('10:30')).toBeNull();
      expect(validateTime('00:00')).toBeNull();
      expect(validateTime('23:59')).toBeNull();
    });

    it('should return error for invalid time format', () => {
      const error = validateTime('25:00');
      expect(error).toEqual({
        field: 'Time',
        message: 'Please enter a valid time (HH:mm format)',
      });
    });

    it('should return error for invalid format', () => {
      expect(validateTime('10:30:00')).not.toBeNull();
      expect(validateTime('10')).not.toBeNull();
      expect(validateTime('invalid')).not.toBeNull();
    });
  });

  describe('validateColor', () => {
    it('should return null for valid hex colors', () => {
      expect(validateColor('#FF0000')).toBeNull();
      expect(validateColor('#fff')).toBeNull();
      expect(validateColor('#123ABC')).toBeNull();
    });

    it('should return error for invalid hex color', () => {
      const error = validateColor('red');
      expect(error).toEqual({
        field: 'Color',
        message: 'Please enter a valid hex color (e.g., #FF0000)',
      });
    });

    it('should return error for invalid format', () => {
      expect(validateColor('#GG0000')).not.toBeNull();
      expect(validateColor('FF0000')).not.toBeNull();
      expect(validateColor('#FF00')).not.toBeNull();
    });
  });

  describe('validateTaskTitle', () => {
    it('should return empty array for valid title', () => {
      expect(validateTaskTitle('Valid task title')).toEqual([]);
    });

    it('should return error for empty title', () => {
      const errors = validateTaskTitle('');
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('Task title');
    });

    it('should return error for too long title', () => {
      const longTitle = 'a'.repeat(201);
      const errors = validateTaskTitle(longTitle);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('no more than 200 characters');
    });
  });

  describe('validateEvent', () => {
    const validEvent = {
      title: 'Test Event',
      start: new Date('2024-01-15T10:00:00Z'),
      end: new Date('2024-01-15T12:00:00Z'),
      calendarName: 'Personal',
      location: 'Test Location',
      description: 'Test Description',
    };

    it('should return valid result for valid event', () => {
      const result = validateEvent(validEvent);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid event', () => {
      const invalidEvent = {
        title: '',
        start: new Date('2024-01-15T12:00:00Z'),
        end: new Date('2024-01-15T10:00:00Z'), // End before start
        calendarName: '',
      };

      const result = validateEvent(invalidEvent);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate optional fields', () => {
      const eventWithLongLocation = {
        ...validEvent,
        location: 'a'.repeat(501),
      };

      const result = validateEvent(eventWithLongLocation);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'Location')).toBe(true);
    });
  });

  describe('validateCalendar', () => {
    const validCalendar = {
      name: 'Test Calendar',
      color: '#FF0000',
      description: 'Test Description',
    };

    it('should return valid result for valid calendar', () => {
      const result = validateCalendar(validCalendar);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid calendar', () => {
      const invalidCalendar = {
        name: '',
        color: 'invalid-color',
      };

      const result = validateCalendar(invalidCalendar);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const html = '<p>Safe content</p><script>alert("xss")</script>';
      const sanitized = sanitizeHtml(html);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should remove iframe tags', () => {
      const html = '<p>Safe content</p><iframe src="evil.com"></iframe>';
      const sanitized = sanitizeHtml(html);
      expect(sanitized).not.toContain('<iframe>');
      expect(sanitized).toContain('<p>Safe content</p>');
    });

    it('should remove javascript: URLs', () => {
      const html = '<a href="javascript:alert(1)">Link</a>';
      const sanitized = sanitizeHtml(html);
      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const html = '<button onclick="alert(1)">Click</button>';
      const sanitized = sanitizeHtml(html);
      expect(sanitized).not.toContain('onclick');
    });
  });

  describe('validateRichText', () => {
    it('should return valid result for normal content', () => {
      const result = validateRichText('<p>Normal content</p>');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return error for too long content', () => {
      const longContent = 'a'.repeat(10001);
      const result = validateRichText(longContent);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('too long');
    });
  });

  describe('combineValidationResults', () => {
    it('should combine multiple validation results', () => {
      const result1 = { isValid: true, errors: [] };
      const result2 = { isValid: false, errors: [{ field: 'test', message: 'error' }] };
      
      const combined = combineValidationResults(result1, result2);
      expect(combined.isValid).toBe(false);
      expect(combined.errors).toHaveLength(1);
    });

    it('should return valid when all results are valid', () => {
      const result1 = { isValid: true, errors: [] };
      const result2 = { isValid: true, errors: [] };
      
      const combined = combineValidationResults(result1, result2);
      expect(combined.isValid).toBe(true);
      expect(combined.errors).toEqual([]);
    });
  });

  describe('getFieldError', () => {
    const errors = [
      { field: 'name', message: 'Name is required' },
      { field: 'email', message: 'Invalid email' },
    ];

    it('should return error message for existing field', () => {
      expect(getFieldError(errors, 'name')).toBe('Name is required');
    });

    it('should return null for non-existing field', () => {
      expect(getFieldError(errors, 'phone')).toBeNull();
    });
  });

  describe('hasFieldError', () => {
    const errors = [
      { field: 'name', message: 'Name is required' },
      { field: 'email', message: 'Invalid email' },
    ];

    it('should return true for field with error', () => {
      expect(hasFieldError(errors, 'name')).toBe(true);
    });

    it('should return false for field without error', () => {
      expect(hasFieldError(errors, 'phone')).toBe(false);
    });
  });
});