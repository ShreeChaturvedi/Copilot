import { format, isToday, isTomorrow, isThisWeek, isAfter, isBefore, startOfDay } from 'date-fns';

/**
 * Date grouping utilities for tasks and events
 * Extracted from EventOverview to provide consistent date grouping across components
 */

export interface GroupedItems<T> {
  [key: string]: T[];
}

/**
 * Determine the appropriate day key for an item based on its date
 */
export const getDayKey = (date: Date | null): string => {
  if (!date) {
    return 'No Due Date';
  }

  const itemDate = new Date(date);
  const now = new Date();

  if (isBefore(itemDate, startOfDay(now))) {
    return 'Overdue';
  } else if (isToday(itemDate)) {
    return 'Today';
  } else if (isTomorrow(itemDate)) {
    return 'Tomorrow';
  } else if (isThisWeek(itemDate, { weekStartsOn: 1 })) {
    return format(itemDate, 'EEEE'); // Wednesday, Thursday, etc.
  } else {
    return format(itemDate, 'MMM d'); // Jan 15, etc.
  }
};

/**
 * Group items by date using a date extraction function
 */
export const groupItemsByDate = <T>(
  items: T[],
  getDateFn: (item: T) => Date | null
): GroupedItems<T> => {
  const groups: GroupedItems<T> = {};

  items.forEach((item) => {
    const itemDate = getDateFn(item);
    const dayKey = getDayKey(itemDate);

    if (!groups[dayKey]) {
      groups[dayKey] = [];
    }
    groups[dayKey].push(item);
  });

  return groups;
};

/**
 * Define the order of day keys for consistent display
 * Earlier items should appear first
 */
export const getDayKeyOrder = (dayKeys: string[]): string[] => {
  const orderMap: Record<string, number> = {
    'Overdue': 0,
    'Today': 1,
    'Tomorrow': 2,
    'Monday': 3,
    'Tuesday': 4,
    'Wednesday': 5,
    'Thursday': 6,
    'Friday': 7,
    'Saturday': 8,
    'Sunday': 9,
    'No Due Date': 100, // Should appear last
  };

  return dayKeys.sort((a, b) => {
    const orderA = orderMap[a] ?? 50; // Default order for date strings (e.g., "Jan 15")
    const orderB = orderMap[b] ?? 50;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // For date strings with same default order, sort alphabetically
    return a.localeCompare(b);
  });
};

/**
 * Get formatted time string for display
 */
export const getTimeString = (date: Date | null, allDay = false): string => {
  if (!date) return '';
  if (allDay) return 'All day';
  return format(new Date(date), 'h:mm a');
};

/**
 * Check if an item is overdue based on its date
 */
export const isItemOverdue = (date: Date | null): boolean => {
  if (!date) return false;
  return isBefore(new Date(date), startOfDay(new Date()));
};

/**
 * Filter items to show only upcoming ones (today forward)
 */
export const filterUpcomingItems = <T>(
  items: T[],
  getDateFn: (item: T) => Date | null,
  maxItems?: number
): T[] => {
  const now = new Date();

  const filtered = items
    .filter((item) => {
      const itemDate = getDateFn(item);
      if (!itemDate) return true; // Include items without dates
      
      const itemStart = new Date(itemDate);
      // Show items from today forward
      return isAfter(itemStart, now) || isToday(itemStart);
    })
    .sort((a, b) => {
      const dateA = getDateFn(a);
      const dateB = getDateFn(b);
      
      // Sort by date, items with dates come first
      if (dateA && dateB) {
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      } else if (dateA && !dateB) {
        return -1; // Items with dates come first
      } else if (!dateA && dateB) {
        return 1; // Items without dates come last
      } else {
        return 0; // Both have no date
      }
    });

  return maxItems ? filtered.slice(0, maxItems) : filtered;
};