#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');

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

loadDotEnvIfPresent();


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

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

const config = loadConfig();

async function fetchEventsFromEventbrite(token, organizationId) {
  const fetch = (await import('node-fetch')).default;
  const baseUrl = `https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`;
  const params = {
    status: 'live',
    time_filter: 'current_future'
  };

  const OPTIONS = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  const url = new URL(baseUrl);
  url.search = new URLSearchParams(params).toString();

  try {
    const response = await fetch(url, OPTIONS);
    const data = await response.json();
    let events = data.events;
    if (data.pagination?.has_more_items) {
      events = await addPaginatedEvents(events, params, data.pagination.continuation, token, organizationId);
    }
    return events;
  } catch (e) {
    console.warn(e);
    throw e;
  }
}

async function addPaginatedEvents(events, params, continuationToken, token, organizationId) {
  const fetch = (await import('node-fetch')).default;
  const baseURL = `https://www.eventbriteapi.com/v3/organizations/${organizationId}/events/`;
  const url = new URL(baseURL);
  const newParams = {
    ...params,
    continuation: continuationToken
  };
  url.search = new URLSearchParams(newParams).toString();

  const OPTIONS = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  try {
    const response = await fetch(url, OPTIONS);
    const data = await response.json();
    const newEvents = data.events;
    if (!data.pagination?.has_more_items) return events.concat(newEvents);
    return addPaginatedEvents(events.concat(newEvents), params, data.pagination.continuation, token, organizationId);
  } catch (e) {
    console.warn(e);
    throw e;
  }
}

async function fetchVenuesFromEventbrite(token, organizationId) {
  const baseURL = `https://www.eventbriteapi.com/v3/organizations/${organizationId}/venues/`;
  const fetch = (await import('node-fetch')).default;

  const OPTIONS = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  try {
    const response = await fetch(baseURL, OPTIONS);
    const data = await response.json();
    let venues = data.venues;
    if (data.pagination?.has_more_items) {
      venues = await addPaginatedVenues(venues, data.pagination.continuation, token, organizationId);
    }
    return venues;
  } catch (e) {
    console.warn(e);
    throw e;
  }
}

async function addPaginatedVenues(venues, continuationToken, token, organizationId) {
  const baseURL = `https://www.eventbriteapi.com/v3/organizations/${organizationId}/venues/`;
  const fetch = (await import('node-fetch')).default;
  const params = {
    continuation: continuationToken
  };
  const url = new URL(baseURL);
  url.search = new URLSearchParams(params).toString();

  const OPTIONS = {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  };

  try {
    const response = await fetch(url, OPTIONS);
    const data = await response.json();
    const newVenues = data.venues;
    if (!data.pagination?.has_more_items) return venues.concat(newVenues);
    return addPaginatedVenues(venues.concat(newVenues), data.pagination.continuation, token, organizationId);
  } catch (e) {
    console.warn(e);
    throw e;
  }
}

async function enrichEventsWithVenueData(events, venues) {
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

/**
 * Core fetch function for events - can be used by fetch-all.js or CLI
 * @param {string} outputRoot - Root output directory
 * @param {object} existingData - Existing events data to check for divergences
 * @returns {Promise<object>} - { events: [...], warnings: [...], meta: {...} }
 */
async function fetchEvents(outputRoot, existingData) {
  const warnings = [];

  try {
    const events = await fetchEventsFromEventbrite(config.EVENTBRITE_TOKEN, config.EVENTBRITE_ORGANIZATION_ID);
    const venues = await fetchVenuesFromEventbrite(config.EVENTBRITE_TOKEN, config.EVENTBRITE_ORGANIZATION_ID);
    
    await enrichEventsWithVenueData(events, venues);

    // Check for divergences if existing data provided
    if (Array.isArray(existingData)) {
      const oldCount = existingData.length;
      const newCount = events.length;
      if (oldCount !== newCount) {
        warnings.push(`[events] Record count changed from ${oldCount} to ${newCount}`);
      }
    }

    const output = {
      events: events,
      warnings: warnings,
      meta: {
        totalEvents: events.length
      }
    };

    return output;
  } catch (error) {
    console.error('[events] Error fetching events:', error.message);
    throw error;
  }
}

async function main() {
  const outputRoot = resolveOutputRoot();
  const OUTPUT_EVENTS_PATH = path.join(outputRoot, 'data', 'events.json');

  try {
    const result = await fetchEvents(outputRoot, null);
    const events = result.events;

    console.log("Nombre d'évènements : " + events.length);
    events.forEach(logEventInfo);

    fs.mkdirSync(path.dirname(OUTPUT_EVENTS_PATH), { recursive: true });
    // For backward compatibility, write just the events array (not the full result object)
    fs.writeFileSync(OUTPUT_EVENTS_PATH, JSON.stringify(events, null, 2));
    console.log(`Events written to: ${OUTPUT_EVENTS_PATH}`);
  } catch (error) {
    console.warn(error);
    process.exit(1);
  }
}

module.exports = fetchEvents;

// CLI entry point
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
