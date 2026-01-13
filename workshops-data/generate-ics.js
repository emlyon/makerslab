#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Unescape HTML entities
 */
function unescapeHtmlEntities(text) {
  const entityMap = {
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#39;': "'",
    '&nbsp;': ' '
  };

  return text.replace(/&(?:[a-z\d]+|#\d+|#x[a-f\d]+);/gi, (entity) => {
    return entityMap[entity] || entity;
  });
}

/**
 * Convert DateTime to ICS format (YYYYMMDDTHHMMSSZ)
 */
function toIcsDateTime(dateObj) {
  if (typeof dateObj === 'string') {
    dateObj = new Date(dateObj);
  }

  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const hours = String(dateObj.getUTCHours()).padStart(2, '0');
  const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape special characters in ICS text fields
 */
function escapeIcsText(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Generate a unique UID for the event
 */
function generateUid(eventId) {
  return `makerslab-event-${eventId}@em-lyon.com`;
}

/**
 * Create an ICS VEVENT component
 */
function createVevent(occurrence, location = "makers' lab") {
  const title = unescapeHtmlEntities(occurrence.name.html);
  const description = unescapeHtmlEntities(occurrence.description.html);
  const adminUrl = `https://www.eventbrite.fr/myevent?eid=${occurrence.id}`;
  const descriptionWithLinks = description 
    ? `${description}\n\n${occurrence.url}\n\nAdmin: ${adminUrl}` 
    : `${occurrence.url}\n\nAdmin: ${adminUrl}`;
  
  const startTime = toIcsDateTime(occurrence.start.utc);
  const endTime = toIcsDateTime(occurrence.end.utc);
  
  const uid = generateUid(occurrence.id);
  const dtstamp = toIcsDateTime(new Date());

  const vevent = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${startTime}`,
    `DTEND:${endTime}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(descriptionWithLinks)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `CATEGORIES:Workshop`,
    `STATUS:CONFIRMED`,
    `SEQUENCE:0`,
    'END:VEVENT'
  ];

  return vevent.join('\r\n');
}

/**
 * Determine city from venue name
 */
function getCityFromVenue(event) {
  const venueName = event.venue?.name?.toLowerCase() || '';
  if (venueName.includes('paris')) {
    return 'paris';
  } else if (venueName.includes('lyon')) {
    return 'lyon';
  }
  return null;
}

/**
 * Generate ICS content from events array
 */
function generateIcsContent(events, calendarName) {
  // Build ICS header
  const icsHeader = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Makers Lab//Workshops Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-TIMEZONE:UTC',
    'BEGIN:VTIMEZONE',
    'TZID:UTC',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0000',
    'TZOFFSETTO:+0000',
    'DTSTART:19700101T000000Z',
    'TZNAME:UTC',
    'END:STANDARD',
    'END:VTIMEZONE'
  ];

  // Build ICS events
  const vevents = [];
  let validCount = 0;
  let skippedCount = 0;

  for (const occurrence of events) {
    try {
      // Validate required fields
      if (!occurrence.name?.html || !occurrence.start?.utc || !occurrence.end?.utc) {
        skippedCount++;
        continue;
      }

      // Determine location based on venue
      const city = getCityFromVenue(occurrence);
      const location = city ? `makers' lab ${city.toUpperCase()}` : "makers' lab";

      vevents.push(createVevent(occurrence, location));
      validCount++;
    } catch (error) {
      console.warn(`⚠️  Error processing event: ${error.message}`);
      skippedCount++;
    }
  }

  // Build ICS footer
  const icsFooter = ['END:VCALENDAR'];

  // Combine all parts
  const icsContent = [
    ...icsHeader,
    '',
    ...vevents,
    '',
    ...icsFooter
  ].join('\r\n');

  return { icsContent, validCount, skippedCount };
}

/**
 * Main function to generate ICS file
 */
function generateIcsFile() {
  try {
    // Read events.json
    const eventsPath = path.join(__dirname, 'events.json');
    if (!fs.existsSync(eventsPath)) {
      console.error('❌ events.json not found');
      process.exit(1);
    }

    const eventsData = fs.readFileSync(eventsPath, 'utf-8');
    const events = JSON.parse(eventsData);

    console.log(`📖 ${events.length} events loaded from events.json`);

    // Separate events by city
    const parisEvents = [];
    const lyonEvents = [];

    for (const event of events) {
      const city = getCityFromVenue(event);
      if (city === 'paris') {
        parisEvents.push(event);
      } else if (city === 'lyon') {
        lyonEvents.push(event);
      }
    }

    console.log(`📍 ${parisEvents.length} Paris events`);
    console.log(`📍 ${lyonEvents.length} Lyon events`);

    // Generate all workshops ICS file
    const allResult = generateIcsContent(events, 'Workshops');
    const allOutputPath = path.join(__dirname, 'workshops.ics');
    fs.writeFileSync(allOutputPath, allResult.icsContent, 'utf-8');
    console.log(`\n📅 All workshops ICS file generated: ${allOutputPath}`);
    console.log(`   ✅ ${allResult.validCount} valid events`);
    if (allResult.skippedCount > 0) {
      console.log(`   ⚠️  ${allResult.skippedCount} events skipped (missing data)`);
    }
    console.log(`   📊 File size: ${(allResult.icsContent.length / 1024).toFixed(2)} KB`);

    // Generate Paris workshops ICS file
    if (parisEvents.length > 0) {
      const parisResult = generateIcsContent(parisEvents, 'Paris Workshops');
      const parisOutputPath = path.join(__dirname, 'paris-workshops.ics');
      fs.writeFileSync(parisOutputPath, parisResult.icsContent, 'utf-8');
      console.log(`\n📅 Paris workshops ICS file generated: ${parisOutputPath}`);
      console.log(`   ✅ ${parisResult.validCount} valid events`);
      if (parisResult.skippedCount > 0) {
        console.log(`   ⚠️  ${parisResult.skippedCount} events skipped (missing data)`);
      }
      console.log(`   📊 File size: ${(parisResult.icsContent.length / 1024).toFixed(2)} KB`);
    }

    // Generate Lyon workshops ICS file
    if (lyonEvents.length > 0) {
      const lyonResult = generateIcsContent(lyonEvents, 'Lyon Workshops');
      const lyonOutputPath = path.join(__dirname, 'lyon-workshops.ics');
      fs.writeFileSync(lyonOutputPath, lyonResult.icsContent, 'utf-8');
      console.log(`\n📅 Lyon workshops ICS file generated: ${lyonOutputPath}`);
      console.log(`   ✅ ${lyonResult.validCount} valid events`);
      if (lyonResult.skippedCount > 0) {
        console.log(`   ⚠️  ${lyonResult.skippedCount} events skipped (missing data)`);
      }
      console.log(`   📊 File size: ${(lyonResult.icsContent.length / 1024).toFixed(2)} KB`);
    }
  } catch (error) {
    console.error('❌ Error generating ICS file:', error.message);
    process.exit(1);
  }
}

// Run
generateIcsFile();
