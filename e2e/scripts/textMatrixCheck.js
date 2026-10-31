#!/usr/bin/env node
// T-170 step 5 (LIVE-WORKOUT-SPEC v2.3.1 §9.1): checks one screen of the text-size
// matrix from a `maestro hierarchy` JSON dump (read through the guarded tools only).
// Usage: textMatrixCheck.js <hierarchy.json> --mode fit|large [--require id,id] [--density 2] [--label x]
// Asserts, per §9.1 "every row also asserts":
//   - the mode: session-page carries the fit marker ("session-page fit-…-settled") in fit mode, none in large text;
//   - every --require id is on screen (inside the window);
//   - no text node runs past the window's left / right edge (no horizontal scroll) or out of its parent box;
//   - every required control's hit area is ≥ 44 dp (px ÷ density; iOS dumps are already in points).
// Prints one JSON line {label, ok, mode, fit, failures[]}; exit 0 = pass, 1 = fail, 2 = usage.
// Reads ids, bounds and text LENGTHS only: the dump's text itself is never printed (privacy).
const fs = require('fs');

const BOUNDS = /\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/;
const TOL = 1;

function parseBounds(value) {
  const m = BOUNDS.exec(value ?? '');
  if (!m) return null;
  const [x1, y1, x2, y2] = m.slice(1).map(Number);
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}

function walk(node, parent, out) {
  const a = node.attributes ?? {};
  const entry = {
    id: a['resource-id'] || a.identifier || '',
    text: a.text || a.accessibilityText || '',
    clickable: a.clickable === 'true' || a.clickable === true,
    bounds: parseBounds(a.bounds),
    parent,
  };
  out.push(entry);
  for (const child of node.children ?? []) walk(child, entry, out);
  return out;
}

function check(tree, { mode, require = [], density = 1, label = '' }) {
  const nodes = walk(tree, null, []);
  const window = nodes.map((n) => n.bounds).filter(Boolean).reduce((best, b) => (!best || b.w * b.h > best.w * best.h ? b : best), null);
  const failures = [];
  if (!window) return { label, ok: false, mode, fit: null, failures: ['no bounds in the dump'] };
  const page = nodes.find((n) => n.id.startsWith('session-page'));
  const marker = page ? page.id.slice('session-page'.length).trim() : null;
  const fit = marker ? marker : null;
  const actual = page ? (fit ? 'fit' : 'large') : null;
  if (!page) failures.push('session-page not found');
  else if (actual !== mode) failures.push(`mode ${actual}, expected ${mode}`);
  else if (mode === 'fit' && !/-settled$/.test(fit)) failures.push(`fit not settled (${fit})`);
  const on = (b) => b && b.x1 >= window.x1 - TOL && b.x2 <= window.x2 + TOL && b.y1 >= window.y1 - TOL && b.y2 <= window.y2 + TOL && b.w > 0 && b.h > 0;
  for (const id of require) {
    const hit = nodes.filter((n) => n.id === id && on(n.bounds));
    if (!hit.length) {
      failures.push(`${id} not on screen`);
      continue;
    }
    const best = hit.reduce((m, n) => (n.bounds.w * n.bounds.h > m.bounds.w * m.bounds.h ? n : m));
    const dp = Math.min(best.bounds.w, best.bounds.h) / density;
    if (dp < 44 - TOL) failures.push(`${id} hit area ${dp.toFixed(1)} dp < 44`);
  }
  for (const n of nodes) {
    if (!n.text || !n.bounds || n.bounds.w <= 0) continue;
    const where = n.id || `text(${n.text.length} chars)`;
    if (n.bounds.x1 < window.x1 - TOL || n.bounds.x2 > window.x2 + TOL) failures.push(`${where} past the window edge`);
    const p = n.parent?.bounds;
    if (p && p.w > 0 && p.h > 0 && (n.bounds.x1 < p.x1 - TOL || n.bounds.x2 > p.x2 + TOL || n.bounds.y1 < p.y1 - TOL || n.bounds.y2 > p.y2 + TOL)) {
      failures.push(`${where} outside its parent box`);
    }
  }
  return { label, ok: failures.length === 0, mode: actual, fit, failures };
}

function main(argv) {
  const [file, ...rest] = argv;
  const opt = { require: [], density: 1, label: '' };
  for (let i = 0; i < rest.length; i += 2) {
    const [k, v] = [rest[i], rest[i + 1]];
    if (k === '--mode') opt.mode = v;
    else if (k === '--require') opt.require = v.split(',').filter(Boolean);
    else if (k === '--density') opt.density = Number(v);
    else if (k === '--label') opt.label = v;
  }
  if (!file || !['fit', 'large'].includes(opt.mode)) {
    console.error('usage: textMatrixCheck.js <hierarchy.json> --mode fit|large [--require ids] [--density n] [--label x]');
    return 2;
  }
  const result = check(JSON.parse(fs.readFileSync(file, 'utf8')), opt);
  console.log(JSON.stringify(result));
  return result.ok ? 0 : 1;
}

module.exports = { check, parseBounds };
if (require.main === module) process.exit(main(process.argv.slice(2)));
