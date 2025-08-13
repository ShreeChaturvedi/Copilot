import { useCalendars } from './useCalendars';

export const useCalendarManagement = () => {
  const {
    data: calendars = [],
    toggleCalendar,
    addCalendar,
    updateCalendar,
    deleteCalendar,
    isLoading: calendarsLoading
  } = useCalendars();

  const handleToggleCalendar = (name: string) => {
    toggleCalendar.mutate(name);
  };

  const handleAddCalendar = (name: string, color: string) => {
    addCalendar.mutate({ name, color });
  };

  const handleEditCalendar = (currentName: string, newName: string, color: string) => {
    // Request to update, then optimistically show create dialog behavior is not required.
    updateCalendar.mutate({
      name: currentName,
      updates: { name: newName, color }
    });
  };

  const handleDeleteCalendar = (name: string) => {
    deleteCalendar.mutate(name);
  };

  return {
    calendars,
    calendarsLoading,
    handleToggleCalendar,
    handleAddCalendar,
    handleEditCalendar,
    handleDeleteCalendar,
  };
};