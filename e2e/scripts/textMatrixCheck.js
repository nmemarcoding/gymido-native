#!/usr/bin/env node
// T-170 step 5 (LIVE-WORKOUT-SPEC v2.3.1 §9.1): checks one screen of the text-size
// matrix from a `maestro hierarchy` JSON dump (read through the guarded tools only).
// Usage: textMatrixCheck.js <hierarchy.json> --mode fit|large|any [--require id,id] [--inside a:b,…] [--density 2] [--label x]
// Asserts, per §9.1 "every row also asserts":
//   - the mode: session-page carries the fit marker ("session-page fit-…-settled") in fit mode, none in large text;
//   - every --require id (exact, or /regex/) is on screen (inside the window);
//   - no text node runs past the window's left / right edge (no horizontal scroll) or out of its parent box;
//   - every required control's hit area is ≥ 44 dp (px ÷ density; iOS dumps are already in points);
//   - every --inside a:b pair: node a's bounds sit inside node b's (e.g. the disc m:ss inside the 92 disc).
// `any` skips the mode (the iOS rest sheet is its own window: no session-page in that dump). The OS status bar
// (nodes ending inside the top 60 dp) is never checked: it isn't the app's.
// Prints one JSON line {label, ok, mode, fit, failures[]}; exit 0 = pass, 1 = fail, 2 = usage.
// Reads ids, bounds and text LENGTHS only: the dump's text itself is never printed (privacy).
const fs = require('fs');

const BOUNDS = /\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/;
const TOL = 1;
// The OS status bar's own items (iOS ids). At the largest text sizes they sit below the 60 dp band, so they
// are also skipped by id. They aren't the app's.
const OS_STATUS = /^(wifi|battery|cellular|signal|time|clock|location|airplane)\b/i;

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

function check(tree, { mode, require = [], inside = [], density = 1, label = '' }) {
  const nodes = walk(tree, null, []);
  const window = nodes.map((n) => n.bounds).filter(Boolean).reduce((best, b) => (!best || b.w * b.h > best.w * best.h ? b : best), null);
  const failures = [];
  if (!window) return { label, ok: false, mode, fit: null, failures: ['no bounds in the dump'] };
  const page = nodes.find((n) => n.id.startsWith('session-page'));
  const marker = page ? page.id.slice('session-page'.length).trim() : null;
  const fit = marker ? marker : null;
  const actual = page ? (fit ? 'fit' : 'large') : null;
  if (mode === 'any') {
    // no mode check
  } else if (!page) failures.push('session-page not found');
  else if (actual !== mode) failures.push(`mode ${actual}, expected ${mode}`);
  else if (mode === 'fit' && !/-settled$/.test(fit)) failures.push(`fit not settled (${fit})`);
  // §5.2: a fit that still overflows at the floor (marker O > 0) is REPORTED with its over px, never a failure;
  // its controls below the fold are listed as reported and the runner proves them reachable by scroll.
  const over = fit ? Number((/-O(-?\d+)-/.exec(fit) ?? [])[1] ?? 0) : 0;
  const reported = [];
  const on = (b) => b && b.x1 >= window.x1 - TOL && b.x2 <= window.x2 + TOL && b.y1 >= window.y1 - TOL && b.y2 <= window.y2 + TOL && b.w > 0 && b.h > 0;
  for (const id of require) {
    // `/re/` = a regex id (e.g. /set-action-.*/ for the live set's Did it); `id+N` = the control's hitSlop N dp per
    // side, which the dump doesn't show (the 32 Discard link pads to 44 with 6).
    const [spec, slopText] = id.split('+');
    const slop = Number(slopText ?? 0);
    const match = /^\/.*\/$/.test(spec) ? ((v) => new RegExp(`^${spec.slice(1, -1)}$`).test(v)) : (v) => v === spec;
    const hit = nodes.filter((n) => match(n.id) && on(n.bounds));
    if (!hit.length) {
      (over > 0 ? reported : failures).push(`${spec} not on screen`);
      continue;
    }
    const best = hit.reduce((m, n) => (n.bounds.w * n.bounds.h > m.bounds.w * m.bounds.h ? n : m));
    const dp = Math.min(best.bounds.w, best.bounds.h) / density + 2 * slop;
    if (dp < 44 - TOL) failures.push(`${spec} hit area ${dp.toFixed(1)} dp < 44`);
  }
  for (const pair of inside) {
    const [a, b] = pair.split(':');
    const inner = nodes.find((n) => n.id === a && n.bounds && n.bounds.w > 0);
    const outer = nodes.find((n) => n.id === b && n.bounds && n.bounds.w > 0);
    if (!inner || !outer) failures.push(`${a} / ${b} not found`);
    else if (inner.bounds.x1 < outer.bounds.x1 - TOL || inner.bounds.x2 > outer.bounds.x2 + TOL || inner.bounds.y1 < outer.bounds.y1 - TOL || inner.bounds.y2 > outer.bounds.y2 + TOL) {
      failures.push(`${a} (${inner.bounds.w}×${inner.bounds.h}) not inside ${b} (${outer.bounds.w}×${outer.bounds.h})`);
    }
  }
  const statusBar = window.y1 + 60 * density;
  for (const n of nodes) {
    if (!n.text || !n.bounds || n.bounds.w <= 0 || n.bounds.y2 <= statusBar || OS_STATUS.test(n.id)) continue;
    const where = n.id || `text(${n.text.length} chars)`;
    if (n.bounds.x1 < window.x1 - TOL || n.bounds.x2 > window.x2 + TOL) failures.push(`${where} past the window edge`);
    const p = n.parent?.bounds;
    if (p && p.w > 0 && p.h > 0 && (n.bounds.x1 < p.x1 - TOL || n.bounds.x2 > p.x2 + TOL || n.bounds.y1 < p.y1 - TOL || n.bounds.y2 > p.y2 + TOL)) {
      failures.push(`${where} outside its parent box`);
    }
  }
  return { label, ok: failures.length === 0, mode: actual, fit, over, reported, failures };
}

function main(argv) {
  const [file, ...rest] = argv;
  const opt = { require: [], inside: [], density: 1, label: '' };
  for (let i = 0; i < rest.length; i += 2) {
    const [k, v] = [rest[i], rest[i + 1]];
    if (k === '--mode') opt.mode = v;
    else if (k === '--require') opt.require = v.split(',').filter(Boolean);
    else if (k === '--density') opt.density = Number(v);
    else if (k === '--inside') opt.inside = v.split(',').filter(Boolean);
    else if (k === '--label') opt.label = v;
  }
  if (!file || !['fit', 'large', 'any'].includes(opt.mode)) {
    console.error('usage: textMatrixCheck.js <hierarchy.json> --mode fit|large [--require ids] [--density n] [--label x]');
    return 2;
  }
  const result = check(JSON.parse(fs.readFileSync(file, 'utf8')), opt);
  console.log(JSON.stringify(result));
  return result.ok ? 0 : 1;
}

module.exports = { check, parseBounds };
if (require.main === module) process.exit(main(process.argv.slice(2)));
