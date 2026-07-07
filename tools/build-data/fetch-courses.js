#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const {
  fetchAllPages,
  getMultiSelectFromProperty,
  getPlainTextFromProperty,
  getRichTextAsHtml,
  loadDotEnvIfPresent,
  normalizeHexColor
} = require('./notion-utils');

const repoRoot = path.resolve(__dirname, '../..');
const OUTPUT_ROOT = resolveOutputRoot();
const OUTPUT_COURSES_PATH = path.join(OUTPUT_ROOT, 'data', 'courses.json');

loadDotEnvIfPresent(repoRoot);

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_COURSES_DB_ID = process.env.NOTION_COURSES_DB_ID;

if (!NOTION_API_KEY || !NOTION_COURSES_DB_ID) {
  throw new Error('Missing NOTION_API_KEY or NOTION_COURSES_DB_ID in environment.');
}

const notion = new Client({ auth: NOTION_API_KEY });

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'fr' || normalized === 'french') {
    return 'fr';
  }

  if (normalized === 'en' || normalized === 'english') {
    return 'en';
  }

  return '';
}

function findPropertyByAliases(properties, aliases) {
  const entries = Object.entries(properties || {});
  const normalizedAliases = aliases.map((alias) => alias.toLowerCase());

  for (const [key, property] of entries) {
    if (normalizedAliases.includes(key.toLowerCase())) {
      return property;
    }
  }

  return null;
}

function findFirstPropertyByType(properties, type) {
  return Object.values(properties || {}).find((property) => property?.type === type) || null;
}

function isValidHexColor(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return false;
  }

  const candidate = raw.startsWith('#') ? raw : `#${raw}`;
  return /^#[0-9a-fA-F]{3}$/.test(candidate) || /^#[0-9a-fA-F]{6}$/.test(candidate);
}

function normalizeSlug(value) {
  return String(value || '').trim();
}

function mapCourseRecord(page, warnings) {
  const properties = page.properties || {};
  const nameProperty =
    findPropertyByAliases(properties, ['name', 'title', 'name en', 'name fr']) ||
    findFirstPropertyByType(properties, 'title');
  const descriptionProperty =
    findPropertyByAliases(properties, ['description', 'content', 'summary']) ||
    findFirstPropertyByType(properties, 'rich_text');
  const programsProperty = findPropertyByAliases(properties, ['programs', 'program', 'tracks']);
  const languageProperty = findPropertyByAliases(properties, ['language', 'lang']);
  const colorProperty = findPropertyByAliases(properties, ['color', 'colour']);
  const slugProperty = findPropertyByAliases(properties, ['slug']);

  const name = getPlainTextFromProperty(nameProperty);
  const description = getRichTextAsHtml(descriptionProperty?.rich_text || []);
  const programs = getMultiSelectFromProperty(programsProperty);
  const language = normalizeLanguage(getPlainTextFromProperty(languageProperty));
  const colorValue = getPlainTextFromProperty(colorProperty);
  const color = normalizeHexColor(colorValue);
  const slug = normalizeSlug(getPlainTextFromProperty(slugProperty));

  if (!name) {
    warnings.push(`Skipped ${page.id}: missing name.`);
    return null;
  }

  if (!language) {
    warnings.push(`Skipped ${page.id}: invalid language value.`);
    return null;
  }

  if (!page.url) {
    warnings.push(`Skipped ${page.id}: missing Notion page url.`);
    return null;
  }

  if (colorValue && !isValidHexColor(colorValue)) {
    warnings.push(`Color fallback used for ${page.id}: invalid color ${colorValue}.`);
  }

  return {
    id: page.id,
    slug,
    name,
    programs,
    description,
    color,
    language,
    notionUrl: page.url
  };
}

function buildOutput(courses, warnings) {
  const grouped = {
    en: [],
    fr: []
  };

  for (const course of courses) {
    grouped[course.language].push(course);
  }

  for (const key of Object.keys(grouped)) {
    grouped[key].sort((left, right) => left.name.localeCompare(right.name));
  }

  return {
    generatedAt: new Date().toISOString(),
    courses: grouped,
    warnings,
    meta: {
      totalRecords: courses.length,
      enRecords: grouped.en.length,
      frRecords: grouped.fr.length
    }
  };
}

async function main() {
  const pages = await fetchAllPages(notion, NOTION_COURSES_DB_ID);
  const warnings = [];
  const courses = pages.map((page) => mapCourseRecord(page, warnings)).filter(Boolean);
  const output = buildOutput(courses, warnings);

  fs.mkdirSync(path.dirname(OUTPUT_COURSES_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_COURSES_PATH, JSON.stringify(output, null, 2));

  console.log(`[courses] Records fetched: ${pages.length}`);
  console.log(`[courses] EN records: ${output.meta.enRecords}`);
  console.log(`[courses] FR records: ${output.meta.frRecords}`);
  for (const warning of output.warnings) {
    console.warn(`[courses] WARNING: ${warning}`);
  }
  console.log(`[courses] Data written to: ${OUTPUT_COURSES_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
