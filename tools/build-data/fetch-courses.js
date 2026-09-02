#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const { loadDotEnvIfPresent } = require('./utils');
const { CourseMapper } = require('./entity-mappers');

const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvIfPresent(repoRoot);

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_COURSES_DB_ID = process.env.NOTION_COURSES_DB_ID;

if (!NOTION_API_KEY || !NOTION_COURSES_DB_ID) {
  throw new Error('Missing NOTION_API_KEY or NOTION_COURSES_DB_ID in environment.');
}

const notion = new Client({ auth: NOTION_API_KEY });

/**
 * Core fetch function for courses - can be used by fetch-all.js or CLI
 * @param {string} outputRoot - Root output directory
 * @param {object} existingData - Existing courses data to check for divergences
 * @returns {Promise<object>} - Courses data with warnings and metadata
 */
async function fetchCourses(outputRoot, existingData) {
  const courseMapper = new CourseMapper(notion);
  const pages = await courseMapper.fetchAllPages(NOTION_COURSES_DB_ID);
  
  const courses = pages
    .map((page) => courseMapper.mapPage(page, 'default'))
    .filter(Boolean);

  const grouped = { en: [], fr: [] };
  for (const course of courses) {
    const lang = course.language || 'en';
    if (lang === 'en' || lang === 'fr') {
      grouped[lang].push(course);
    }
  }

  for (const key of Object.keys(grouped)) {
    grouped[key].sort((left, right) => left.name.localeCompare(right.name));
  }

  const warnings = courseMapper.getWarnings();

  // Check for divergences if existing data provided
  if (existingData?.courses) {
    for (const lang of ['en', 'fr']) {
      const oldCount = existingData.courses[lang]?.length || 0;
      const newCount = grouped[lang].length;
      if (oldCount !== newCount) {
        warnings.push(`[courses][${lang}] Record count changed from ${oldCount} to ${newCount}`);
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    courses: grouped,
    warnings,
    meta: {
      totalRecords: courses.length,
      enRecords: grouped.en.length,
      frRecords: grouped.fr.length
    }
  };

  return output;
}

async function main() {
  const outputRoot = resolveOutputRoot();
  const output = await fetchCourses(outputRoot, null);

  const OUTPUT_COURSES_PATH = path.join(outputRoot, 'data', 'courses.json');
  fs.mkdirSync(path.dirname(OUTPUT_COURSES_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_COURSES_PATH, JSON.stringify(output, null, 2));

  console.log(`[courses] Records fetched: ${output.meta.totalRecords}`);
  console.log(`[courses] EN records: ${output.meta.enRecords}`);
  console.log(`[courses] FR records: ${output.meta.frRecords}`);
  for (const warning of output.warnings) {
    console.warn(`[courses] WARNING: ${warning}`);
  }
  console.log(`[courses] Data written to: ${OUTPUT_COURSES_PATH}`);
}

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

module.exports = fetchCourses;

// CLI entry point
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
