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

function normalizeEvents(events) {
  return events
    .map((event) => sortObjectKeys(event))
    .sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
}

function hashValue(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function indexById(events) {
  const map = new Map();
  for (const event of events) {
    map.set(String(event.id), event);
  }
  return map;
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
    `added=${summary.added}`,
    `removed=${summary.removed}`,
    `modified=${summary.modified}`,
    `new_hash=${summary.newHash}`,
    `current_hash=${summary.currentHash}`
  ];

  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`);
}

function getDefaultCurrentUrl() {
  const repoRoot = path.resolve(__dirname, '..');
  const cnamePath = path.join(repoRoot, 'CNAME');
  if (!fs.existsSync(cnamePath)) {
    return undefined;
  }

  const domain = fs.readFileSync(cnamePath, 'utf8').trim();
  if (!domain) {
    return undefined;
  }

  return `https://${domain}/workshops-data/events.json`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const newFile = args['new-file'];
  const currentFile = args['current-file'];
  const currentUrl = args['current-url'] || getDefaultCurrentUrl();

  if (!newFile) {
    throw new Error('Missing required argument --new-file=path/to/events.json');
  }

  const newEventsPath = path.resolve(newFile);
  const newEvents = loadJsonFromFile(newEventsPath);
  const normalizedNewEvents = normalizeEvents(newEvents);

  let currentEvents = null;
  let currentSource = 'none';

  try {
    if (currentFile) {
      currentEvents = loadJsonFromFile(path.resolve(currentFile));
      currentSource = 'file';
    } else if (currentUrl) {
      currentEvents = await loadJsonFromUrl(currentUrl);
      currentSource = 'url';
    }
  } catch (error) {
    console.warn(`Unable to load current events snapshot (${error.message}). Will force deploy.`);
  }

  if (!currentEvents) {
    const summary = {
      changed: true,
      added: normalizedNewEvents.length,
      removed: 0,
      modified: 0,
      newHash: hashValue(normalizedNewEvents),
      currentHash: 'none'
    };

    emitGithubOutput(summary);
    console.log(JSON.stringify({ ...summary, source: currentSource }, null, 2));
    return;
  }

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
  const changed = newHash !== currentHash;

  const summary = {
    changed,
    added,
    removed,
    modified,
    newHash,
    currentHash
  };

  emitGithubOutput(summary);
  console.log(JSON.stringify({ ...summary, source: currentSource }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
