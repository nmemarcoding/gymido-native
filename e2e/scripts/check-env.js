#!/usr/bin/env node
// Pre-flight for the Maestro runs: fails when a value in .env.e2e.local has
// leading/trailing whitespace, a CR or surrounding quotes. `set -a && .` passes
// those straight into -e, and Auth0 then answers "Wrong email or password".
// Fails instead of trimming: a bad file should be fixed, not silently masked.
// Prints line numbers, key names and the problem only, never a value.
//
//   node e2e/scripts/check-env.js [path]   (default: .env.e2e.local)

const fs = require('fs');
const path = require('path');

function checkEnvText(text) {
  const problems = [];
  text.split('\n').forEach((line, index) => {
    if (!line.trim() || line.trimStart().startsWith('#') || !line.includes('=')) {
      return;
    }
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    const found = [];
    if (value.includes('\r')) {
      found.push('carriage return (CRLF line ending)');
    }
    const bare = value.replace(/\r/g, '');
    if (bare !== bare.trimStart()) {
      found.push('leading whitespace');
    }
    if (bare !== bare.trimEnd()) {
      found.push('trailing whitespace');
    }
    if (/^["']|["']$/.test(bare.trim())) {
      found.push('quotes');
    }
    if (found.length) {
      problems.push({ line: index + 1, key, problems: found });
    }
  });
  return problems;
}

function main(argv) {
  const file = path.resolve(argv[2] || '.env.e2e.local');
  if (!fs.existsSync(file)) {
    console.log(`check-env: ${path.basename(file)} not found, skipping (credentials passed with -e).`);
    return 0;
  }
  const problems = checkEnvText(fs.readFileSync(file, 'utf8'));
  if (!problems.length) {
    console.log(`check-env: ${path.basename(file)} OK.`);
    return 0;
  }
  console.error(`check-env: ${path.basename(file)} has values Maestro would pass on as-is. Fix them by hand:`);
  problems.forEach(({ line, key, problems: found }) => {
    console.error(`  line ${line}: ${key}: ${found.join(', ')}`);
  });
  return 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = { checkEnvText, main };
