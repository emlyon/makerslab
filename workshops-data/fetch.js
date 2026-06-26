const fs = require('fs');
const path = require('path');

const config = loadConfig();
const TOKEN = config.TOKEN;
const ORGANIZATION_ID = config.ORGANIZATION_ID;
const OUTPUT_ROOT = resolveOutputRoot();
const OUTPUT_EVENTS_PATH = path.join(OUTPUT_ROOT, 'workshops-data', 'events.json');
const OPTIONS = {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${TOKEN}`
  }
};

function loadConfig() {
  const envToken = process.env.EVENTBRITE_TOKEN;
  const envOrganizationId = process.env.EVENTBRITE_ORGANIZATION_ID;
  if (envToken && envOrganizationId) {
    return {
      TOKEN: envToken,
      ORGANIZATION_ID: envOrganizationId
    };
  } else {
    console.warn('Environment secrets EVENTBRITE_TOKEN and EVENTBRITE_ORGANIZATION_ID not set. Falling back to local config file.');
    const localConfigPath = path.join(__dirname, 'eventbrite-config.json');
    if (!fs.existsSync(localConfigPath)) {
      throw new Error(
        'Missing Eventbrite config. Set EVENTBRITE_TOKEN and EVENTBRITE_ORGANIZATION_ID, or add workshops-data/eventbrite-config.json.'
      );
    }
  
    return JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
  }
}

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || path.join(__dirname, '..');
  return path.resolve(outputRoot);
}

(async () => {
  // Fetch events and process them
  try {
    const events = await fetchEvents();
    console.log("Nombre d'évènements : " + events.length);
    // console.log(events.find((event) => event.id === '1028711693367'));
    await enrichEventsWithVenueData(events);
    events.forEach(logEventInfo);
    // Write formatted events to events.json
    fs.mkdirSync(path.dirname(OUTPUT_EVENTS_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_EVENTS_PATH, JSON.stringify(events, null, 2));
    console.log(`Events written to: ${OUTPUT_EVENTS_PATH}`);
    process.on('exit', () => {
      console.log('Closing connection and exiting...');
      // Perform any cleanup if necessary
    });
    process.exit();
  } catch (e) {
    console.warn(e);
    process.exit();
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
    let events = data.events;
    if (data.pagination?.has_more_items) {
      events = await addPaginatedEvents(events, params, data.pagination.continuation);
    }
    return events;
  } catch (e) {
    console.warn(e);
    throw e;
  }
}

async function addPaginatedEvents(events, params, continuationToken) {
  const fetch = (await import('node-fetch')).default;
  const baseURL = `https://www.eventbriteapi.com/v3/organizations/${ORGANIZATION_ID}/events/`;
  const url = new URL(baseURL);
  const newParams = {
    ...params,
    continuation: continuationToken
  };
  url.search = new URLSearchParams(newParams).toString();
  try {
    const response = await fetch(url, OPTIONS);
    const data = await response.json();
    const newEvents = data.events;
    if (!data.pagination?.has_more_items) return events.concat(newEvents);
    return addPaginatedEvents(events.concat(newEvents), params, data.pagination.continuation);
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
    let venues = data.venues;
    if (data.pagination?.has_more_items) {
      venues = await addPaginatedVenues(venues, data.pagination.continuation);
    }
    return venues;
  } catch (e) {
    console.warn(e);
    throw e;
  }
}

async function addPaginatedVenues(venues, continuationToken) {
  const baseURL = `https://www.eventbriteapi.com/v3/organizations/${ORGANIZATION_ID}/venues/`;
  const fetch = (await import('node-fetch')).default;
  const params = {
    continuation: continuationToken
  };
  const url = new URL(baseURL);
  url.search = new URLSearchParams(params).toString();
  try {
    const response = await fetch(url, OPTIONS);
    const data = await response.json();
    const newVenues = data.venues;
    if (!data.pagination?.has_more_items) return venues.concat(newVenues);
    return addPaginatedVenues(venues.concat(newVenues), data.pagination.continuation);
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
  console.log(`Summary: ${event.summary}`);
  console.log(`Venue City: ${event.venue?.address?.city || 'N/A'}`);
  console.log(`Start Date: ${event.start.local}`);
  console.log(`End Date: ${event.end.local}`);
  console.log(`Logo URL: ${event.logo?.url}`);
}
