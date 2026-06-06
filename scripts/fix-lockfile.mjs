#!/usr/bin/env node
/**
 * Strip version-less phantom entries from package-lock.json.
 *
 * npm (all versions tested through 11.16) writes a few sharp optional-dependency
 * nodes (the musl/Alpine `@img/sharp-*` variants under
 * node_modules/sharp/node_modules/@img/...) with NO `version` field. `npm ci`
 * succeeds on macOS (those variants are skipped) but crashes on linux/glibc with
 * `TypeError: Invalid Version:` inside arborist `canDedupe` (semver compares the
 * empty version) — breaking the Docker build.
 *
 * We deploy on glibc and never use the musl variants, so removing these
 * version-less entries is safe and fixes `npm ci`. Run this after any
 * `npm install` that reintroduces them:  `node scripts/fix-lockfile.mjs`
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const lockPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package-lock.json');
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));

const removed = [];
for (const [key, meta] of Object.entries(lock.packages ?? {})) {
  if (meta && (meta.version === undefined || meta.version === null || meta.version === '')) {
    delete lock.packages[key];
    removed.push(key);
  }
}

if (removed.length === 0) {
  console.log('fix-lockfile: no version-less entries — nothing to do.');
} else {
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  console.log(`fix-lockfile: removed ${removed.length} version-less entrie(s):`);
  removed.forEach((r) => console.log('  -', r));
}
