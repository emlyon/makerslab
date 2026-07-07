#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }

    const [key, value] = arg.slice(2).split('=');
    args[key] = value;
  }
  return args;
}

function sortObjectKeys(input) {
  if (Array.isArray(input)) {
    return input.map(sortObjectKeys);
  }

  if (input && typeof input === 'object') {
    const output = {};
    const keys = Object.keys(input).sort();
    for (const key of keys) {
      output[key] = sortObjectKeys(input[key]);
    }
    return output;
  }

  return input;
}

function hashValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function loadJsonFromFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function loadJsonFromUrl(url) {
  const fetchFn = global.fetch || (await import('node-fetch')).default;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading ${url}`);
  }

  return response.json();
}

function emitGithubOutput(summary) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  const lines = [
    `changed=${summary.changed}`,
    `events_changed=${summary.eventsChanged}`,
    `popup_changed=${summary.popupChanged}`,
    `courses_changed=${summary.coursesChanged}`,
    `added=${summary.added}`,
    `removed=${summary.removed}`,
    `modified=${summary.modified}`,
    `new_hash=${summary.newHash}`,
    `current_hash=${summary.currentHash}`,
    `popup_new_hash=${summary.popupNewHash}`,
    `popup_current_hash=${summary.popupCurrentHash}`,
    `courses_new_hash=${summary.coursesNewHash}`,
    `courses_current_hash=${summary.coursesCurrentHash}`
  ];

  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

function getDefaultCurrentBaseUrl() {
  const repoRoot = path.resolve(__dirname, '../..');
  const cnamePath = path.join(repoRoot, 'CNAME');
  if (!fs.existsSync(cnamePath)) {
    return undefined;
  }

  const domain = fs.readFileSync(cnamePath, 'utf8').trim();
  if (!domain) {
    return undefined;
  }

  return `https://${domain}`;
}

function normalizeEvents(events) {
  return events
    .map((event) => sortObjectKeys(event))
    .sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
}

function indexById(events) {
  const map = new Map();
  for (const event of events) {
    map.set(String(event.id), event);
  }
  return map;
}

function diffEvents(newEvents, currentEvents) {
  const normalizedNewEvents = normalizeEvents(newEvents);
  const normalizedCurrentEvents = normalizeEvents(currentEvents);

  const newMap = indexById(normalizedNewEvents);
  const currentMap = indexById(normalizedCurrentEvents);

  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const id of newMap.keys()) {
    if (!currentMap.has(id)) {
      added += 1;
    }
  }

  for (const id of currentMap.keys()) {
    if (!newMap.has(id)) {
      removed += 1;
    }
  }

  for (const [id, event] of newMap.entries()) {
    const currentEvent = currentMap.get(id);
    if (!currentEvent) {
      continue;
    }

    if (hashValue(event) !== hashValue(currentEvent)) {
      modified += 1;
    }
  }

  const newHash = hashValue(normalizedNewEvents);
  const currentHash = hashValue(normalizedCurrentEvents);

  return {
    eventsChanged: newHash !== currentHash,
    added,
    removed,
    modified,
    newHash,
    currentHash
  };
}

function normalizePopup(payload) {
  return sortObjectKeys(payload || {});
}

function defaultPopupPayload() {
  return {
    active: false,
    popup: null
  };
}

function normalizeCourses(payload) {
  const normalized = sortObjectKeys(payload || {});
  if (!normalized.courses || typeof normalized.courses !== 'object') {
    return {
      courses: {
        en: [],
        fr: []
      }
    };
  }

  const toSortedList = (list) =>
    (Array.isArray(list) ? list : [])
      .map((course) => sortObjectKeys(course))
      .sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));

  return {
    ...normalized,
    courses: {
      en: toSortedList(normalized.courses.en),
      fr: toSortedList(normalized.courses.fr)
    }
  };
}

function defaultCoursesPayload() {
  return {
    courses: {
      en: [],
      fr: []
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const newFile = args['new-file'];
  const currentFile = args['current-file'];
  const newPopupFile = args['new-popup-file'];
  const currentPopupFile = args['current-popup-file'];
  const newCoursesFile = args['new-courses-file'];
  const currentCoursesFile = args['current-courses-file'];

  if (!newFile) {
    throw new Error('Missing required argument --new-file=path/to/events.json');
  }

  const currentBaseUrl = args['current-base-url'] || getDefaultCurrentBaseUrl();
  const currentEventsUrl = args['current-url'] || (currentBaseUrl ? `${currentBaseUrl}/data/events.json` : undefined);
  const currentPopupUrl = args['current-popup-url'] || (currentBaseUrl ? `${currentBaseUrl}/data/popup.json` : undefined);
  const currentCoursesUrl =
    args['current-courses-url'] || (currentBaseUrl ? `${currentBaseUrl}/data/courses.json` : undefined);

  const newEventsPath = path.resolve(newFile);
  const newEvents = loadJsonFromFile(newEventsPath);

  const resolvedNewPopupPath = newPopupFile ? path.resolve(newPopupFile) : null;
  const newPopup =
    resolvedNewPopupPath && fs.existsSync(resolvedNewPopupPath)
      ? loadJsonFromFile(resolvedNewPopupPath)
      : defaultPopupPayload();

  const resolvedNewCoursesPath = newCoursesFile ? path.resolve(newCoursesFile) : null;
  const newCourses =
    resolvedNewCoursesPath && fs.existsSync(resolvedNewCoursesPath)
      ? loadJsonFromFile(resolvedNewCoursesPath)
      : defaultCoursesPayload();

  let currentEvents = null;
  let currentPopup = null;
  let currentCourses = null;

  try {
    if (currentFile) {
      currentEvents = loadJsonFromFile(path.resolve(currentFile));
    } else if (currentEventsUrl) {
      currentEvents = await loadJsonFromUrl(currentEventsUrl);
    }
  } catch (error) {
    console.warn(`Unable to load current events snapshot (${error.message}). Will force deploy.`);
  }

  try {
    if (currentPopupFile) {
      currentPopup = loadJsonFromFile(path.resolve(currentPopupFile));
    } else if (currentPopupUrl) {
      currentPopup = await loadJsonFromUrl(currentPopupUrl);
    }
  } catch (error) {
    console.warn(`Unable to load current popup snapshot (${error.message}). Will force popup deploy.`);
  }

  try {
    if (currentCoursesFile) {
      currentCourses = loadJsonFromFile(path.resolve(currentCoursesFile));
    } else if (currentCoursesUrl) {
      currentCourses = await loadJsonFromUrl(currentCoursesUrl);
    }
  } catch (error) {
    console.warn(`Unable to load current courses snapshot (${error.message}). Will force courses deploy.`);
  }

  if (!currentEvents) {
    const normalizedNewEvents = normalizeEvents(newEvents);
    const normalizedPopupNew = normalizePopup(newPopup);
    const normalizedPopupCurrent = normalizePopup(currentPopup || defaultPopupPayload());
    const normalizedCoursesNew = normalizeCourses(newCourses);
    const normalizedCoursesCurrent = normalizeCourses(currentCourses || defaultCoursesPayload());

    const summary = {
      changed: true,
      eventsChanged: true,
      popupChanged: hashValue(normalizedPopupNew) !== hashValue(normalizedPopupCurrent),
      coursesChanged: hashValue(normalizedCoursesNew) !== hashValue(normalizedCoursesCurrent),
      added: normalizedNewEvents.length,
      removed: 0,
      modified: 0,
      newHash: hashValue(normalizedNewEvents),
      currentHash: 'none',
      popupNewHash: hashValue(normalizedPopupNew),
      popupCurrentHash: currentPopup ? hashValue(normalizedPopupCurrent) : 'none',
      coursesNewHash: hashValue(normalizedCoursesNew),
      coursesCurrentHash: currentCourses ? hashValue(normalizedCoursesCurrent) : 'none'
    };

    emitGithubOutput(summary);
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const eventsDiff = diffEvents(newEvents, currentEvents);
  const normalizedPopupNew = normalizePopup(newPopup);
  const normalizedPopupCurrent = normalizePopup(currentPopup || defaultPopupPayload());
  const popupNewHash = hashValue(normalizedPopupNew);
  const popupCurrentHash = currentPopup ? hashValue(normalizedPopupCurrent) : 'none';
  const popupChanged = !currentPopup || popupNewHash !== popupCurrentHash;
  const normalizedCoursesNew = normalizeCourses(newCourses);
  const normalizedCoursesCurrent = normalizeCourses(currentCourses || defaultCoursesPayload());
  const coursesNewHash = hashValue(normalizedCoursesNew);
  const coursesCurrentHash = currentCourses ? hashValue(normalizedCoursesCurrent) : 'none';
  const coursesChanged = !currentCourses || coursesNewHash !== coursesCurrentHash;

  const summary = {
    changed: eventsDiff.eventsChanged || popupChanged || coursesChanged,
    eventsChanged: eventsDiff.eventsChanged,
    popupChanged,
    coursesChanged,
    added: eventsDiff.added,
    removed: eventsDiff.removed,
    modified: eventsDiff.modified,
    newHash: eventsDiff.newHash,
    currentHash: eventsDiff.currentHash,
    popupNewHash,
    popupCurrentHash,
    coursesNewHash,
    coursesCurrentHash
  };

  emitGithubOutput(summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
