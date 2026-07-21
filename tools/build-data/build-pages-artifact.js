#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const buildDir = path.resolve(process.env.BUILD_DIR || path.join(repoRoot, 'build'));
const sourceEventsPath = path.resolve(process.env.SOURCE_EVENTS_PATH || path.join(repoRoot, 'data', 'events.json'));
const sourcePopupPath = path.resolve(process.env.SOURCE_POPUP_PATH || path.join(repoRoot, 'data', 'popup.json'));
const sourceCoursesPath = path.resolve(process.env.SOURCE_COURSES_PATH || path.join(repoRoot, 'data', 'courses.json'));
const sourceTutorialsPath = path.resolve(process.env.SOURCE_TUTORIALS_PATH || path.join(repoRoot, 'data', 'tutorials.json'));
const buildDirRelativeToRepo = path.relative(repoRoot, buildDir).replaceAll('\\', '/');
const buildDirIsInsideRepo =
  buildDirRelativeToRepo && !buildDirRelativeToRepo.startsWith('..') && !path.isAbsolute(buildDirRelativeToRepo);

const excludedEntries = new Set([
  '.git',
  '.github',
  '.vscode',
  'node_modules',
  'tools',
  'workshops-data',
  'data',
  'test',
  'playwright-report',
  'test-results',
  '.DS_Store',
  '.env',
  '.nvmrc',
  '.gitignore',
  '.prettierignore',
  'package.json',
  'package-lock.json',
  'README.md',
  'server.crt',
  'server.key'
]);

function shouldSkip(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  if (!normalized) {
    return false;
  }

  if (buildDirIsInsideRepo) {
    if (normalized === buildDirRelativeToRepo || normalized.startsWith(`${buildDirRelativeToRepo}/`)) {
      return true;
    }
  }

  if (excludedEntries.has(normalized.split('/')[0])) {
    return true;
  }

  return false;
}

function cleanBuildDirectory() {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });
}

function copyTree(sourceDir, targetDir, relative = '') {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = relative ? path.join(relative, entry.name) : entry.name;
    if (shouldSkip(relativePath)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      copyTree(sourcePath, targetPath, relativePath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

function injectEventsFile() {
  if (!fs.existsSync(sourceEventsPath)) {
    throw new Error(`Events file not found at: ${sourceEventsPath}`);
  }

  const targetEventsPath = path.join(buildDir, 'data', 'events.json');
  fs.mkdirSync(path.dirname(targetEventsPath), { recursive: true });
  fs.copyFileSync(sourceEventsPath, targetEventsPath);
}

function injectPopupFile() {
  const targetPopupPath = path.join(buildDir, 'data', 'popup.json');
  fs.mkdirSync(path.dirname(targetPopupPath), { recursive: true });

  if (fs.existsSync(sourcePopupPath)) {
    fs.copyFileSync(sourcePopupPath, targetPopupPath);
    return {
      source: sourcePopupPath,
      usedFallback: false
    };
  }

  const defaultPopup = {
    generatedAt: new Date().toISOString(),
    active: false,
    popup: null,
    warnings: ['Popup source file was missing during build; default inactive popup emitted.'],
    meta: {
      totalRecords: 0,
      eligibleRecords: 0,
      activeRecords: 0
    }
  };

  fs.writeFileSync(targetPopupPath, JSON.stringify(defaultPopup, null, 2));
  return {
    source: 'generated-default',
    usedFallback: true
  };
}

function injectCoursesFile() {
  const targetCoursesPath = path.join(buildDir, 'data', 'courses.json');
  fs.mkdirSync(path.dirname(targetCoursesPath), { recursive: true });

  if (fs.existsSync(sourceCoursesPath)) {
    fs.copyFileSync(sourceCoursesPath, targetCoursesPath);
    return {
      source: sourceCoursesPath,
      usedFallback: false
    };
  }

  const defaultCourses = {
    generatedAt: new Date().toISOString(),
    courses: {
      en: [],
      fr: []
    },
    warnings: ['Courses source file was missing during build; default empty courses payload emitted.'],
    meta: {
      totalRecords: 0,
      enRecords: 0,
      frRecords: 0
    }
  };

  fs.writeFileSync(targetCoursesPath, JSON.stringify(defaultCourses, null, 2));
  return {
    source: 'generated-default',
    usedFallback: true
  };
}

function injectTutorialsFile() {
  const targetTutorialsPath = path.join(buildDir, 'data', 'tutorials.json');
  fs.mkdirSync(path.dirname(targetTutorialsPath), { recursive: true });

  if (fs.existsSync(sourceTutorialsPath)) {
    fs.copyFileSync(sourceTutorialsPath, targetTutorialsPath);
    return {
      source: sourceTutorialsPath,
      usedFallback: false
    };
  }

  const defaultTutorials = {
    generatedAt: new Date().toISOString(),
    tutorials: {
      en: {
        tutorials: [],
        machines: [],
        categories: []
      },
      fr: {
        tutorials: [],
        machines: [],
        categories: []
      }
    },
    warnings: ['Tutorials source file was missing during build; default empty tutorials payload emitted.'],
    meta: {
      en: {
        source: {
          tutorialsRecords: 0,
          machinesRecords: 0,
          categoriesRecords: 0
        },
        published: {
          tutorials: 0,
          machines: 0,
          categories: 0
        }
      },
      fr: {
        source: {
          tutorialsRecords: 0,
          machinesRecords: 0,
          categoriesRecords: 0
        },
        published: {
          tutorials: 0,
          machines: 0,
          categories: 0
        }
      }
    }
  };

  fs.writeFileSync(targetTutorialsPath, JSON.stringify(defaultTutorials, null, 2));
  return {
    source: 'generated-default',
    usedFallback: true
  };
}

function main() {
  cleanBuildDirectory();
  copyTree(repoRoot, buildDir);
  injectEventsFile();
  const popupResult = injectPopupFile();
  const coursesResult = injectCoursesFile();
  const tutorialsResult = injectTutorialsFile();

  console.log(`Pages artifact prepared in: ${buildDir}`);
  console.log(`Injected events data from: ${sourceEventsPath}`);
  if (popupResult.usedFallback) {
    console.log('Popup source file missing. Emitted default inactive popup payload.');
  } else {
    console.log(`Injected popup data from: ${popupResult.source}`);
  }

  if (coursesResult.usedFallback) {
    console.log('Courses source file missing. Emitted default empty courses payload.');
  } else {
    console.log(`Injected courses data from: ${coursesResult.source}`);
  }

  if (tutorialsResult.usedFallback) {
    console.log('Tutorials source file missing. Emitted default empty tutorials payload.');
  } else {
    console.log(`Injected tutorials data from: ${tutorialsResult.source}`);
  }
}

main();
