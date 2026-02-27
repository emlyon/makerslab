const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode'); // Import qrcode library
const sharp = require('sharp'); // Import sharp library for image processing

const SAVE_SVG = false; // Set to false to skip saving SVG files, only generate PNGs
const SAVE_PNG = true; // Set to false to skip saving PNG files

const outputDir = `${__dirname}/slides`;

const SVG_TEMPLATE_PATH = 'workshops-data/template_workshop_makerslab.svg';
const SVG_TEMPLATE_CONTENT = fs.readFileSync(SVG_TEMPLATE_PATH, 'utf8')
  .replace(/xlink:href="data:image\/png;base64,.*?"/, 'xlink:href="${qrCodeDataUrl}"')
  .replace(/<text class="st3" transform="translate\(1676.17 820.54\)"><tspan x="0" y="0">\${title}<\/tspan><\/text>/, '<text class="st3" text-anchor="middle" transform="translate(1903.98 700)">\${title}<\/text>')
  .replace(/<text class="st5" transform="translate\(1569.81 1365.26\)"><tspan x="0" y="0">\${description}<\/tspan><\/text>/, '<text class="st5" text-anchor="middle" transform="translate(1903.98 1150)">\${description}<\/text>');

function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    // Return array of year and week number
    return [d.getUTCFullYear(), weekNo];
}

async function main() {
  // Delete everything in the output directory if it exists
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  // Read events.json
  const rawEvents = JSON.parse(fs.readFileSync('workshops-data/events.json', 'utf8'));
  
  // Exclude events with specific titles
  const excludedTitles = [
    'Formation machine à coudre',
    'Formation brodeuse numérique',
    'Formation plotter de découpe et presse à chaud',
    'Cutting plotter and hot press training',
    'Embroidery machine training',
    'Sewing machine training'
  ];
  
  const filteredEvents = rawEvents.filter(event => 
    !excludedTitles.includes(event.name.text)
  );
  
  const events = parseEvents(filteredEvents);
  // Save events to events-${currentDate}.json
  const currentDate = new Date().toISOString().split('T')[0];
  fs.writeFileSync(`${outputDir}/events-${currentDate}.json`, JSON.stringify(events, null, 2), 'utf8');
  await buildEventsFiles(events, SAVE_SVG, SAVE_PNG); // Set to false to skip saving SVG files, only generate PNGs
  process.exit();
}

main();

// Write an index.json file with the list of events names, summary, start and end dates in format "08/11/2024 11:20"
function parseEvents(events) {
  const indexFileName = '0-index.json';
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

    const weekDay = startDate.toLocaleString('fr-FR', { weekday: 'long' });
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - startDate.getDay() + 1); // Get Monday of the week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Get Sunday of the week
    // Exemple: "semaine-9_02-mars_08-mars" without "." in "avr." and without spaces
    const weekNumber = getWeekNumber(startDate)[1];
    const first_day = weekStart.toLocaleDateString('fr-FR', { day: '2-digit' });
    const first_month = weekStart.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    const last_day = weekEnd.toLocaleDateString('fr-FR', { day: '2-digit' });
    const last_month = weekEnd.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
    const weekId = `semaine-${weekNumber}_${first_day}-${first_month}_${last_day}-${last_month}`;

    const originalName = event.name.text.replace(/@\s*makers'\s*lab\s*(lyon|paris)/gi, '').trim(); // Remove makers' lab strings
    const name = originalName
      .replace(/(by\s*)?PNP/gi, '')
      .replace(/-\s*PNP/gi, '')
      .replace(/\s*-$/gi, '')
      .trim(); // Remove "by PNP" from the name

    const cleanName = name
      .toLowerCase()
      .trim()
      .replace(/\s/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    let cleanLocation = event.venue?.name || '';
    cleanLocation = standardizeLocationName(cleanLocation); // Returns 'Lyon' or 'Paris'

    return {
      id: event.id,
      name,
      cleanName: cleanName,
      summary: event.summary,
      description: event.description.text,
      url: event.url,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      location: cleanLocation,
      weekId,
      weekDay,
      weekStart: weekStart.toLocaleDateString('fr-FR'),
      weekEnd: weekEnd.toLocaleDateString('fr-FR'),
      isPNP: /pnp/i.test(name) || /pnp/i.test(event.summary) || /pnp/i.test(event.description.text),
    };
  });
  return indexContent;
}

async function buildEventsFiles(events, saveSVG = false, savePNG = true) {
  await Promise.all(
    events.map(async (event, index) => {
      // Useful to debug with only one event
      // Next unless event id is 1034968989107
      // if (event.id !== '1034968989107') continue;

      // console.log(event);
      try {
        console.log(`Building slide for event:`, event.name, SAVE_SVG ? '(SVG)' : '', SAVE_PNG ? '(PNG)' : '');
        const svg = await buildEventSvg(event);

        const weekDirPath = path.join(outputDir, event.weekId);
        if (!fs.existsSync(weekDirPath)) {
          fs.mkdirSync(weekDirPath, { recursive: true });
        }

        // const fileStem = `${cleanedEventNameForFilename}-${locationForFilename}-${event.id}`;

        // File name should look like data-literacy-mardi-10-mars-Lyon-1034968989107.svg"
        const cleanedEventNameForFilename = event.cleanName.substring(0, 25).replace(/-$/, ''); // Limit to 25 characters and remove trailing hyphen if any
        const fileStem = `${cleanedEventNameForFilename}-${event.weekDay.toLowerCase()}-${event.weekStart.split('/').reverse().join('-')}-${event.location.toLowerCase()}-${event.id}`;
        if(saveSVG) {
          const svgFileName = `${fileStem}.svg`;
          const svgFilePath = path.join(weekDirPath, svgFileName);
          fs.writeFileSync(svgFilePath, svg, 'utf8');
        }

        if(savePNG) {
          // Convert SVG to PNG using sharp
          const pngFileName = `${fileStem}.png`;
          const pngFilePath = path.join(weekDirPath, pngFileName);
          // Convert from svg data to png file
          await sharp(Buffer.from(svg))
            .png()
            .resize(1920, 1080) // Resize to 1920x1080 pixels (standard HD resolution)
            .toFile(pngFilePath);
        }

      } catch (error) {
        console.error('Error building slide for event:', event.name);
        console.error(error);
      }
    })
  );
  console.log('All slides built successfully in', outputDir);
}

async function buildEventSvg(event) {
  let svgContent = SVG_TEMPLATE_CONTENT;

  // Generate QR code
  const qrCodeDataUrl = await qrcode.toDataURL(event.url, { errorCorrectionLevel: 'H', type: 'image/png', scale: 10 });
  svgContent = svgContent.replace('${qrCodeDataUrl}', qrCodeDataUrl);

  let cleanedTitle = event.name;
  const wrappedTitle = wrapText(escapeHtmlEntities(cleanedTitle), 2000, 140, 140); // Max width 2000px, font size 140px, dy 107.25
  svgContent = svgContent.replace('${title}', "\n" +  wrappedTitle + "\n");

  // Format date and time
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  // Date: "Friday Feb. 27th"
  const weekday = startDate.toLocaleString('en-US', { weekday: 'long' });
  const month = startDate.toLocaleString('en-US', { month: 'long' });
  const day = startDate.getDate();
  let daySuffix;
  if (day > 3 && day < 21) daySuffix = 'th';
  else {
    switch (day % 10) {
      case 1:  daySuffix = 'st'; break;
      case 2:  daySuffix = 'nd'; break;
      case 3:  daySuffix = 'rd'; break;
      default: daySuffix = 'th';
    }
  }
  const formattedDate = `${weekday} ${month} ${day}${daySuffix}`;

  // Time: "13:00 – 14:00"
  const startTime = startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const formattedTime = `${startTime} – ${endTime}`;

  svgContent = svgContent.replace('${date}', formattedDate);
  svgContent = svgContent.replace('${time}', formattedTime);

  // Replace location
  svgContent = svgContent.replace('${location}', event.location);

  // Replace description
  const wrappedDescription = wrapText(escapeHtmlEntities(event.description), 2000, 103.6, 120); // Max width 2000px, font size 103.6px, dy 90
  svgContent = svgContent.replace('${description}', "\n" + wrappedDescription + "\n");

  return svgContent;
}

function standardizeLocationName(name) {
  name = name.replace(/emlyon LYON/gi, 'Lyon');
  name = name.replace(/emlyon PARIS/gi, 'Paris');
  return name;
}

function escapeHtmlEntities(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper function to wrap text
function wrapText(text, maxWidth, fontSize, dy) {
  const words = text.split(' ');
  let line = '';
  let tspan = '';
  const lines = [];

  // Simple estimation: assume average character width is fontSize / 2
  const maxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.5));

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    // Crude character count for wrapping
    if (testLine.length > maxCharsPerLine && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  lines.forEach((l, i) => {
    tspan += `<tspan x="0" y="${i * dy}">${l}</tspan>\n`;
  });
  return tspan;
}