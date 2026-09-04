#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const { loadDotEnvIfPresent } = require('./utils');
const { CategoryMapper } = require('./entity-mappers');

const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvIfPresent(repoRoot);

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const LANGUAGE_DB_CONFIG = {
  en: {
    categoriesDbId: process.env.NOTION_CATEGORIES_EN_DB_ID
  },
  fr: {
    categoriesDbId: process.env.NOTION_CATEGORIES_FR_DB_ID
  }
};

if (!NOTION_API_KEY) {
  throw new Error('Missing NOTION_API_KEY in environment.');
}

validateLanguageDbConfig(LANGUAGE_DB_CONFIG);

const notion = new Client({ auth: NOTION_API_KEY });

function validateLanguageDbConfig(config) {
  const missing = [];
  for (const [language, ids] of Object.entries(config)) {
    for (const [key, value] of Object.entries(ids)) {
      if (!value) {
        missing.push(`${language}.${key}`);
      }
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing Notion database ids: ${missing.join(', ')}`);
  }
}

async function fetchLanguageData(language, ids) {
  const categoryMapper = new CategoryMapper(notion);

  const categoryPages = await categoryMapper.fetchAllPages(ids.categoriesDbId);

  const categories = categoryPages
    .map((page) => categoryMapper.mapPage(page, language))
    .filter(Boolean);

  const categories_sorted = categoryMapper.sortRecords(categories);

  return {
    categories: categories_sorted,
    warnings: categoryMapper.getWarnings(),
    sourceMeta: {
      categoriesRecords: categoryPages.length
    }
  };
}

/**
 * Core fetch function for categories - can be used by fetch-all.js or CLI
 * @param {string} outputRoot - Root output directory
 * @param {object} existingData - Existing categories data to check for divergences
 * @returns {Promise<object>} - Categories data with warnings and metadata
 */
async function fetchCategories(outputRoot, existingData) {
  const perLanguageData = { en: {}, fr: {} };
  const allWarnings = [];

  for (const [language, ids] of Object.entries(LANGUAGE_DB_CONFIG)) {
    const { categories, warnings } = await fetchLanguageData(language, ids);
    perLanguageData[language] = categories;
    allWarnings.push(...warnings);

    // Check for divergences if existing data provided
    if (existingData?.categories?.[language]) {
      const oldCount = existingData.categories[language].length;
      const newCount = categories.length;
      if (oldCount !== newCount) {
        allWarnings.push(`[categories][${language}] Record count changed from ${oldCount} to ${newCount}`);
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    categories: perLanguageData,
    warnings: allWarnings,
    meta: {
      en: {
        categories: perLanguageData.en.length
      },
      fr: {
        categories: perLanguageData.fr.length
      }
    }
  };

  return output;
}

async function main() {
  const outputRoot = resolveOutputRoot();
  const output = await fetchCategories(outputRoot, null);

  const OUTPUT_CATEGORIES_PATH = path.join(outputRoot, 'data', 'categories.json');
  fs.mkdirSync(path.dirname(OUTPUT_CATEGORIES_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_CATEGORIES_PATH, JSON.stringify(output, null, 2));

  console.log(`[categories] EN categories: ${output.meta.en.categories}`);
  console.log(`[categories] FR categories: ${output.meta.fr.categories}`);
  for (const warning of output.warnings) {
    console.warn(`[categories] WARNING: ${warning}`);
  }
  console.log(`[categories] Data written to: ${OUTPUT_CATEGORIES_PATH}`);
}

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

module.exports = fetchCategories;

// CLI entry point
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
