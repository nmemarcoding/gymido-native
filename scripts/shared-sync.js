#!/usr/bin/env node
// T-173: copy the shared token source from a gymido checkout into shared/gymido/ and write SHARED_SOURCE.json
// (the gymido SHA + a sha256 per copied file). Reads gymido through git objects only (`git show <ref>:<path>`),
// never its working tree, and never writes there. Then regenerates src/shared/theme/tokens.generated.json.
//
//   node scripts/shared-sync.js --gymido ~/Desktop/coding/gymido --ref <sha or ref>
//
// The copy and the manifest are never edited by hand: sharedSync.test.js (check 1) fails on any change.
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SHARED_DIR, SHARED_FILES, MANIFEST, sha256 } = require('./shared-files');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

function main() {
  const gymido = arg('gymido');
  const ref = arg('ref');
  if (!gymido || !ref) {
    console.error('usage: node scripts/shared-sync.js --gymido <gymido checkout> --ref <sha or ref>');
    process.exit(2);
  }
  const git = (...args) => execFileSync('git', ['-C', gymido, ...args], { maxBuffer: 16 * 1024 * 1024 });
  const sha = git('rev-parse', '--verify', `${ref}^{commit}`).toString().trim();

  const files = {};
  for (const file of SHARED_FILES) {
    const content = git('show', `${sha}:${file}`);
    const target = path.join(SHARED_DIR, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    files[file] = sha256(content);
  }
  fs.writeFileSync(MANIFEST, `${JSON.stringify({ gymidoSha: sha, files }, null, 2)}\n`);
  console.log(`shared-sync: ${SHARED_FILES.length} files from gymido ${sha.slice(0, 8)} → ${path.relative(process.cwd(), SHARED_DIR)}`);

  require('./tokens-native').writeGenerated();
}

if (require.main === module) main();
