const fs = require('fs');
const config = JSON.parse(fs.readFileSync('workshops-data/eventbrite-config.json', 'utf8'));
const TOKEN = config.TOKEN;
const ORGANIZATION_ID = config.ORGANIZATION_ID;
const OPTIONS = {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${TOKEN}`
  }
};

(async () => {
  // Fetch events and process them
  try {
    const events = await fetchEvents();
    console.log("Nombre d'évènements : " + events.length);
    await enrichEventsWithVenueData(events);
    events.forEach(logEventInfo);
    // Write formatted events to events.json
    fs.writeFileSync('workshops-data/events.json', JSON.stringify(events, null, 2));
    process.on('exit', () => {
      console.log('Closing connection and exiting...');
      // Perform any cleanup if necessary
    });
    process.exit();
  } catch (e) {
    console.warn(e);
  }
})();

async function fetchEvents() {
  const fetch = (await import('node-fetch')).default;
  const baseUrl = `https://www.eventbriteapi.com/v3/organizations/${ORGANIZATION_ID}/events/`;
  const params = {
    status: 'live',
    time_filter: 'current_future'
  };

  const url = new URL(baseUrl);
  url.search = new URLSearchParams(params).toString();

  try {
    const response = await fetch(url, OPTIONS);
    const data = await response.json();
    return data.events;
  } catch (e) {
    console.warn(e);
    throw e;
  }
}

async function fetchVenues() {
  const baseURL = `https://www.eventbriteapi.com/v3/organizations/${ORGANIZATION_ID}/venues/`;
  const fetch = (await import('node-fetch')).default;
  try {
    const response = await fetch(baseURL, OPTIONS);
    const data = await response.json();
    return data.venues;
  } catch (e) {
    console.warn(e);
    throw e;
  }
}

async function enrichEventsWithVenueData(events) {
  const venues = await fetchVenues();
  events.forEach((event) => {
    const venue = venues.find((v) => v.id === event.venue_id);
    event.venue = venue;
  });
  return events;
}

function logEventInfo(event) {
  console.log('---------------------');
  console.log(`ID: ${event.id}`);
  console.log(`Name: ${event.name.text}`);
  console.log(`Description: ${event.description.text}`);
  console.log(`Venue City: ${event.venue.address.city}`);
  console.log(`Start Date: ${event.start.local}`);
  console.log(`End Date: ${event.end.local}`);
  console.log(`Logo URL: ${event.logo?.url}`);
}
