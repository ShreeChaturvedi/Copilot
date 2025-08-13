/**
 * Custom hooks for calendar event management with React Query integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import type { CalendarEvent } from '@shared/types';
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
      filters.calendarNames!.includes(event.calendarName || '')
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
export const useEvents = (
  filters: EventFilters = {},
  options?: { enabled?: boolean }
) => {
  const allEventsQuery = useQuery({
    queryKey: eventQueryKeys.all,
    queryFn: eventApi.fetchEvents,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });

  const filtered = useMemo(() => {
    return filterEvents(allEventsQuery.data || [], filters);
  }, [allEventsQuery.data, filters]);

  return {
    data: filtered,
    isLoading: allEventsQuery.isLoading,
    isSuccess: allEventsQuery.isSuccess,
    error: allEventsQuery.error,
    refetch: allEventsQuery.refetch,
  } as const;
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
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: eventQueryKeys.detail(id),
    queryFn: async () => {
      const allEvents = await queryClient.ensureQueryData({
        queryKey: eventQueryKeys.all,
        queryFn: eventApi.fetchEvents,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });
      const event = allEvents.find(e => e.id === id);
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
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: eventQueryKeys.byCalendar(calendarName),
    queryFn: async () => {
      const allEvents = await queryClient.ensureQueryData({
        queryKey: eventQueryKeys.all,
        queryFn: eventApi.fetchEvents,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });
      return allEvents.filter(e => e.calendarName === calendarName);
    },
    enabled: !!calendarName,
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * Hook to fetch events within a date range
 */
export const useEventsByDateRange = (start: Date, end: Date) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: eventQueryKeys.byDateRange(start, end),
    queryFn: async () => {
      const allEvents = await queryClient.ensureQueryData({
        queryKey: eventQueryKeys.all,
        queryFn: eventApi.fetchEvents,
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });
      const startUTC = toUTC(start);
      const endUTC = toUTC(end);
      return allEvents.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return eventStart < endUTC && eventEnd > startUTC;
      });
    },
    enabled: !!start && !!end,
    staleTime: 2 * 60 * 1000,
  });
};

/**
 * Hook to create a new event
 */
export const useCreateEvent = () => {
  const queryClient = useQueryClient();

  return useMutation<CalendarEvent, Error, Parameters<typeof eventApi.createEvent>[0], { previousEvents?: CalendarEvent[]; tempId?: string}>({
    mutationFn: eventApi.createEvent,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: eventQueryKeys.all });
      const previousEvents = queryClient.getQueryData<CalendarEvent[]>(eventQueryKeys.all);
      const tempId = `temp-${Date.now()}`;
      const tempEvent: CalendarEvent = {
        id: tempId,
        title: variables.title.trim(),
        start: variables.start,
        end: variables.end,
        description: variables.description?.trim(),
        location: variables.location?.trim(),
        calendarName: variables.calendarName,
        notes: variables.notes,
        color: variables.color,
        allDay: variables.allDay || false,
        recurrence: variables.recurrence,
        exceptions: variables.exceptions || [],
      };
      queryClient.setQueriesData(
        { queryKey: eventQueryKeys.all },
        (oldData: CalendarEvent[] | undefined) => {
          const list = [...(oldData || []), tempEvent];
          return list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        }
      );
      return { previousEvents, tempId };
    },
    onError: (error, _variables, context) => {
      if (context?.previousEvents) {
        queryClient.setQueryData(eventQueryKeys.all, context.previousEvents);
      }
      toast.error(error.message || 'Failed to create event');
    },
    onSuccess: (newEvent, _variables, context) => {
      queryClient.setQueriesData(
        { queryKey: eventQueryKeys.all },
        (oldData: CalendarEvent[] | undefined) => {
          const list = oldData || [];
          if (!context?.tempId) return [...list, newEvent];
          const idx = list.findIndex((e) => e.id === context.tempId);
          if (idx === -1) return [...list, newEvent];
          const copy = [...list];
          copy[idx] = newEvent;
          return copy.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        }
      );
    },
    // Avoid immediate invalidation to prevent optimistic item flicker
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
      toast.error(error.message || 'Failed to update event');
    },
    // Avoid immediate invalidation to keep optimistic position stable
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
      toast.error(error.message || 'Failed to delete event');
    },
    // Avoid immediate invalidation to keep optimistic delete stable
  });
};