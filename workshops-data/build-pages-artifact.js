#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const buildDir = path.resolve(process.env.BUILD_DIR || path.join(repoRoot, 'build'));
const sourceEventsPath = path.resolve(
  process.env.SOURCE_EVENTS_PATH || path.join(repoRoot, 'workshops-data', 'events.json')
);
const buildDirRelativeToRepo = path.relative(repoRoot, buildDir).replaceAll('\\', '/');
const buildDirIsInsideRepo =
  buildDirRelativeToRepo && !buildDirRelativeToRepo.startsWith('..') && !path.isAbsolute(buildDirRelativeToRepo);

const excludedEntries = new Set([
  '.git',
  '.github',
  '.vscode',
  'node_modules',
  'playwright-report',
  'test-results',
  '.DS_Store',
  'server.crt',
  'server.key'
]);

const excludedExactPaths = new Set([
  'workshops-data/eventbrite-config.json',
  'workshops-data/makersboard-html'
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

  if (excludedExactPaths.has(normalized)) {
    return true;
  }

  if (normalized.startsWith('workshops-data/makersboard-html/')) {
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

  const targetEventsPath = path.join(buildDir, 'workshops-data', 'events.json');
  fs.mkdirSync(path.dirname(targetEventsPath), { recursive: true });
  fs.copyFileSync(sourceEventsPath, targetEventsPath);
}

function main() {
  cleanBuildDirectory();
  copyTree(repoRoot, buildDir);
  injectEventsFile();

  console.log(`Pages artifact prepared in: ${buildDir}`);
  console.log(`Injected events data from: ${sourceEventsPath}`);
}

main();
