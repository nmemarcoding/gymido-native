import fs from 'fs';
import path from 'path';

// Guard: the app's import graph, walked from the entry point the way Metro
// bundles it. Two failures it catches:
//   - a relative import that no longer resolves. An owner's release build once
//     failed in Metro on exactly this ("Unable to resolve module") after a
//     module was renamed mid-refactor; Jest never saw it, because no test
//     imported that screen.
//   - anything experimental reachable from the app: a spike never ships.

const ROOT = path.resolve(__dirname, '../..');
const ENTRY = path.join(ROOT, 'index.js');
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.json'];
const IMPORT = /(?:import\s[^'"]*?from\s*|import\s*|require\(\s*|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

function resolveFrom(file, specifier) {
  const base = path.resolve(path.dirname(file), specifier);
  const candidates = [
    base,
    ...EXTENSIONS.map((extension) => base + extension),
    ...EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ];
  const packageMain = path.join(base, 'package.json');
  if (fs.existsSync(packageMain)) {
    const { main = 'index.js' } = JSON.parse(fs.readFileSync(packageMain, 'utf8'));
    candidates.unshift(path.join(base, main));
  }
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function walk() {
  const seen = new Set();
  const unresolved = [];
  const stack = [ENTRY];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    if (!/\.(js|jsx|ts|tsx)$/.test(file) || /__tests__|\.test\./.test(file)) {
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      const resolved = resolveFrom(file, match[1]);
      if (resolved) {
        stack.push(resolved);
      } else {
        unresolved.push(`${path.relative(ROOT, file)} → ${match[1]}`);
      }
    }
  }
  return { files: [...seen].map((file) => path.relative(ROOT, file)), unresolved };
}

describe('app import graph (from index.js)', () => {
  const graph = walk();

  it('reaches the app (sanity: the walk actually follows imports)', () => {
    expect(graph.files).toEqual(expect.arrayContaining(['src/App.js', 'src/shared/time/restCountdown.js']));
    expect(graph.files.length).toBeGreaterThan(50);
  });

  it('every relative import resolves to a file', () => {
    expect(graph.unresolved).toEqual([]);
  });

  // RN-SPEC-app-shell §9.2 / EB-08: the debug crash toggle is never live in a
  // release build. Every reference to src/dev/ must sit behind __DEV__, which
  // is false in release, so the dev-menu item is never registered and the
  // probe is never rendered.
  it('debug-only modules (src/dev/) are only ever referenced behind __DEV__', () => {
    const offenders = [];
    for (const file of graph.files) {
      if (file.startsWith('src/dev/') || !/\.(js|jsx|ts|tsx)$/.test(file)) {
        continue;
      }
      const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
      lines.forEach((line, index) => {
        if (/['"][^'"]*\/dev\/[^'"]+['"]/.test(line) && !/^\s*\/\//.test(line)) {
          const context = lines.slice(Math.max(0, index - 2), index + 1).join('\n');
          if (!context.includes('__DEV__')) {
            offenders.push(`${file}:${index + 1}`);
          }
        }
      });
    }
    expect(offenders).toEqual([]);
    expect(graph.files).toContain('src/dev/debugCrash.js');
  });

  it('nothing experimental is reachable', () => {
    expect(graph.files.filter((file) => /spike|TEMP_/i.test(file))).toEqual([]);
  });
});
