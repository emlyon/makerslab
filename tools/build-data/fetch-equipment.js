#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const { loadDotEnvIfPresent } = require('./utils');
const { EquipmentMapper } = require('./entity-mappers');
const RelationshipReconciler = require('./relationship-reconciler');

const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvIfPresent(repoRoot);

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const LANGUAGE_DB_CONFIG = {
  en: {
    equipmentDbId: process.env.NOTION_EQUIPMENT_EN_DB_ID
  },
  fr: {
    equipmentDbId: process.env.NOTION_EQUIPEMENTS_FR_DB_ID
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

async function loadCategoriesFromFile(outputRoot, language) {
  try {
    const categoriesPath = path.join(outputRoot, 'data', 'categories.json');
    if (!fs.existsSync(categoriesPath)) {
      console.warn(`[equipment] Categories file not found at ${categoriesPath}. Run fetch:categories first.`);
      return [];
    }
    const data = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    return Array.isArray(data.categories?.[language]) ? data.categories[language] : [];
  } catch (error) {
    console.warn(`[equipment] Failed to load categories from file: ${error.message}`);
    return [];
  }
}

async function fetchLanguageData(outputRoot, language, ids) {
  const equipmentMapper = new EquipmentMapper(notion);

  const equipmentPages = await equipmentMapper.fetchAllPages(ids.equipmentDbId);

  const equipment = equipmentPages
    .map((page) => equipmentMapper.mapPage(page, language))
    .filter(Boolean);

  const categories = await loadCategoriesFromFile(outputRoot, language);

  const equipment_sorted = equipmentMapper.sortRecords(equipment);

  return {
    equipment: equipment_sorted,
    categories: categories,
    warnings: equipmentMapper.getWarnings(),
    sourceMeta: {
      equipmentRecords: equipmentPages.length,
      categoriesRecords: categories.length
    }
  };
}

/**
 * Core fetch function for equipment - can be used by fetch-all.js or CLI
 * @param {string} outputRoot - Root output directory
 * @param {object} existingData - Existing equipment data to check for divergences
 * @returns {Promise<object>} - Equipment data with warnings and metadata (without relationship reconciliation)
 */
async function fetchEquipment(outputRoot, existingData) {
  const perLanguageData = { en: {}, fr: {} };
  const allWarnings = [];

  for (const [language, ids] of Object.entries(LANGUAGE_DB_CONFIG)) {
    const { equipment, categories, warnings } = await fetchLanguageData(outputRoot, language, ids);
    perLanguageData[language] = { equipment, categories };
    allWarnings.push(...warnings);

    // Check for divergences if existing data provided
    if (existingData?.equipment?.[language]) {
      const oldCount = existingData.equipment[language].equipment?.length || 0;
      const newCount = equipment.length;
      if (oldCount !== newCount) {
        allWarnings.push(`[equipment][${language}] Record count changed from ${oldCount} to ${newCount}`);
      }
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    equipment: perLanguageData,
    warnings: allWarnings,
    meta: {
      en: {
        equipment: perLanguageData.en.equipment.length,
        categories: perLanguageData.en.categories.length
      },
      fr: {
        equipment: perLanguageData.fr.equipment.length,
        categories: perLanguageData.fr.categories.length
      }
    }
  };

  return output;
}

async function main() {
  const outputRoot = resolveOutputRoot();
  const output = await fetchEquipment(outputRoot, null);

  // Apply relationship reconciliation for CLI usage
  const reconciler = new RelationshipReconciler();
  for (const language of ['en', 'fr']) {
    reconciler.reconcileEquipmentRelationships(
      {
        equipment: output.equipment[language].equipment,
        categories: output.equipment[language].categories
      },
      language
    );
  }
  output.warnings.push(...reconciler.getWarnings());

  const OUTPUT_EQUIPMENTS_PATH = path.join(outputRoot, 'data', 'equipment.json');
  fs.mkdirSync(path.dirname(OUTPUT_EQUIPMENTS_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_EQUIPMENTS_PATH, JSON.stringify(output, null, 2));

  console.log(`[equipment] EN equipment: ${output.meta.en.equipment}`);
  console.log(`[equipment] EN categories: ${output.meta.en.categories}`);
  console.log(`[equipment] FR equipment: ${output.meta.fr.equipment}`);
  console.log(`[equipment] FR categories: ${output.meta.fr.categories}`);
  for (const warning of output.warnings) {
    console.warn(`[equipment] WARNING: ${warning}`);
  }
  console.log(`[equipment] Data written to: ${OUTPUT_EQUIPMENTS_PATH}`);
}

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

module.exports = fetchEquipment;

// CLI entry point
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
