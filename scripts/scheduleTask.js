// Function to schedule a task
function scheduleTask(calendar, taskTitle, taskDurationMinutes, bufferMinutes = 15) {
  let events = calendar.getEvents();
  let now = new Date();
  let taskDuration = taskDurationMinutes * 60 * 1000; // Convert minutes to milliseconds

  // Helper function to add minutes to a date
  function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  // Helper function to find the next workday starting time
  function findNextWorkday(date) {
    let nextWorkdayStart = new Date(date);
    // if the current time is before 8 AM, start from 8 AM of the same day
    if (date.getHours() < 8) {
      nextWorkdayStart.setHours(8, 0, 0, 0); // set to 8 AM
      // if the current time is after 10 PM, start from 8 AM of the next day
    } else if (date.getHours() >= 22) {
      nextWorkdayStart.setDate(nextWorkdayStart.getDate() + 1);
      nextWorkdayStart.setHours(8, 0, 0, 0); // set to 8 AM
    }
    // if the time is between 8 AM and 10 PM, start from the current time
    return nextWorkdayStart;
  }

  // Helper function to check if time slot is within work hours
  function isWithinWorkHours(start, end) {
    const workStartHour = 8; // Work starts at 8 AM
    const workEndHour = 22; // Work ends at 10 PM
    return (
      start.getHours() >= workStartHour &&
      end.getHours() < workEndHour &&
      (end.getHours() !== workEndHour || end.getMinutes() === 0)
    ); // End time exactly at 10 PM is acceptable
  }

  // Helper function to check if a time slot is available
  function isSlotAvailable(start, end, buffer) {
    if (!isWithinWorkHours(start, end)) {
      return false; // Time slot is outside work hours
    }
    for (let event of events) {
      let eventStart = new Date(event.start);
      let eventEnd = new Date(event.end);

      // Apply buffer to start and end times for comparison
      let bufferedStart = addMinutes(start, -buffer);
      let bufferedEnd = addMinutes(end, buffer);

      // Check for overlap with event considering buffer
      if (bufferedEnd > eventStart && bufferedStart < eventEnd) {
        return false; // Time slot is not available
      }
    }
    return true; // Time slot is available
  }

  // Find next available slot
  function findNextAvailableTime(startTime, duration, buffer) {
    let nextTime = findNextWorkday(startTime);
    let endTime = new Date(nextTime.getTime() + duration);

    while (nextTime < addMinutes(now, 7 * 24 * 60)) {
      // Search up to 24 hours ahead
      if (isSlotAvailable(nextTime, endTime, buffer)) {
        return nextTime; // Available slot found
      }
      // Move to the next half-hour slot within working hours
      nextTime = addMinutes(nextTime, 15);
      if (nextTime.getHours() >= 22) {
        // If it's past the work end hour, jump to the next work start
        nextTime = findNextWorkday(nextTime); // Add 12 hours to be on the safe side
      }
      endTime = new Date(nextTime.getTime() + duration);
    }
    return null; // If no slot available within 24 hours, return null
  }

  // Make sure we start looking from 8 AM if now is outside of work hours
  let initialStart = now;
  if (now.getHours() < 8 || now.getHours() >= 22) {
    initialStart = findNextWorkday(now);
  }

  // Attempt to schedule the task
  let startTime = findNextAvailableTime(initialStart, taskDuration, bufferMinutes);
  if (startTime) {
    let endTime = new Date(startTime.getTime() + taskDuration);
    // Add the task to the calendar
    var newEvent = calendar.addEvent({
      title: taskTitle,
      start: startTime,
      end: endTime,
      allDay: false,
      color: "#008558", // Color for tasks, can be set differently
      extendedProps: {
        type: "task",
        display: true,
      },
    });
    console.log("Task scheduled:", taskTitle, "at", startTime);
    return newEvent;
  } else {
    console.log("Unable to schedule task:", taskTitle, ". No available slot found.");
  }
}
