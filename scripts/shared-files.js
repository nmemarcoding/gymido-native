// T-173: where the synced gymido files live and how they are hashed. Shared by the sync script, the upstream
// check (check 3) and the Jest checks.
'use strict';

const crypto = require('crypto');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Outside src/: nothing here ships in the bundle (the app reads tokens.generated.json), and src/ guards such as
// noLiterals.test.js stay as they are.
const SHARED_DIR = path.join(ROOT, 'shared/gymido');
const MANIFEST = path.join(SHARED_DIR, 'SHARED_SOURCE.json');
// Paths as they are in the gymido repo (and under shared/gymido/). The manifest hashes every one (L4).
const SHARED_FILES = ['design/tokens/tokens.json', 'design/tokens/generate.js'];

const sha256 = (content) => crypto.createHash('sha256').update(content).digest('hex');

module.exports = { ROOT, SHARED_DIR, MANIFEST, SHARED_FILES, sha256 };
