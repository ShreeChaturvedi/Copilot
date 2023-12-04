// Google API Client ID and API Key
const CLIENT_ID = '805254988903-c5c55vhpaqu165h8gtsgv00nioh0tldr.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBr1Ej-r0jEuJavQNkMGM1qLj9BFcSH_6I';

// Discovery doc URL for the Google Calendar API
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Authorization scopes required by the API; in this case, read-only access
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Initialize Google API and Identity Services
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // defined later
  });
  gisInited = true;
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
}

// Authenticate and handle the auth flow
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw (resp);
    }
    await listUpcomingEvents();
  };

  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

// Sign out the user
function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken('');
  }
}

async function listUpcomingEvents() {
  try {
    // Fetch list of all calendars
    const calendarsResponse = await gapi.client.calendar.calendarList.list();
    const calendars = calendarsResponse.result.items;

    if (!calendars || calendars.length === 0) {
      console.log('No calendars found.');
      return;
    }

    // Calculate the first day of the current month
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1); // Set to first day of the month
    firstDayOfMonth.setHours(0, 0, 0, 0); // Set time to start of the day

    // Fetch events from each calendar
    for (const calendar of calendars) {
      const eventsResponse = await gapi.client.calendar.events.list({
        'calendarId': calendar.id,
        'timeMin': firstDayOfMonth.toISOString(),
        'showDeleted': false,
        'singleEvents': true,
        'orderBy': 'startTime',
      });

      const events = eventsResponse.result.items;
      if (events && events.length > 0) {
        importEventsToFullCalendar(events, calendar);
      }
    }
    calendar.refetchEvents();
    updateCalendarsAndCheckboxes();
  } catch (err) {
    console.log('Error fetching calendars or events:', err.message);
  }
}

// Function to process and display events in FullCalendar
function importEventsToFullCalendar(googleEvents, googleCalendar) {
  const fullCalendarEvents = googleEvents.map(event => {
    // Check if event is all-day or not
    let isAllDay = event.start.date && !event.start.dateTime;

    // Additional check for events starting and ending at 12:00 AM
    if (!isAllDay && event.start.dateTime && event.end.dateTime) {
      const startTime = new Date(event.start.dateTime).toTimeString().substring(0, 5);
      const endTime = new Date(event.end.dateTime).toTimeString().substring(0, 5);

      // Check if both start and end times are at 12:00 AM
      isAllDay = startTime === '00:00' && endTime === '00:00';
    }

    // Create FullCalendar event object
    eventObj = {
      id: Date.now(),
      title: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      allDay: isAllDay,
      color: googleCalendar.backgroundColor,
      extendedProps: {
        calendarName: googleCalendar.summary,
        description: event.description,
        location: event.location,
        display: true,
        notes: '',
      }
    };

    return eventObj;
  });

  // Add a new map of calendarName -> array of events
  allEvents.set(googleCalendar.summary, fullCalendarEvents);

  calendarStates.set(googleCalendar.summary, {display: true, color: googleCalendar.backgroundColor});
}
