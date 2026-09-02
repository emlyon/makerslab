#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const { loadDotEnvIfPresent } = require('./utils');
const { PopupMapper } = require('./entity-mappers');

const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvIfPresent(repoRoot);

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_POPUP_DB_ID = process.env.NOTION_POPUP_DB_ID;

if (!NOTION_API_KEY || !NOTION_POPUP_DB_ID) {
  throw new Error('Missing NOTION_API_KEY or NOTION_POPUP_DB_ID in environment.');
}

const notion = new Client({ auth: NOTION_API_KEY });

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

/**
 * Core fetch function for popups - can be used by fetch-all.js or CLI
 * @param {string} outputRoot - Root output directory
 * @param {object} existingData - Existing popup data to check for divergences
 * @returns {Promise<object>} - Popup data with warnings and metadata
 */
async function fetchPopup(outputRoot, existingData) {
  const popupMapper = new PopupMapper(notion);
  const pages = await popupMapper.fetchAllPages(NOTION_POPUP_DB_ID);
  const popups = pages.map((page) => popupMapper.mapPage(page)).filter(Boolean);

  const todayUtc = new Date();
  const todayUtcEpoch = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate())).getTime();

  const candidates = popups.filter((popup) => popup.startsOn && popup.endsOn);
  const activePopups = candidates.filter((popup) => isActivePopup(popup, todayUtcEpoch));
  const selected = choosePopup(activePopups);

  const warnings = [];
  if (activePopups.length > 1 && selected) {
    warnings.push(formatWarning(activePopups, selected));
  }

  // Check for divergences if existing data provided
  if (existingData?.meta) {
    const oldTotal = existingData.meta.totalRecords;
    const newTotal = popups.length;
    if (oldTotal !== newTotal) {
      warnings.push(`[popup] Total record count changed from ${oldTotal} to ${newTotal}`);
    }

    const oldActive = existingData.meta.activeRecords;
    const newActive = activePopups.length;
    if (oldActive !== newActive) {
      warnings.push(`[popup] Active record count changed from ${oldActive} to ${newActive}`);
    }
  }

  const output = {
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

  return output;
}

async function main() {
  const outputRoot = resolveOutputRoot();
  const OUTPUT_POPUP_PATH = path.join(outputRoot, 'data', 'popup.json');

  const output = await fetchPopup(outputRoot, null);

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

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

module.exports = fetchPopup;

// CLI entry point
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
