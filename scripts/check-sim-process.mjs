#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());

const REQUIRED_FILES = [
  {
    path: 'AGENTS.md',
    phrases: [
      'single RNG module',
      'No hidden randomness',
      'version bump',
      'migration function',
      'sample save fixture',
      'Core sim must be UI-agnostic',
      'Season 10 saves unreliable',
    ],
  },
  {
    path: 'CLAUDE.md',
    phrases: ['Read AGENTS.md first', 'canonical process contract'],
  },
  {
    path: 'docs/process/sim-engine-quality-gates.md',
    phrases: [
      'Deterministic replay',
      'Save compatibility',
      'Balance snapshot',
      'Model assumption registry',
      'Handoff',
    ],
  },
  {
    path: 'test/fixtures/sim/README.md',
    phrases: ['legacy saves', 'replay snapshots', 'balance snapshots'],
  },
];

const SIM_DIRS = [
  'src/sim',
  'src/engine',
  'src/models',
  'src/services/sim',
  'src/services/save',
  'src/workers',
  'app/sim',
  'functions/src/sim',
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORE_SEGMENTS = new Set([
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  'lib',
  '__tests__',
  '__mocks__',
]);

function fail(message) {
  failures.push(message);
}

function readText(relPath) {
  return readFileSync(path.join(root, relPath), 'utf8');
}

function includesPhrase(content, phrase) {
  return content.toLowerCase().includes(phrase.toLowerCase());
}

function validateRequiredFiles() {
  for (const file of REQUIRED_FILES) {
    const fullPath = path.join(root, file.path);
    if (!existsSync(fullPath)) {
      fail(`Missing required process file: ${file.path}`);
      continue;
    }

    const content = readText(file.path);
    for (const phrase of file.phrases) {
      if (!includesPhrase(content, phrase)) {
        fail(`${file.path} is missing required phrase: ${phrase}`);
      }
    }
  }
}

function shouldSkipDirectory(direntName) {
  return IGNORE_SEGMENTS.has(direntName);
}

function walkFiles(absDir, visitor) {
  if (!existsSync(absDir)) return;

  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (shouldSkipDirectory(entry.name)) continue;

    const absPath = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absPath, visitor);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    visitor(absPath);
  }
}

function validateNoHiddenSimRandomness() {
  const mathRandomPattern = /\bMath\.random\s*\(/;

  for (const relDir of SIM_DIRS) {
    walkFiles(path.join(root, relDir), (absPath) => {
      const content = readFileSync(absPath, 'utf8');
      if (!mathRandomPattern.test(content)) return;

      const relPath = path.relative(root, absPath);
      fail(`${relPath} uses hidden randomness; route sim randomness through the seeded RNG module.`);
    });
  }
}

const failures = [];

validateRequiredFiles();
validateNoHiddenSimRandomness();

if (failures.length > 0) {
  console.error('Sim process guardrails failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Sim process guardrails passed.');
