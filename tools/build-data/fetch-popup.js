#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const { fetchAllPages, getPlainTextFromProperty, getRichTextAsHtml, loadDotEnvIfPresent } = require('./notion-utils');

const repoRoot = path.resolve(__dirname, '../..');
const OUTPUT_ROOT = resolveOutputRoot();
const OUTPUT_POPUP_PATH = path.join(OUTPUT_ROOT, 'data', 'popup.json');

loadDotEnvIfPresent(repoRoot);

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_POPUP_DB_ID = process.env.NOTION_POPUP_DB_ID;

if (!NOTION_API_KEY || !NOTION_POPUP_DB_ID) {
  throw new Error('Missing NOTION_API_KEY or NOTION_POPUP_DB_ID in environment.');
}

const notion = new Client({ auth: NOTION_API_KEY });

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

function getDateFromProperty(property, key) {
  if (!property || property.type !== 'date' || !property.date || !property.date[key]) {
    return null;
  }

  const date = new Date(property.date[key]);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function normalizeToUtcDayStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function mapPopupRecord(page) {
  const properties = page.properties || {};
  const startsOnDate = getDateFromProperty(properties['starts-on'], 'start');
  const endsOnDate = getDateFromProperty(properties['ends-on'], 'start') || startsOnDate;

  return {
    id: page.id,
    titleFr: getPlainTextFromProperty(properties['title fr']),
    contentFr: getRichTextAsHtml(properties['content fr']?.rich_text),
    titleEn: getPlainTextFromProperty(properties['title en']),
    contentEn: getRichTextAsHtml(properties['content en']?.rich_text),
    startsOn: startsOnDate ? toIsoDate(startsOnDate) : null,
    endsOn: endsOnDate ? toIsoDate(endsOnDate) : null,
    startsOnEpoch: startsOnDate ? normalizeToUtcDayStart(startsOnDate).getTime() : Number.POSITIVE_INFINITY,
    endsOnEpoch: endsOnDate ? normalizeToUtcDayStart(endsOnDate).getTime() : Number.NEGATIVE_INFINITY
  };
}

function isActivePopup(popup, todayUtcEpoch) {
  return popup.startsOnEpoch <= todayUtcEpoch && todayUtcEpoch <= popup.endsOnEpoch;
}

function choosePopup(activePopups) {
  const sorted = [...activePopups].sort((left, right) => {
    if (left.endsOnEpoch !== right.endsOnEpoch) {
      return left.endsOnEpoch - right.endsOnEpoch;
    }

    if (left.startsOnEpoch !== right.startsOnEpoch) {
      return left.startsOnEpoch - right.startsOnEpoch;
    }

    return left.id.localeCompare(right.id);
  });

  return sorted[0] || null;
}

function formatWarning(activePopups, selected) {
  const list = activePopups.map((popup) => `${popup.id} (${popup.startsOn} -> ${popup.endsOn})`).join(', ');
  return `Multiple active popups detected (${activePopups.length}). Selected ${selected.id} (${selected.startsOn} -> ${selected.endsOn}) by priority rule. Active candidates: ${list}`;
}

function buildOutput(popups) {
  const todayUtc = normalizeToUtcDayStart(new Date());
  const todayUtcEpoch = todayUtc.getTime();

  const candidates = popups.filter((popup) => popup.startsOn && popup.endsOn);
  const activePopups = candidates.filter((popup) => isActivePopup(popup, todayUtcEpoch));
  const selected = choosePopup(activePopups);

  const warnings = [];
  if (activePopups.length > 1 && selected) {
    warnings.push(formatWarning(activePopups, selected));
  }

  return {
    generatedAt: new Date().toISOString(),
    active: Boolean(selected),
    popup: selected
      ? {
          id: selected.id,
          startsOn: selected.startsOn,
          endsOn: selected.endsOn,
          titleFr: selected.titleFr,
          contentFr: selected.contentFr,
          titleEn: selected.titleEn,
          contentEn: selected.contentEn
        }
      : null,
    warnings,
    meta: {
      totalRecords: popups.length,
      eligibleRecords: candidates.length,
      activeRecords: activePopups.length
    }
  };
}

async function main() {
  const pages = await fetchAllPages(notion, NOTION_POPUP_DB_ID);
  const popups = pages.map(mapPopupRecord);
  const output = buildOutput(popups);

  fs.mkdirSync(path.dirname(OUTPUT_POPUP_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_POPUP_PATH, JSON.stringify(output, null, 2));

  console.log(`[popup] Records fetched: ${output.meta.totalRecords}`);
  console.log(`[popup] Active records: ${output.meta.activeRecords}`);
  if (output.popup) {
    console.log(`[popup] Selected popup: ${output.popup.id} (${output.popup.startsOn} -> ${output.popup.endsOn})`);
  } else {
    console.log('[popup] No active popup for current date.');
  }

  for (const warning of output.warnings) {
    console.warn(`[popup] WARNING: ${warning}`);
  }

  console.log(`[popup] Data written to: ${OUTPUT_POPUP_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
