/**
 * Custom hooks for calendar event management with React Query integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CalendarEvent } from '../types';
import { eventApi, type UpdateEventData } from '../services/api';
import { toUTC } from '../utils/date';

/**
 * Query keys for event-related queries
 */
export const eventQueryKeys = {
  all: ['events'] as const,
  lists: () => [...eventQueryKeys.all, 'list'] as const,
  list: (filters: EventFilters) => [...eventQueryKeys.lists(), filters] as const,
  details: () => [...eventQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...eventQueryKeys.details(), id] as const,
  byCalendar: (calendarName: string) => [...eventQueryKeys.all, 'calendar', calendarName] as const,
  byDateRange: (start: Date, end: Date) => [...eventQueryKeys.all, 'dateRange', start.toISOString(), end.toISOString()] as const,
};

/**
 * Event filtering options
 */
export interface EventFilters {
  calendarNames?: string[];
  startDate?: Date;
  endDate?: Date;
  search?: string;
  allDay?: boolean;
}


/**
 * Filter events based on criteria
 */
const filterEvents = (events: CalendarEvent[], filters: EventFilters): CalendarEvent[] => {
  let filtered = [...events];

  // Filter by calendar names
  if (filters.calendarNames && filters.calendarNames.length > 0) {
    filtered = filtered.filter(event => 
      filters.calendarNames!.includes(event.calendarName)
    );
  }

  // Filter by date range
  if (filters.startDate && filters.endDate) {
    const startUTC = toUTC(filters.startDate);
    const endUTC = toUTC(filters.endDate);
    
    filtered = filtered.filter(event => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      return eventStart < endUTC && eventEnd > startUTC;
    });
  }

  // Filter by search term
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.toLowerCase().trim();
    filtered = filtered.filter(event =>
      event.title.toLowerCase().includes(searchTerm) ||
      event.description?.toLowerCase().includes(searchTerm) ||
      event.location?.toLowerCase().includes(searchTerm)
    );
  }

  // Filter by all-day status
  if (filters.allDay !== undefined) {
    filtered = filtered.filter(event => event.allDay === filters.allDay);
  }

  // Sort by start date (earliest first)
  filtered.sort((a, b) => {
    const dateA = new Date(a.start);
    const dateB = new Date(b.start);
    return dateA.getTime() - dateB.getTime();
  });

  return filtered;
};

/**
 * Hook to fetch and filter events
 */
export const useEvents = (filters: EventFilters = {}) => {
  return useQuery({
    queryKey: eventQueryKeys.list(filters),
    queryFn: async () => {
      const events = await eventApi.fetchEvents();
      return filterEvents(events, filters);
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to fetch all events without filtering
 */
export const useAllEvents = () => {
  return useQuery({
    queryKey: eventQueryKeys.all,
    queryFn: eventApi.fetchEvents,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Hook to fetch a single event by ID
 */
export const useEvent = (id: string) => {
  return useQuery({
    queryKey: eventQueryKeys.detail(id),
    queryFn: async () => {
      const events = await eventApi.fetchEvents();
      const event = events.find(e => e.id === id);
      if (!event) {
        throw new Error('Event not found');
      }
      return event;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch events for a specific calendar
 */
export const useEventsByCalendar = (calendarName: string) => {
  return useQuery({
    queryKey: eventQueryKeys.byCalendar(calendarName),
    queryFn: () => eventApi.fetchEventsByCalendar(calendarName),
    enabled: !!calendarName,
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * Hook to fetch events within a date range
 */
export const useEventsByDateRange = (start: Date, end: Date) => {
  return useQuery({
    queryKey: eventQueryKeys.byDateRange(start, end),
    queryFn: () => eventApi.fetchEventsByDateRange(start, end),
    enabled: !!start && !!end,
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * Hook to create a new event
 */
export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: eventApi.createEvent,
    onSuccess: (newEvent) => {
      // Invalidate and refetch event queries
      queryClient.invalidateQueries({ queryKey: eventQueryKeys.all });
      
      // Optimistically add the event to existing queries
      queryClient.setQueriesData(
        { queryKey: eventQueryKeys.lists() },
        (oldData: CalendarEvent[] | undefined) => {
          if (!oldData) return [newEvent];
          return [...oldData, newEvent].sort((a, b) => 
            new Date(a.start).getTime() - new Date(b.start).getTime()
          );
        }
      );
    },
    onError: (error) => {
      console.error('Failed to create event:', error);
    },
  });
};

/**
 * Hook to update an event
 */
export const useUpdateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventData }) =>
      eventApi.updateEvent(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventQueryKeys.all });

      // Snapshot the previous value
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(eventQueryKeys.all);

      // Optimistically update the event
      queryClient.setQueriesData(
        { queryKey: eventQueryKeys.all },
        (oldData: CalendarEvent[] | undefined) => {
          if (!oldData) return [];
          return oldData.map(event =>
            event.id === id ? { ...event, ...data } : event
          );
        }
      );

      return { previousEvents };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        queryClient.setQueryData(eventQueryKeys.all, context.previousEvents);
      }
      console.error('Failed to update event:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: eventQueryKeys.all });
    },
  });
};

/**
 * Hook to delete an event
 */
export const useDeleteEvent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: eventApi.deleteEvent,
    onMutate: async (eventId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: eventQueryKeys.all });

      // Snapshot the previous value
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(eventQueryKeys.all);

      // Optimistically remove the event
      queryClient.setQueriesData(
        { queryKey: eventQueryKeys.all },
        (oldData: CalendarEvent[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter(event => event.id !== eventId);
        }
      );

      return { previousEvents };
    },
    onError: (error, _eventId, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        queryClient.setQueryData(eventQueryKeys.all, context.previousEvents);
      }
      console.error('Failed to delete event:', error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: eventQueryKeys.all });
    },
  });
};