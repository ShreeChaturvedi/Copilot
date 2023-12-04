var calendar; // Global calendar object
var allEvents = new Map(); // Global array of all events
var calendarStates = new Map(); // Map of calendar names to display states
var toSearch = false;
var searchTerm = '';
var currentEvent; // Global id to store the current event being edited
calendarStates.set('Primary', { display: true, color: '#000000' }); // Default calendar to display
allEvents.set('Primary', []); // Default calendar to display

document.addEventListener('DOMContentLoaded', function () {
  updateCalendarsAndCheckboxes();
  const calendarEl = document.getElementById('calendar');

  // Initialize the calendar
  calendar = new FullCalendar.Calendar(calendarEl, {
    // Toolbar options
    headerToolbar: {
      left: 'prev,next today',
      right: 'searchBar',
      center: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek', // Provide buttons for switching views
    },

    // Customize button names
    initialView: 'timeGridWeek', // Set the initial view to weekly

    // Customize today's date background color 
    dayCellDidMount: function (dayCellInfo) {
      // Check if the cell's date is today
      if (
        FullCalendar.formatDate(dayCellInfo.date, { month: 'long', day: 'numeric', year: 'numeric' }) ===
        FullCalendar.formatDate(new Date(), { month: 'long', day: 'numeric', year: 'numeric' })
      ) {
        // Add a background color to today's cell
        dayCellInfo.el.style.backgroundColor = '#d1fff0'; // Change the color to your preference
      }
    },

    navLinks: true, // can click day/week names to navigate views
    editable: true, // allow event dragging
    nowIndicator: true, // show 'now' indicator
    selectable: true, // allow event selection
    selectMirror: true, // show a mirror when dragging over days
    dayMaxEvents: true, // allow 'more' link when too many events
    eventSources: [{ events: fetchEvents }], // Fetch events from the fetchEvents function

    // When dragging across, create a new event
    select: function (arg) {
      document.getElementById('event-title-modal').textContent = 'Create Event';

      // Save a blank event to show
      tempEvent = calendar.addEvent({
        title: '',
        start: arg.start,
        end: arg.end,
        allDay: false,
        color: '#555',
        classNames: ['fc-event-mirror'],
        extendedProps: {
          type: 'temporary',
          display: true,
        }
      });

      document.getElementById('event-title').addEventListener('input', function () {
        tempEvent.setProp('title', document.getElementById('event-title').value);
      });

      document.getElementById('event-date').addEventListener('input', function () {
        tempEvent.setStart(document.getElementById('event-date').value + 'T' + document.getElementById('event-start-time').value);
        tempEvent.setEnd(document.getElementById('event-date').value + 'T' + document.getElementById('event-end-time').value);
      });

      document.getElementById('event-start-time').addEventListener('input', function () {
        tempEvent.setStart(document.getElementById('event-date').value + 'T' + document.getElementById('event-start-time').value);
      });

      document.getElementById('event-end-time').addEventListener('input', function () {
        tempEvent.setEnd(document.getElementById('event-date').value + 'T' + document.getElementById('event-end-time').value);
      });

      // Open the event modal
      openEventModal();

      // Format selected date and time for inputs
      const startDate = arg.start.toISOString().slice(0, 10);
      const startTime = FullCalendar.formatDate(arg.start, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const endTime = FullCalendar.formatDate(arg.end, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      // Set the values of the inputs
      document.getElementById('event-date').value = startDate;
      // document.getElementById('event-date').value = '2023-11-07'; // November 7th, 2023
      document.getElementById('event-start-time').value = startTime;
      document.getElementById('event-end-time').value = endTime;

      // Since this is a new selection, there's no current event
      currentEvent = null;
    },

    // When clicking on an event, open the event details pop-up
    eventClick: function (info) {
      // Store the current event in case the user wants to edit it
      currentEvent = info.event;

      console.log(currentEvent);

      document.getElementById('event-title-modal').textContent = 'Edit Event';
      const eventDetails = document.getElementById('event-details');
      const modal = document.getElementById('event-modal');

      // Fill in the event details
      document.getElementById('event-details-title-icon').style.backgroundColor = info.event.backgroundColor;
      document.getElementById('event-details-title').textContent = info.event.title;

      // Display the calendar name
      document.getElementById('event-details-calendar').textContent = info.event.extendedProps.calendarName;

      // Display the description if it exists
      if (info.event.extendedProps.description) {
        document.getElementById('event-details-description-wrapper').style.display = 'flex';
        document.getElementById('event-details-description').innerHTML = info.event.extendedProps.description;
      } else {
        document.getElementById('event-details-description-wrapper').style.display = 'none';
      }

      // Display the location if it exists
      if (info.event.extendedProps.location) {
        document.getElementById('event-details-location-wrapper').style.display = 'flex';
        document.getElementById('event-details-location').textContent = info.event.extendedProps.location;
        document.getElementById('event-details-location').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          info.event.extendedProps.location
        )}`;
      } else {
        document.getElementById('event-details-location-wrapper').style.display = 'none';
      }

      // Display the date and time

      document.getElementById('event-details-date').textContent =
        FullCalendar.formatDate(info.event.start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      document.getElementById('event-details-time').textContent =
        FullCalendar.formatDate(info.event.start, { hour: '2-digit', minute: '2-digit', hour12: true })
        + ' — '
        + FullCalendar.formatDate(info.event.end, { hour: '2-digit', minute: '2-digit', hour12: true });

      // Show the event details pop-up
      eventDetails.style.display = 'block';

      // Hide the existing event modal if open
      modal.style.display = 'none';

      document.getElementById('event-details-notes').onclick = function () {
        document.querySelector('.document-editor__container').classList.toggle('show');
        document.querySelector('#editor').focus(); // focus the #editor when it is shown
        console.log(currentEvent);
        let editorNotes = allEvents.get(currentEvent.extendedProps.calendarName).find(
          event => event.id === currentEvent.id
        ).extendedProps.notes;
        editor.setData(editorNotes || '');
      };

      // Handle delete event within the pop-up card
      document.getElementById('delete-event-btn').onclick = function () {
        deleteEvent();
      };

      // Handle edit event within the pop-up card
      document.getElementById('edit-event-btn').onclick = function () {
        openEventModal(currentEvent);
        eventDetails.style.display = 'none';
      };
    },
    // Additional options...
  });

  // Render the calendar
  calendar.render();

  function fetchEvents(fetchInfo, successCallback, failureCallback) {
    var combinedEvents = [];
    const regex = new RegExp(searchTerm, 'i');

    // Correct iteration over a Map object
    calendarStates.forEach((calendarState, calendarID) => {
      if (calendarState.display) { // Check if the calendar is set to be displayed, using the 'display' property
        var events = allEvents.get(calendarID);
        if (Array.isArray(events)) {
          if (toSearch) {
            events = events.filter(event => regex.test(event.title));
          }
          combinedEvents = combinedEvents.concat(events);
        }
      }
    });

    return successCallback(combinedEvents);
  }

  // Function to add a new task to the calendar
  window.addCalendarEvent = function (taskTitle) {
    return scheduleTask(calendar, taskTitle, 60, 15);
  };

  // Function to remove a task from the calendar
  window.removeCalendarEvent = function (taskContent) {
    // Retrieve all events from the calendar
    let events = calendar.getEvents();
    // Find the event with the matching title
    let event = events.find((e) => e.title === taskContent);
    // If found, remove it
    if (event) {
      event.remove();
    }
  };

  // Function to open modal with or without event details
  function openEventModal(event = null) {
    const modal = document.getElementById('event-modal');
    const deleteButton = document.getElementById('delete-event');
    let dropdown = document.getElementById('calendar-dropdown');
    modal.style.display = 'block';

    dropdown.innerHTML = '';
    for (let key of calendarStates.keys()) {
      let option = new Option(key, key);
      dropdown.add(option);
    }

    // If there's an event, fill in the details for editing
    if (event) {
      currentEvent = event;
      document.getElementById('event-title').value = event.title;
      dropdown.value = event.extendedProps.calendarName;
      document.getElementById('event-description').value = event.extendedProps.description || '';
      document.getElementById('event-location').value = event.extendedProps.location || '';
      document.getElementById('event-date').value = event.start.toISOString().slice(0, 10);
      document.getElementById('event-start-time').value = FullCalendar.formatDate(event.start, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      document.getElementById('event-end-time').value = FullCalendar.formatDate(event.end, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      deleteButton.style.display = 'block';
    } else {
      // Reset form for new event
      document.getElementById('event-form').reset();
      deleteButton.style.display = 'none';
    }
  }

  // Event listener to close modal when clicking outside of it
  window.onclick = function (event) {
    const modal = document.getElementById('event-modal');
    const infoModal = document.getElementById('event-details');
    if (event.target == modal) {
      closeModal();
    } else if (event.target == infoModal) {
      closeInfoModal();
    }
  };

  // Close modal
  function closeModal() {
    document.getElementById('event-modal').style.display = 'none';
    try {
      tempEvent.remove();
    } catch (error) {
      // Do nothing
    }
  }

  function closeInfoModal() {
    document.getElementById('event-details').style.display = 'none';
  }

  function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Event listener to close modal
  document.querySelector('.close-button').addEventListener('click', closeModal);

  // Event listener for form submission
  document.getElementById('event-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saveEvent();
  });

  document.getElementById('close-event-btn').addEventListener('click', function () {
    closeInfoModal();
  });

  // Save event
  function saveEvent() {
    const title = document.getElementById('event-title').value;
    const description = document.getElementById('event-description').value;
    const location = document.getElementById('event-location').value;
    const date = document.getElementById('event-date').value;
    const startTime = document.getElementById('event-start-time').value;
    const endTime = document.getElementById('event-end-time').value;
    const selectedCalendar = document.getElementById('calendar-dropdown').value;

    // delete the current event if it exists

    if (currentEvent) {
      deleteEvent(false);
    }

    // Create a new event
    eventObj = {
      id: Date.now().toString(), // Convert the numeric ID to a string
      title: capitalizeFirstLetter(title),
      start: date + 'T' + startTime,
      end: date + 'T' + endTime,
      allDay: false,
      extendedProps: {
        calendarName: selectedCalendar,
        description: description,
        location: location,
        display: true,
        notes: '',
      },
      color: 'black',
    };

    // Add the event to the global array
    allEvents.get(selectedCalendar).push(eventObj);
    calendar.refetchEvents();

    closeModal();
  }

  function deleteEvent(close = true) {
    // delete the event with id of currentEvent
    const calendarName = currentEvent.extendedProps.calendarName;
    const eventIndex = allEvents.get(calendarName).findIndex(
      event => event.id === currentEvent.id
    );
    allEvents.get(calendarName).splice(eventIndex, 1);

    if (close) {
      closeModal();
      closeInfoModal();
      calendar.refetchEvents();
    }
  }

  // Event listener to delete event
  document.getElementById('delete-event').addEventListener('click', function () {
    deleteEvent();
  });

  // '+' button event listener
  // document.getElementById('add-event-button').addEventListener('click', function () {
  //   openEventModal();
  // });
});