#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const { loadDotEnvIfPresent } = require('./utils');
const { TutorialMapper, SoftwareMapper, CourseMapper } = require('./entity-mappers');
const RelationshipReconciler = require('./relationship-reconciler');
const { downloadAndCacheImages } = require('./image-downloader');

const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvIfPresent(repoRoot);

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const LANGUAGE_DB_CONFIG = {
  en: {
    tutorialsDbId: process.env.NOTION_TUTORIALS_EN_DB_ID,
    softwareDbId: process.env.NOTION_SOFTWARE_EN_DB_ID
  },
  fr: {
    tutorialsDbId: process.env.NOTION_TUTORIALS_FR_DB_ID,
    softwareDbId: process.env.NOTION_SOFTWARE_FR_DB_ID
  }
};
const NOTION_COURSES_DB_ID = process.env.NOTION_COURSES_DB_ID;

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

async function loadCategoriesFromFile(outputRoot, language) {
  try {
    const categoriesPath = path.join(outputRoot, 'data', 'categories.json');
    if (!fs.existsSync(categoriesPath)) {
      console.warn(`[tutorials] Categories file not found at ${categoriesPath}. Run fetch:categories first.`);
      return [];
    }
    const data = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    return Array.isArray(data.categories?.[language]) ? data.categories[language] : [];
  } catch (error) {
    console.warn(`[tutorials] Failed to load categories from file: ${error.message}`);
    return [];
  }
}

function loadEquipmentFromFile(outputRoot, language) {
  try {
    const equipmentPath = path.join(outputRoot, 'data', 'equipment.json');
    if (!fs.existsSync(equipmentPath)) {
      console.warn(`[tutorials] Equipment file not found at ${equipmentPath}. Run fetch:equipment first.`);
      return [];
    }
    const data = JSON.parse(fs.readFileSync(equipmentPath, 'utf8'));
    return Array.isArray(data.equipment?.[language]?.equipment) ? data.equipment[language].equipment : [];
  } catch (error) {
    console.warn(`[tutorials] Failed to load equipment from file: ${error.message}`);
    return [];
  }
}

async function fetchLanguageData(outputRoot, language, ids, categoriesForLanguage) {
  const tutorialMapper = new TutorialMapper(notion);
  const softwareMapper = new SoftwareMapper(notion);

  const [tutorialPages, softwarePages] = await Promise.all([
    tutorialMapper.fetchAllPages(ids.tutorialsDbId),
    softwareMapper.fetchAllPages(ids.softwareDbId)
  ]);

  const tutorials = tutorialPages
    .map((page) => tutorialMapper.mapPage(page, language))
    .filter(Boolean)
    .filter((tutorial) => tutorial.language === language && tutorial.published);

  const software = softwarePages
    .map((page) => softwareMapper.mapPage(page, language))
    .filter(Boolean)
    .filter((softwareItem) => softwareItem.language === language);

  let categories = categoriesForLanguage;
  if (!categories) {
    categories = await loadCategoriesFromFile(outputRoot, language);
  }

  const tutorials_sorted = tutorialMapper.sortRecords(tutorials);
  const software_sorted = softwareMapper.sortRecords(software);

  return {
    tutorials: tutorials_sorted,
    software: software_sorted,
    categories: categories,
    warnings: [...tutorialMapper.getWarnings(), ...softwareMapper.getWarnings()],
    sourceMeta: {
      tutorialsRecords: tutorialPages.length,
      softwareRecords: softwarePages.length,
      categoriesRecords: categories.length
    }
  };
}

/**
 * Core fetch function for tutorials - can be used by fetch-all.js or CLI
 * @param {string} outputRoot - Root output directory
 * @param {object} existingData - Existing tutorials data to check for divergences
 * @param {object} categoriesData - Optional pre-fetched categories data to avoid disk I/O during fetch-all
 * @returns {Promise<object>} - Tutorials data with warnings and metadata (without relationship reconciliation)
 */
async function fetchTutorials(outputRoot, existingData, categoriesData) {
  const perLanguageData = { en: {}, fr: {} };
  const allWarnings = [];
  const coursesPages = NOTION_COURSES_DB_ID ? 
    await new CourseMapper(notion).fetchAllPages(NOTION_COURSES_DB_ID) : [];

  for (const [language, ids] of Object.entries(LANGUAGE_DB_CONFIG)) {
    const categoriesForLanguage = categoriesData?.categories?.[language];
    const { tutorials, software, categories, warnings, sourceMeta } = await fetchLanguageData(outputRoot, language, ids, categoriesForLanguage);
    
    let courses = [];
    if (coursesPages.length > 0) {
      const courseMapper = new CourseMapper(notion);
      courses = coursesPages
        .map((page) => courseMapper.mapPage(page, language))
        .filter(Boolean)
        .filter((course) => course.language === language);
      courses = courseMapper.sortRecords(courses);
    }

    perLanguageData[language] = { tutorials, software, courses, categories };
    allWarnings.push(...warnings);

    // Check for divergences if existing data provided
    if (existingData?.tutorials?.[language]) {
      const oldTutCount = existingData.tutorials[language].tutorials?.length || 0;
      const newTutCount = tutorials.length;
      if (oldTutCount !== newTutCount) {
        allWarnings.push(`[tutorials][${language}] Tutorial count changed from ${oldTutCount} to ${newTutCount}`);
      }

      const oldSoftCount = existingData.tutorials[language].software?.length || 0;
      const newSoftCount = software.length;
      if (oldSoftCount !== newSoftCount) {
        allWarnings.push(`[tutorials][${language}] Software count changed from ${oldSoftCount} to ${newSoftCount}`);
      }
    }
  }

  // Download and cache images for each language
  if (process.env.NODE_ENV !== 'test') {
    console.log('[tutorials] Downloading and caching images...');
  }
  
  for (const language of ['en', 'fr']) {
    const languageData = perLanguageData[language];
    if (!languageData || !Array.isArray(languageData.tutorials)) {
      continue;
    }

    const { records: processedRecords, warnings: imageWarnings } = await downloadAndCacheImages(
      languageData.tutorials,
      ['iconUrl'],
      'tutorials',
      outputRoot
    );

    perLanguageData[language].tutorials = processedRecords;
    allWarnings.push(...imageWarnings);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    tutorials: perLanguageData,
    warnings: allWarnings,
    meta: {
      en: {
        published: {
          tutorials: perLanguageData.en.tutorials.length,
          software: perLanguageData.en.software.length,
          courses: perLanguageData.en.courses.length,
          categories: perLanguageData.en.categories.length
        }
      },
      fr: {
        published: {
          tutorials: perLanguageData.fr.tutorials.length,
          software: perLanguageData.fr.software.length,
          courses: perLanguageData.fr.courses.length,
          categories: perLanguageData.fr.categories.length
        }
      }
    }
  };

  return output;
}

async function main() {
  const outputRoot = resolveOutputRoot();
  const output = await fetchTutorials(outputRoot, null);

  // Apply relationship reconciliation for CLI usage
  const reconciler = new RelationshipReconciler();
  for (const language of ['en', 'fr']) {
    const equipment = loadEquipmentFromFile(outputRoot, language);
    reconciler.reconcileTutorialRelationships(
      {
        tutorials: output.tutorials[language].tutorials,
        equipment: equipment,
        categories: output.tutorials[language].categories,
        software: output.tutorials[language].software,
        courses: output.tutorials[language].courses
      },
      language
    );
  }
  output.warnings.push(...reconciler.getWarnings());

  const OUTPUT_TUTORIALS_PATH = path.join(outputRoot, 'data', 'tutorials.json');
  fs.mkdirSync(path.dirname(OUTPUT_TUTORIALS_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_TUTORIALS_PATH, JSON.stringify(output, null, 2));

  console.log(`[tutorials] EN tutorials: ${output.meta.en.published.tutorials}`);
  console.log(`[tutorials] EN software: ${output.meta.en.published.software}`);
  console.log(`[tutorials] EN courses: ${output.meta.en.published.courses}`);
  console.log(`[tutorials] EN categories: ${output.meta.en.published.categories}`);
  console.log(`[tutorials] FR tutorials: ${output.meta.fr.published.tutorials}`);
  console.log(`[tutorials] FR software: ${output.meta.fr.published.software}`);
  console.log(`[tutorials] FR courses: ${output.meta.fr.published.courses}`);
  console.log(`[tutorials] FR categories: ${output.meta.fr.published.categories}`);
  for (const warning of output.warnings) {
    console.warn(`[tutorials] WARNING: ${warning}`);
  }
  console.log(`[tutorials] Data written to: ${OUTPUT_TUTORIALS_PATH}`);
}

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

module.exports = fetchTutorials;

// CLI entry point
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}