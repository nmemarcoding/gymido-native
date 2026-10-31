#!/usr/bin/env node
// T-173 check 3 (L4): is the synced copy (shared/gymido/SHARED_SOURCE.json) what gymido MAIN has? It compares each
// file's sha256 with `git show <ref>:<file>` in a local gymido checkout: git objects only, never the working tree,
// nothing written. Native has no CI, so this runs before a release (`npm run shared:check`) and in the PM's gate.
//
//   node scripts/check-shared-upstream.js [--gymido ~/Desktop/coding/gymido] [--ref origin/main]
//
// Exit 0 = in sync · 1 = a file differs (sync in this cycle) · 2 = absent upstream (FE has not merged it yet)
// · 0 with a warning when there is no gymido checkout.
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MANIFEST, sha256 } = require('./shared-files');

// manifest files { path: sha256 } + upstream { path: Buffer | null } → { status, lines }.
function compare(files, upstream, ref) {
  const lines = [];
  let differs = false;
  let absent = false;
  for (const [file, hash] of Object.entries(files)) {
    const content = upstream[file];
    if (content === null || content === undefined) {
      absent = true;
      lines.push(`absent upstream: ${file} is not on gymido ${ref} yet (expected until FE merges it); the copy cannot be checked against main`);
    } else if (sha256(content) !== hash) {
      differs = true;
      lines.push(`differs: ${file} on gymido ${ref} is not the synced copy; run npm run shared:sync -- --gymido <checkout> --ref ${ref}`);
    } else {
      lines.push(`in sync: ${file}`);
    }
  }
  return { status: differs ? 1 : absent ? 2 : 0, lines };
}

function main() {
  const arg = (name, fallback) => {
    const index = process.argv.indexOf(`--${name}`);
    return index > 0 ? process.argv[index + 1] : fallback;
  };
  const gymido = arg('gymido', path.join(os.homedir(), 'Desktop/coding/gymido'));
  const ref = arg('ref', 'origin/main');
  if (!fs.existsSync(path.join(gymido, '.git'))) {
    console.warn(`shared:check skipped: no gymido checkout at ${gymido}`);
    return 0;
  }
  const { files } = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const upstream = {};
  for (const file of Object.keys(files)) {
    try {
      upstream[file] = execFileSync('git', ['-C', gymido, 'show', `${ref}:${file}`], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 });
    } catch {
      upstream[file] = null;
    }
  }
  const result = compare(files, upstream, ref);
  result.lines.forEach((line) => console.log(`shared:check ${line}`));
  return result.status;
}

if (require.main === module) process.exit(main());

module.exports = { compare };
