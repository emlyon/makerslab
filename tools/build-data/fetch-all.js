#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadDotEnvIfPresent } = require('./utils');
const RelationshipReconciler = require('./relationship-reconciler');

const repoRoot = path.resolve(__dirname, '../..');

loadDotEnvIfPresent(repoRoot);

/**
 * Loads existing data from JSON files in the output directory
 */
function loadExistingData(outputRoot) {
  const existingData = {
    events: null,
    categories: null,
    popup: null,
    courses: null,
    equipments: null,
    tutorials: null
  };

  const filesMap = {
    events: path.join(outputRoot, 'data', 'events.json'),
    categories: path.join(outputRoot, 'data', 'categories.json'),
    popup: path.join(outputRoot, 'data', 'popup.json'),
    courses: path.join(outputRoot, 'data', 'courses.json'),
    equipments: path.join(outputRoot, 'data', 'equipments.json'),
    tutorials: path.join(outputRoot, 'data', 'tutorials.json')
  };

  for (const [key, filePath] of Object.entries(filesMap)) {
    if (fs.existsSync(filePath)) {
      try {
        existingData[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (error) {
        console.warn(`[fetch-all] Failed to load existing ${key} data: ${error.message}`);
      }
    }
  }

  return existingData;
}

/**
 * Compares old and new data and warns about significant divergences
 */
function checkDataDivergence(entityName, oldData, newData, language) {
  const warnings = [];

  if (!oldData) {
    return warnings;
  }

  // Count comparison
  const oldCount = Array.isArray(oldData) ? oldData.length : 0;
  const newCount = Array.isArray(newData) ? newData.length : 0;

  if (oldCount !== newCount) {
    warnings.push(`[${entityName}][${language}] Record count divergence: had ${oldCount}, now ${newCount}`);
  }

  // ID comparison (for deeper analysis)
  if (Array.isArray(oldData) && Array.isArray(newData)) {
    const oldIds = new Set(oldData.map((item) => item.id));
    const newIds = new Set(newData.map((item) => item.id));

    const removed = Array.from(oldIds).filter((id) => !newIds.has(id));
    const added = Array.from(newIds).filter((id) => !oldIds.has(id));

    if (removed.length > 0) {
      warnings.push(`[${entityName}][${language}] Removed ${removed.length} records (IDs: ${removed.slice(0, 3).join(', ')}${removed.length > 3 ? '...' : ''})`);
    }
    if (added.length > 0) {
      warnings.push(`[${entityName}][${language}] Added ${added.length} records (IDs: ${added.slice(0, 3).join(', ')}${added.length > 3 ? '...' : ''})`);
    }
  }

  return warnings;
}

/**
 * Persists all data to JSON files
 */
function persistAllData(outputRoot, allData, allWarnings) {
  const outputDataDir = path.join(outputRoot, 'data');
  fs.mkdirSync(outputDataDir, { recursive: true });

  const filesToWrite = [
    {
      name: 'events',
      path: path.join(outputDataDir, 'events.json'),
      // For events, write just the array (backward compatibility)
      data: allData.events?.events || allData.events
    },
    {
      name: 'categories',
      path: path.join(outputDataDir, 'categories.json'),
      data: allData.categories
    },
    {
      name: 'popup',
      path: path.join(outputDataDir, 'popup.json'),
      data: allData.popup
    },
    {
      name: 'courses',
      path: path.join(outputDataDir, 'courses.json'),
      data: allData.courses
    },
    {
      name: 'equipments',
      path: path.join(outputDataDir, 'equipments.json'),
      data: allData.equipments
    },
    {
      name: 'tutorials',
      path: path.join(outputDataDir, 'tutorials.json'),
      data: allData.tutorials
    }
  ];

  for (const file of filesToWrite) {
    if (file.data) {
      fs.writeFileSync(file.path, JSON.stringify(file.data, null, 2));
      console.log(`[fetch-all] Persisted ${file.name} to: ${file.path}`);
    }
  }

  // Log all warnings
  for (const warning of allWarnings) {
    console.warn(`[fetch-all] ${warning}`);
  }

  console.log(`[fetch-all] Completed. Total warnings: ${allWarnings.length}`);
}

async function main() {
  const outputRoot = resolveOutputRoot();

  // Dynamically import fetch functions
  const fetchEvents = require('./fetch-events');
  const fetchCategories = require('./fetch-categories');
  const fetchPopup = require('./fetch-popup');
  const fetchCourses = require('./fetch-courses');
  const fetchEquipments = require('./fetch-equipments');
  const fetchTutorials = require('./fetch-tutorials');

  // Load existing data
  const existingData = loadExistingData(outputRoot);
  const allWarnings = [];

  console.log('[fetch-all] Starting comprehensive data fetch and reconciliation...');

  // Fetch all data
  let events, categories, popup, courses, equipments, tutorials;

  try {
    console.log('[fetch-all] Fetching events...');
    const eventsResult = await fetchEvents(outputRoot, existingData.events);
    events = eventsResult;
    allWarnings.push(...checkDataDivergence('events', existingData.events, eventsResult, 'all'));
  } catch (error) {
    console.error('[fetch-all] Failed to fetch events:', error.message);
    events = existingData.events;
  }

  try {
    console.log('[fetch-all] Fetching categories...');
    const categoriesResult = await fetchCategories(outputRoot, existingData.categories);
    categories = categoriesResult;
    for (const lang of ['en', 'fr']) {
      allWarnings.push(
        ...checkDataDivergence(
          'categories',
          existingData.categories?.categories?.[lang],
          categoriesResult?.categories?.[lang],
          lang
        )
      );
    }
  } catch (error) {
    console.error('[fetch-all] Failed to fetch categories:', error.message);
    categories = existingData.categories;
  }

  try {
    console.log('[fetch-all] Fetching popup...');
    const popupResult = await fetchPopup(outputRoot, existingData.popup);
    popup = popupResult;
    allWarnings.push(...checkDataDivergence('popup', existingData.popup, popupResult, 'all'));
  } catch (error) {
    console.error('[fetch-all] Failed to fetch popup:', error.message);
    popup = existingData.popup;
  }

  try {
    console.log('[fetch-all] Fetching courses...');
    const coursesResult = await fetchCourses(outputRoot, existingData.courses);
    courses = coursesResult;
    for (const lang of ['en', 'fr']) {
      allWarnings.push(
        ...checkDataDivergence(
          'courses',
          existingData.courses?.courses?.[lang],
          coursesResult?.courses?.[lang],
          lang
        )
      );
    }
  } catch (error) {
    console.error('[fetch-all] Failed to fetch courses:', error.message);
    courses = existingData.courses;
  }

  try {
    console.log('[fetch-all] Fetching equipments...');
    const equipmentsResult = await fetchEquipments(outputRoot, existingData.equipments);
    equipments = equipmentsResult;
    for (const lang of ['en', 'fr']) {
      allWarnings.push(
        ...checkDataDivergence(
          'equipments',
          existingData.equipments?.equipments?.[lang],
          equipmentsResult?.equipments?.[lang],
          lang
        )
      );
    }
  } catch (error) {
    console.error('[fetch-all] Failed to fetch equipments:', error.message);
    equipments = existingData.equipments;
  }

  try {
    console.log('[fetch-all] Fetching tutorials...');
    const tutorialsResult = await fetchTutorials(outputRoot, existingData.tutorials);
    tutorials = tutorialsResult;
    for (const lang of ['en', 'fr']) {
      allWarnings.push(
        ...checkDataDivergence(
          'tutorials',
          existingData.tutorials?.tutorials?.[lang],
          tutorialsResult?.tutorials?.[lang],
          lang
        )
      );
    }
  } catch (error) {
    console.error('[fetch-all] Failed to fetch tutorials:', error.message);
    tutorials = existingData.tutorials;
  }

  // Final reconciliation across all entities
  console.log('[fetch-all] Performing final cross-entity reconciliation...');
  const reconciler = new RelationshipReconciler();

  // Reconcile tutorials with all related entities
  if (tutorials && equipments && courses) {
    for (const language of ['en', 'fr']) {
      const tutorialLangData = tutorials.tutorials?.[language];
      const equipmentLangData = equipments.equipments?.[language];
      const categoryData = categories?.categories?.[language];
      
      if (tutorialLangData || equipmentLangData) {
        reconciler.reconcileTutorialRelationships(
          {
            tutorials: tutorialLangData?.tutorials || [],
            equipments: equipmentLangData?.equipments || [],
            categories: categoryData || [],
            software: tutorialLangData?.software || [],
            courses: tutorialLangData?.courses || []
          },
          language
        );
        allWarnings.push(...reconciler.getWarnings());
        
        // Sync reconciled categories back to tutorials.json structure for backward compatibility
        if (categoryData && tutorialLangData) {
          tutorialLangData.categories = categoryData;
        }
      }
    }
  }

  // Reconcile equipments with categories
  if (equipments && categories) {
    for (const language of ['en', 'fr']) {
      const equipmentLangData = equipments.equipments?.[language];
      const categoryData = categories?.categories?.[language];

      if (equipmentLangData || categoryData) {
        reconciler.reconcileEquipmentRelationships(
          {
            equipments: equipmentLangData?.equipments || [],
            categories: categoryData || []
          },
          language
        );
        allWarnings.push(...reconciler.getWarnings());
        
        // Sync reconciled categories back to equipments.json structure for backward compatibility
        if (categoryData && equipmentLangData?.equipments) {
          equipmentLangData.categories = categoryData;
        }
      }
    }
  }

  // Persist all data
  persistAllData(outputRoot, { events, categories, popup, courses, equipments, tutorials }, allWarnings);
}

function resolveOutputRoot() {
  const arg = process.argv.find((value) => value.startsWith('--output-root='));
  const fromArg = arg ? arg.slice('--output-root='.length) : undefined;
  const outputRoot = fromArg || process.env.OUTPUT_ROOT || repoRoot;
  return path.resolve(outputRoot);
}

main().catch((error) => {
  console.error('[fetch-all] Fatal error:', error.message);
  process.exit(1);
});
