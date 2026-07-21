#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('@notionhq/client');
const {
  fetchAllPages,
  getPlainTextFromProperty,
  getRichTextAsHtml,
  loadDotEnvIfPresent,
  normalizeHexColor
} = require('./notion-utils');

const repoRoot = path.resolve(__dirname, '../..');
const OUTPUT_ROOT = resolveOutputRoot();
const OUTPUT_TUTORIALS_PATH = path.join(OUTPUT_ROOT, 'data', 'tutorials.json');

loadDotEnvIfPresent(repoRoot);

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const LANGUAGE_DB_CONFIG = {
  en: {
    tutorialsDbId: process.env.NOTION_TUTORIALS_EN_DB_ID,
    machinesDbId: process.env.NOTION_MACHINES_EN_DB_ID,
    categoriesDbId: process.env.NOTION_CATEGORIES_EN_DB_ID
  },
  fr: {
    tutorialsDbId: process.env.NOTION_TUTORIALS_FR_DB_ID,
    machinesDbId: process.env.NOTION_MACHINES_FR_DB_ID,
    categoriesDbId: process.env.NOTION_CATEGORIES_FR_DB_ID
  }
};

if (!NOTION_API_KEY) {
  throw new Error('Missing NOTION_API_KEY in environment.');
}

validateLanguageDbConfig(LANGUAGE_DB_CONFIG);

const notion = new Client({ auth: NOTION_API_KEY });

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

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

function normalizeSlug(value) {
  return String(value || '').trim();
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

function getRelationIdsFromProperty(property) {
  if (!property || property.type !== 'relation' || !Array.isArray(property.relation)) {
    return [];
  }

  return property.relation.map((item) => item.id).filter(Boolean);
}

function getCheckboxValueFromProperty(property, fallback = false) {
  if (!property || property.type !== 'checkbox') {
    return fallback;
  }

  return Boolean(property.checkbox);
}

function normalizeLanguageValue(value, fallbackLanguage) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'fr' || normalized === 'french' || normalized === 'français' || normalized === 'francais') {
    return 'fr';
  }

  if (normalized === 'en' || normalized === 'english') {
    return 'en';
  }

  return fallbackLanguage;
}

function sortAndDedupe(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
}

function mapTutorial(page, language, warnings) {
  const properties = page.properties || {};
  const nameProperty = findPropertyByAliases(properties, ['name', 'nom', 'title', 'titre']) || findFirstPropertyByType(properties, 'title');
  const slugProperty = findPropertyByAliases(properties, ['slug']);
  const descriptionProperty =
    findPropertyByAliases(properties, ['description', 'commentaire', 'comment', 'summary', 'content']) ||
    findFirstPropertyByType(properties, 'rich_text');
  const machinesProperty = findPropertyByAliases(properties, ['machines', '⚙️ machines']);
  const categoriesProperty = findPropertyByAliases(properties, ['catégories', 'categories']);
  const languageProperty = findPropertyByAliases(properties, ['language', 'lang', 'langue']);
  const activeProperty = findPropertyByAliases(properties, ['active', 'is active']);

  const name = getPlainTextFromProperty(nameProperty);
  if (!name) {
    warnings.push(`Skipped tutorial ${page.id}: missing name.`);
    return null;
  }

  if (!page.url) {
    warnings.push(`Skipped tutorial ${page.id}: missing Notion page url.`);
    return null;
  }

  return {
    id: page.id,
    slug: normalizeSlug(getPlainTextFromProperty(slugProperty)),
    name,
    description: getRichTextAsHtml(descriptionProperty?.rich_text || []),
    notionUrl: page.url,
    language: normalizeLanguageValue(getPlainTextFromProperty(languageProperty), language),
    active: getCheckboxValueFromProperty(activeProperty, true),
    machineIds: sortAndDedupe(getRelationIdsFromProperty(machinesProperty)),
    categoryIds: sortAndDedupe(getRelationIdsFromProperty(categoriesProperty))
  };
}

function mapMachine(page, language, warnings) {
  const properties = page.properties || {};
  const nameProperty = findPropertyByAliases(properties, ['name', 'nom', 'title', 'titre']) || findFirstPropertyByType(properties, 'title');
  const slugProperty = findPropertyByAliases(properties, ['slug']);
  const tutorialsProperty = findPropertyByAliases(properties, ['tutoriels', 'tutorials']);
  const categoriesProperty = findPropertyByAliases(properties, ['catégories', 'categories']);
  const languageProperty = findPropertyByAliases(properties, ['language', 'lang', 'langue']);

  const name = getPlainTextFromProperty(nameProperty);
  if (!name) {
    warnings.push(`Skipped machine ${page.id}: missing name.`);
    return null;
  }

  return {
    id: page.id,
    slug: normalizeSlug(getPlainTextFromProperty(slugProperty)),
    name,
    language: normalizeLanguageValue(getPlainTextFromProperty(languageProperty), language),
    tutorialIds: sortAndDedupe(getRelationIdsFromProperty(tutorialsProperty)),
    categoryIds: sortAndDedupe(getRelationIdsFromProperty(categoriesProperty))
  };
}

function mapCategory(page, language, warnings) {
  const properties = page.properties || {};
  const nameProperty = findPropertyByAliases(properties, ['name', 'nom', 'title', 'titre']) || findFirstPropertyByType(properties, 'title');
  const slugProperty = findPropertyByAliases(properties, ['slug']);
  const colorProperty = findPropertyByAliases(properties, ['color', 'colour']);
  const tutorialsProperty = findPropertyByAliases(properties, ['tutoriels', 'tutorials', '🔌 tutoriels']);
  const machinesProperty = findPropertyByAliases(properties, ['machines', '⚙️ machines']);
  const languageProperty = findPropertyByAliases(properties, ['language', 'lang', 'langue']);

  const name = getPlainTextFromProperty(nameProperty);
  if (!name) {
    warnings.push(`Skipped category ${page.id}: missing name.`);
    return null;
  }

  return {
    id: page.id,
    slug: normalizeSlug(getPlainTextFromProperty(slugProperty)),
    name,
    color: normalizeHexColor(getPlainTextFromProperty(colorProperty)),
    language: normalizeLanguageValue(getPlainTextFromProperty(languageProperty), language),
    tutorialIds: sortAndDedupe(getRelationIdsFromProperty(tutorialsProperty)),
    machineIds: sortAndDedupe(getRelationIdsFromProperty(machinesProperty))
  };
}

function mapById(records) {
  return new Map(records.map((record) => [record.id, record]));
}

function pushLink(linksMap, sourceId, targetId) {
  if (!linksMap.has(sourceId)) {
    linksMap.set(sourceId, new Set());
  }

  linksMap.get(sourceId).add(targetId);
}

function reconcileRelationships(languageData, language, warnings) {
  const tutorialsById = mapById(languageData.tutorials);
  const machinesById = mapById(languageData.machines);
  const categoriesById = mapById(languageData.categories);

  const tutorialMachineLinks = new Map();
  const tutorialCategoryLinks = new Map();
  const machineCategoryLinks = new Map();

  for (const tutorial of languageData.tutorials) {
    for (const machineId of tutorial.machineIds) {
      if (!machinesById.has(machineId)) {
        warnings.push(`[${language}] Tutorial ${tutorial.id} references missing machine ${machineId}.`);
        continue;
      }
      pushLink(tutorialMachineLinks, tutorial.id, machineId);
    }

    for (const categoryId of tutorial.categoryIds) {
      if (!categoriesById.has(categoryId)) {
        warnings.push(`[${language}] Tutorial ${tutorial.id} references missing category ${categoryId}.`);
        continue;
      }
      pushLink(tutorialCategoryLinks, tutorial.id, categoryId);
    }
  }

  for (const machine of languageData.machines) {
    for (const tutorialId of machine.tutorialIds) {
      if (!tutorialsById.has(tutorialId)) {
        warnings.push(`[${language}] Machine ${machine.id} references missing tutorial ${tutorialId}.`);
        continue;
      }
      pushLink(tutorialMachineLinks, tutorialId, machine.id);
    }

    for (const categoryId of machine.categoryIds) {
      if (!categoriesById.has(categoryId)) {
        warnings.push(`[${language}] Machine ${machine.id} references missing category ${categoryId}.`);
        continue;
      }
      pushLink(machineCategoryLinks, machine.id, categoryId);
    }
  }

  for (const category of languageData.categories) {
    for (const tutorialId of category.tutorialIds) {
      if (!tutorialsById.has(tutorialId)) {
        warnings.push(`[${language}] Category ${category.id} references missing tutorial ${tutorialId}.`);
        continue;
      }
      pushLink(tutorialCategoryLinks, tutorialId, category.id);
    }

    for (const machineId of category.machineIds) {
      if (!machinesById.has(machineId)) {
        warnings.push(`[${language}] Category ${category.id} references missing machine ${machineId}.`);
        continue;
      }
      pushLink(machineCategoryLinks, machineId, category.id);
    }
  }

  for (const tutorial of languageData.tutorials) {
    tutorial.machineIds = sortAndDedupe([...(tutorialMachineLinks.get(tutorial.id) || [])]);
    tutorial.categoryIds = sortAndDedupe([...(tutorialCategoryLinks.get(tutorial.id) || [])]);
  }

  for (const machine of languageData.machines) {
    const tutorialIds = [];
    for (const tutorial of languageData.tutorials) {
      if (tutorial.machineIds.includes(machine.id)) {
        tutorialIds.push(tutorial.id);
      }
    }
    machine.tutorialIds = sortAndDedupe(tutorialIds);
    machine.categoryIds = sortAndDedupe([...(machineCategoryLinks.get(machine.id) || [])]);
  }

  for (const category of languageData.categories) {
    const tutorialIds = [];
    const machineIds = [];
    for (const tutorial of languageData.tutorials) {
      if (tutorial.categoryIds.includes(category.id)) {
        tutorialIds.push(tutorial.id);
      }
    }
    for (const machine of languageData.machines) {
      if (machine.categoryIds.includes(category.id)) {
        machineIds.push(machine.id);
      }
    }

    category.tutorialIds = sortAndDedupe(tutorialIds);
    category.machineIds = sortAndDedupe(machineIds);
  }
}

function sortRecords(records) {
  return [...records].sort((left, right) => left.name.localeCompare(right.name));
}

async function fetchLanguageData(language, ids, warnings) {
  const [tutorialPages, machinePages, categoryPages] = await Promise.all([
    fetchAllPages(notion, ids.tutorialsDbId),
    fetchAllPages(notion, ids.machinesDbId),
    fetchAllPages(notion, ids.categoriesDbId)
  ]);

  const tutorials = tutorialPages
    .map((page) => mapTutorial(page, language, warnings))
    .filter(Boolean)
    .filter((tutorial) => tutorial.language === language && tutorial.active);
  const machines = machinePages
    .map((page) => mapMachine(page, language, warnings))
    .filter(Boolean)
    .filter((machine) => machine.language === language);
  const categories = categoryPages
    .map((page) => mapCategory(page, language, warnings))
    .filter(Boolean)
    .filter((category) => category.language === language);

  const languageData = {
    tutorials: sortRecords(tutorials),
    machines: sortRecords(machines),
    categories: sortRecords(categories)
  };

  reconcileRelationships(languageData, language, warnings);

  return {
    languageData,
    sourceMeta: {
      tutorialsRecords: tutorialPages.length,
      machinesRecords: machinePages.length,
      categoriesRecords: categoryPages.length
    }
  };
}

function buildOutput(perLanguageData, warnings, perLanguageMeta) {
  return {
    generatedAt: new Date().toISOString(),
    tutorials: perLanguageData,
    warnings,
    meta: {
      en: {
        source: perLanguageMeta.en,
        published: {
          tutorials: perLanguageData.en.tutorials.length,
          machines: perLanguageData.en.machines.length,
          categories: perLanguageData.en.categories.length
        }
      },
      fr: {
        source: perLanguageMeta.fr,
        published: {
          tutorials: perLanguageData.fr.tutorials.length,
          machines: perLanguageData.fr.machines.length,
          categories: perLanguageData.fr.categories.length
        }
      }
    }
  };
}

async function main() {
  const warnings = [];
  const perLanguageData = {
    en: { tutorials: [], machines: [], categories: [] },
    fr: { tutorials: [], machines: [], categories: [] }
  };
  const perLanguageMeta = {};

  for (const [language, ids] of Object.entries(LANGUAGE_DB_CONFIG)) {
    const { languageData, sourceMeta } = await fetchLanguageData(language, ids, warnings);
    perLanguageData[language] = languageData;
    perLanguageMeta[language] = sourceMeta;
  }

  const output = buildOutput(perLanguageData, warnings, perLanguageMeta);

  fs.mkdirSync(path.dirname(OUTPUT_TUTORIALS_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_TUTORIALS_PATH, JSON.stringify(output, null, 2));

  console.log(`[tutorials] EN tutorials: ${output.meta.en.published.tutorials}`);
  console.log(`[tutorials] EN machines: ${output.meta.en.published.machines}`);
  console.log(`[tutorials] EN categories: ${output.meta.en.published.categories}`);
  console.log(`[tutorials] FR tutorials: ${output.meta.fr.published.tutorials}`);
  console.log(`[tutorials] FR machines: ${output.meta.fr.published.machines}`);
  console.log(`[tutorials] FR categories: ${output.meta.fr.published.categories}`);
  for (const warning of output.warnings) {
    console.warn(`[tutorials] WARNING: ${warning}`);
  }
  console.log(`[tutorials] Data written to: ${OUTPUT_TUTORIALS_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});