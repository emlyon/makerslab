const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('workshops-data/eventbrite-config.json', 'utf8'));
const TOKEN = config.TOKEN;
const OPTIONS = {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${TOKEN}`
  }
};

async function main() {
  // Read events.json
  const events = JSON.parse(fs.readFileSync('workshops-data/events.json', 'utf8'));
  // Generate HTML files for each event
  await buildEventsHtmlFiles(events);
  writeIndexJson(events);
}

main();

// Write an index.json file with the list of events names, summary, start and end dates in format "08/11/2024 11:20"
function writeIndexJson(events) {
  const indexFileName = 'index.json';
  const indexContent = events.map((event) => {
    // Format date to "08/11/2024 11:20", from 2024-12-06T12:30:00
    const startDate = new Date(event.start.local);
    const formatStartDate = startDate.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const endDate = new Date(event.end.local);
    const formatEndDate = endDate.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const eventDescriptionCode = `makerslab-event-${event.id}`;
    return {
      id: event.id,
      name: event.name.text,
      summary: event.summary,
      start: formatStartDate,
      end: formatEndDate,
      url: event.url,
      htmlFileName: event.htmlFileName,
      eventDescriptionCode,
      location: event.venue?.name
    };
  });
  fs.writeFileSync(
    path.join(`${__dirname}/makersboard-html`, indexFileName),
    JSON.stringify(indexContent, null, 2),
    'utf8'
  );
}

async function buildEventsHtmlFiles(events) {
  for (const event of events) {
    // Useful to debug with only one event
    // Next unless event id is 1034968989107
    // if (event.id !== '1034968989107') continue;

    console.log('Building HTML for event:', event.name.text);
    // console.log(event);
    try {
      const html = await buildEventHtml(event);
      const formatEventName = event.name.text.toLowerCase().replace(/\s/g, '-');
      const fileName = `${event.id}-${formatEventName}.html`;
      const filePath = path.join(`${__dirname}/makersboard-html`, fileName);
      fs.writeFileSync(filePath, html, 'utf8');
      event.htmlFileName = fileName;
    } catch (error) {
      console.error('Error building HTML for event:', event.name.text);
      console.error(error);
    }
  }
}

async function buildEventHtml(event) {
  let htmlDescription = await fetchEventDescription(event);
  let splitCta = `<p class="hide-mobile"><strong>Registering through Eventbrite is mandatory</strong> <span class="hide-mobile">⬇️</span></p>`;
  splitCta += buildEventCta(event, 'hide-mobile');
  // Remove the content of the first div
  htmlDescription = htmlDescription.replace(/<div>.*?<\/div>/, '');
  // Place the splitCta content before the first div containing an image, within previous div to use same margins
  htmlDescription = htmlDescription.replace(/(<\/div><div[^>]*>\s*<img[^>]*>)/, `${splitCta}$1`);
  // Replace image src with event logo url
  htmlDescription = htmlDescription.replace(/(<img[^>]*src=")[^"]*"/, `$1${event.logo.url}"`);

  htmlDescription = htmlDescription.replace(
    'makerslab@em-lyon.com',
    '<a href="mailto:makerslab@em-lyon.com">makerslab@em-lyon.com</a>'
  );

  let html = HTML_STYLE;
  // Add html return to line, only for code visualization
  // Uncomment line breaks to make the generated HTML more readable
  // Once pasted, they are turned into <br> tags, so they must be removed for export
  // The first 2 line breaks enable makersboard system to take style tag into account
  html += '\n';
  html += '\n';

  html += '<div class="makersLabEvent">';
  // html += '\n';
  html += buildEventCta(event, 'mobile-only');
  // html += '\n';
  html += htmlDescription;
  // html += '\n';
  html += buildEventCta(event);
  // html += '\n';
  html += '</div>';

  return html;
}

async function fetchEventDescription(event) {
  const fetch = (await import('node-fetch')).default;
  const url = new URL(`https://www.eventbriteapi.com/v3/events/${event.id}/description/`);
  try {
    const response = await fetch(url, OPTIONS);
    const data = await response.json();
    return data.description;
  } catch (error) {
    console.error('Error fetching event description:', error);
    throw error;
  }
}

function buildEventCta(event, className) {
  return `<div class="text-center ${className}"><a href="${event.url}" class="cta-button" target="_blank" rel="noopener">Register here</a></div>`;
}

const HTML_STYLE = `<style>
  .makersLabEvent .text-center {
    text-align: center;
  }
  .makersLabEvent .cta-button {
    background-color: #e2001a !important;
    color: #fff !important;
    border: none !important;
    border-radius: 2px !important;
    display: inline-block !important;
    height: 36px !important;
    line-height: 36px !important;
    padding: 0 16px !important;
    text-transform: uppercase !important;
    font-family: sans-serif !important;
    vertical-align: middle !important;
  }

  @media (max-width: 767px) {
    .makersLabEvent .hide-mobile {
      display: none;
    }
  }

  @media (min-width: 768px) {
    .makersLabEvent .mobile-only {
      display: none;
    }
  }
</style>`;
