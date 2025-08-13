/**
 * Custom hooks for calendar management with React Query integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Calendar } from '@shared/types';
import {
  calendarApi,
  type UpdateCalendarData,
  DEFAULT_CALENDAR_COLORS,
} from '../services/api';

/**
 * Query keys for calendar-related queries
 */
export const calendarQueryKeys = {
  all: ['calendars'] as const,
  lists: () => [...calendarQueryKeys.all, 'list'] as const,
  list: (filters: CalendarFilters) =>
    [...calendarQueryKeys.lists(), filters] as const,
  details: () => [...calendarQueryKeys.all, 'detail'] as const,
  detail: (name: string) => [...calendarQueryKeys.details(), name] as const,
  visible: () => [...calendarQueryKeys.all, 'visible'] as const,
};

/**
 * Calendar filtering options
 */
export interface CalendarFilters {
  visibleOnly?: boolean;
  search?: string;
}

export { DEFAULT_CALENDAR_COLORS };

/**
 * Filter calendars based on criteria
 */
const filterCalendars = (
  calendars: Calendar[],
  filters: CalendarFilters
): Calendar[] => {
  let filtered = [...calendars];

  // Filter by visibility
  if (filters.visibleOnly) {
    filtered = filtered.filter((calendar) => calendar.visible);
  }

  // Filter by search term
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (calendar) =>
        calendar.name.toLowerCase().includes(searchTerm) ||
        calendar.description?.toLowerCase().includes(searchTerm)
    );
  }

  // Sort by name, with default calendar first
  filtered.sort((a, b) => {
    // Default calendar goes first
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;

    // Then sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

  return filtered;
};

/**
 * Comprehensive hook for calendar management - matches LeftPane expectations
 */
export const useCalendars = () => {
  const queryClient = useQueryClient();

  // Main query for calendars data
  const calendarsQuery = useQuery({
    queryKey: calendarQueryKeys.all,
    queryFn: calendarApi.fetchCalendars,
    staleTime: 10 * 60 * 1000, // 10 minutes (calendars change less frequently)
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  // Add calendar mutation (optimistic)
  const addCalendar = useMutation<Calendar, Error, Parameters<typeof calendarApi.createCalendar>[0], { previousCalendars?: Calendar[]; tempId?: string}>({
    mutationFn: calendarApi.createCalendar,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: calendarQueryKeys.all });
      const previousCalendars = queryClient.getQueryData<Calendar[]>(calendarQueryKeys.all);
      const tempId = `temp-${Date.now()}`;
      const temp: Calendar = {
        id: tempId,
        name: variables.name.trim(),
        color: variables.color,
        visible: variables.visible ?? true,
        isDefault: variables.isDefault ?? false,
        description: variables.description?.trim(),
      };
      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.all },
        (oldData: Calendar[] | undefined) => {
          const updated = [...(oldData || []), temp];
          return updated.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
          });
        }
      );
      return { previousCalendars, tempId };
    },
    onError: (error, _vars, context) => {
      if (context?.previousCalendars) {
        queryClient.setQueryData(calendarQueryKeys.all, context.previousCalendars);
      }
      toast.error(error.message || 'Failed to create calendar');
    },
    onSuccess: (newCalendar, _vars, context) => {
      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.all },
        (oldData: Calendar[] | undefined) => {
          const list = oldData || [];
          if (!context?.tempId) return [...list, newCalendar];
          const idx = list.findIndex((c) => c.id === context.tempId);
          if (idx === -1) return [...list, newCalendar];
          const copy = [...list];
          copy[idx] = newCalendar;
          return copy.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
          });
        }
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
  });

  // Update calendar mutation
  const updateCalendar = useMutation({
    mutationFn: ({
      name,
      updates,
    }: {
      name: string;
      updates: Partial<Calendar>;
    }) => calendarApi.updateCalendar(name, updates),
    onMutate: async ({ name, updates }) => {
      await queryClient.cancelQueries({ queryKey: calendarQueryKeys.all });
      const previousCalendars = queryClient.getQueryData<Calendar[]>(
        calendarQueryKeys.all
      );

      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.all },
        (oldData: Calendar[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((calendar) => {
            if (calendar.name === name) {
              // If setting as default, remove default from others
              if (updates.isDefault) {
                oldData.forEach((cal) => {
                  if (cal.name !== name) cal.isDefault = false;
                });
              }
              return { ...calendar, ...updates };
            }
            return calendar;
          });
        }
      );

      return { previousCalendars };
    },
    onError: (error, _variables, context) => {
      if (context?.previousCalendars) {
        queryClient.setQueryData(
          calendarQueryKeys.all,
          context.previousCalendars
        );
      }
      toast.error(error.message || 'Failed to update calendar');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
  });

  // Delete calendar mutation
  const deleteCalendar = useMutation({
    mutationFn: calendarApi.deleteCalendar,
    onMutate: async (calendarName) => {
      await queryClient.cancelQueries({ queryKey: calendarQueryKeys.all });
      const previousCalendars = queryClient.getQueryData<Calendar[]>(
        calendarQueryKeys.all
      );

      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.all },
        (oldData: Calendar[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((calendar) => calendar.name !== calendarName);
        }
      );

      return { previousCalendars };
    },
    onError: (error, _calendarName, context) => {
      if (context?.previousCalendars) {
        queryClient.setQueryData(
          calendarQueryKeys.all,
          context.previousCalendars
        );
      }
      toast.error(error.message || 'Failed to delete calendar');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  // Toggle calendar visibility mutation
  const toggleCalendar = useMutation({
    mutationFn: calendarApi.toggleCalendarVisibility,
    onMutate: async (calendarName) => {
      await queryClient.cancelQueries({ queryKey: calendarQueryKeys.all });
      const previousCalendars = queryClient.getQueryData<Calendar[]>(
        calendarQueryKeys.all
      );

      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.all },
        (oldData: Calendar[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((calendar) =>
            calendar.name === calendarName
              ? { ...calendar, visible: !calendar.visible }
              : calendar
          );
        }
      );

      return { previousCalendars };
    },
    onError: (error, _calendarName, context) => {
      if (context?.previousCalendars) {
        queryClient.setQueryData(
          calendarQueryKeys.all,
          context.previousCalendars
        );
      }
      toast.error(error.message || 'Failed to toggle calendar visibility');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
  });

  // Return data and mutations in the format LeftPane expects
  return {
    data: calendarsQuery.data || [],
    isLoading: calendarsQuery.isLoading,
    isSuccess: calendarsQuery.isSuccess,
    error: calendarsQuery.error,
    addCalendar,
    updateCalendar,
    deleteCalendar,
    toggleCalendar,
    refetch: calendarsQuery.refetch,
  };
};

/**
 * Hook to fetch and filter calendars (original version)
 */
export const useFilteredCalendars = (filters: CalendarFilters = {}) => {
  return useQuery({
    queryKey: calendarQueryKeys.list(filters),
    queryFn: async () => {
      const calendars = await calendarApi.fetchCalendars();
      return filterCalendars(calendars, filters);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (calendars change less frequently)
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
};

/**
 * Hook to fetch all calendars without filtering
 */
export const useAllCalendars = () => {
  return useQuery({
    queryKey: calendarQueryKeys.all,
    queryFn: calendarApi.fetchCalendars,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

/**
 * Hook to fetch only visible calendars
 */
export const useVisibleCalendars = () => {
  return useQuery({
    queryKey: calendarQueryKeys.visible(),
    queryFn: async () => {
      const calendars = await calendarApi.fetchCalendars();
      return calendars.filter((cal) => cal.visible);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
};

/**
 * Hook to fetch a single calendar by name
 */
export const useCalendar = (name: string) => {
  return useQuery({
    queryKey: calendarQueryKeys.detail(name),
    queryFn: async () => {
      const calendars = await calendarApi.fetchCalendars();
      const calendar = calendars.find((cal) => cal.name === name);
      if (!calendar) {
        throw new Error('Calendar not found');
      }
      return calendar;
    },
    enabled: !!name,
    staleTime: 10 * 60 * 1000,
  });
};

/**
 * Hook to get the default calendar
 */
export const useDefaultCalendar = () => {
  return useQuery({
    queryKey: [...calendarQueryKeys.all, 'default'],
    queryFn: async () => {
      const calendars = await calendarApi.fetchCalendars();
      const defaultCalendar = calendars.find((cal) => cal.isDefault);
      if (!defaultCalendar) {
        // If no default is set, return the first calendar
        return calendars[0] || null;
      }
      return defaultCalendar;
    },
    staleTime: 10 * 60 * 1000,
  });
};

/**
 * Hook to create a new calendar
 */
export const useCreateCalendar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calendarApi.createCalendar,
    onSuccess: (newCalendar) => {
      // Invalidate and refetch calendar queries
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });

      // Optimistically add the calendar to existing queries
      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.lists() },
        (oldData: Calendar[] | undefined) => {
          if (!oldData) return [newCalendar];
          const updated = [...oldData, newCalendar];
          return updated.sort((a, b) => {
            // Default calendar goes first
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
          });
        }
      );
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create calendar');
    },
  });
};

/**
 * Hook to update a calendar
 */
export const useUpdateCalendar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateCalendarData }) =>
      calendarApi.updateCalendar(name, data),
    onMutate: async ({ name, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: calendarQueryKeys.all });

      // Snapshot the previous value
      const previousCalendars = queryClient.getQueryData<Calendar[]>(
        calendarQueryKeys.all
      );

      // Optimistically update the calendar
      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.all },
        (oldData: Calendar[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((calendar) => {
            if (calendar.name === name) {
              // If setting as default, remove default from others
              if (data.isDefault) {
                oldData.forEach((cal) => {
                  if (cal.name !== name) cal.isDefault = false;
                });
              }
              return { ...calendar, ...data };
            }
            return calendar;
          });
        }
      );

      return { previousCalendars };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousCalendars) {
        queryClient.setQueryData(
          calendarQueryKeys.all,
          context.previousCalendars
        );
      }
      toast.error(error.message || 'Failed to update calendar');
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
  });
};

/**
 * Hook to delete a calendar
 */
export const useDeleteCalendar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calendarApi.deleteCalendar,
    onMutate: async (calendarName) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: calendarQueryKeys.all });

      // Snapshot the previous value
      const previousCalendars = queryClient.getQueryData<Calendar[]>(
        calendarQueryKeys.all
      );

      // Optimistically remove the calendar
      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.all },
        (oldData: Calendar[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter((calendar) => calendar.name !== calendarName);
        }
      );

      return { previousCalendars };
    },
    onError: (error, _calendarName, context) => {
      // Rollback on error
      if (context?.previousCalendars) {
        queryClient.setQueryData(
          calendarQueryKeys.all,
          context.previousCalendars
        );
      }
      toast.error(error.message || 'Failed to delete calendar');
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
      // Also invalidate events since they may reference the deleted calendar
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

/**
 * Hook to toggle calendar visibility
 */
export const useToggleCalendarVisibility = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calendarApi.toggleCalendarVisibility,
    onMutate: async (calendarName) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: calendarQueryKeys.all });

      // Snapshot the previous value
      const previousCalendars = queryClient.getQueryData<Calendar[]>(
        calendarQueryKeys.all
      );

      // Optimistically toggle visibility
      queryClient.setQueriesData(
        { queryKey: calendarQueryKeys.all },
        (oldData: Calendar[] | undefined) => {
          if (!oldData) return [];
          return oldData.map((calendar) =>
            calendar.name === calendarName
              ? { ...calendar, visible: !calendar.visible }
              : calendar
          );
        }
      );

      return { previousCalendars };
    },
    onError: (error, _calendarName, context) => {
      // Rollback on error
      if (context?.previousCalendars) {
        queryClient.setQueryData(
          calendarQueryKeys.all,
          context.previousCalendars
        );
      }
      console.error('Failed to toggle calendar visibility:', error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
  });
};

/**
 * Hook to set a calendar as default
 */
export const useSetDefaultCalendar = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calendarApi.setDefaultCalendar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all });
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to set default calendar');
    },
  });
};
