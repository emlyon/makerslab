#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
loadDotEnvIfPresent();

const config = loadConfig();
const TOKEN = config.EVENTBRITE_TOKEN;
const ORGANIZATION_ID = config.EVENTBRITE_ORGANIZATION_ID;
const OUTPUT_ROOT = resolveOutputRoot();
const OUTPUT_EVENTS_PATH = path.join(OUTPUT_ROOT, 'data', 'events.json');
const OPTIONS = {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${TOKEN}`
  }
};

function loadConfig() {
  const envToken = process.env.EVENTBRITE_TOKEN;
  const envOrganizationId = process.env.EVENTBRITE_ORGANIZATION_ID;

  if (!envToken || !envOrganizationId) {
    throw new Error('Environment secrets EVENTBRITE_TOKEN and EVENTBRITE_ORGANIZATION_ID missing.');
  }

  return {
    EVENTBRITE_TOKEN: envToken,
    EVENTBRITE_ORGANIZATION_ID: envOrganizationId
  };
}

function loadDotEnvIfPresent() {
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  try {
    require('dotenv').config({ path: envPath });
  } catch (_error) {
    // Do nothing when dotenv is unavailable in CI.
  }
}

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

(async () => {
  try {
    const events = await fetchEvents();
    console.log("Nombre d'évènements : " + events.length);
    await enrichEventsWithVenueData(events);
    events.forEach(logEventInfo);
    fs.mkdirSync(path.dirname(OUTPUT_EVENTS_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_EVENTS_PATH, JSON.stringify(events, null, 2));
    console.log(`Events written to: ${OUTPUT_EVENTS_PATH}`);
    process.exit();
  } catch (e) {
    console.warn(e);
    process.exit(1);
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
