'use strict';
// T-173: the token generator core, shared by web and native. Plain CommonJS with no dependencies, so the web CLI
// (frontend/scripts/tokens.mjs), Vitest and native's Jest can all `require()` it (reviewer L3). It reads the DTCG
// source (tokens.json) and returns values; writing files is the caller's job.
//
//   const { generate } = require('./generate.js');
//   const { css, tokens, errors } = generate(source, { tailwindDefaults });
//
// - tokens: every leaf as { path, name, type, value, web, native, deprecated }; `value` has references resolved
//   and is the platform-neutral DTCG value (native formats it its own way).
// - css: the web block for frontend/src/index.css's @theme, one `--{group}-{name}: {value};` per line, with each
//   $description as a comment line above it, in source order.
// - errors: [] when the source is valid (schema, references, guards); the CLI fails on any.

const TYPES = new Set(['color', 'dimension', 'duration', 'cubicBezier', 'shadow', 'gradient', 'fontFamily', 'number', 'typography']);

// Description text is emitted into index.css as a comment. Existing tests read that file as text:
// noClassicTheme.test.js (no "classic", no "data-theme"), containers.guard.test.js (counts @container/container-type,
// reviewer L1). "*/" would end the comment early.
const BANNED_IN_DESCRIPTION = [/\*\//, /classic/i, /data-theme/i, /@container/i, /container-type/i];

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isLeaf = (node) => isPlainObject(node) && Object.prototype.hasOwnProperty.call(node, '$value');
const gymido = (node) => (isPlainObject(node.$extensions) && isPlainObject(node.$extensions.gymido) ? node.$extensions.gymido : {});

// Every leaf in source order, with the `web: "skip"` / `native: "skip"` of its own node or any ancestor group.
function walk(source) {
  const leaves = [];
  const visit = (node, path, inherited) => {
    const ext = gymido(node);
    const flags = { web: ext.web === 'skip' ? 'skip' : inherited.web, native: ext.native === 'skip' ? 'skip' : inherited.native };
    if (isLeaf(node)) {
      leaves.push({ path, node, ...flags });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (isPlainObject(child)) visit(child, [...path, key], flags);
    }
  };
  visit(source, [], { web: null, native: null });
  return leaves;
}

const REF = /^\{([^{}]+)\}$/;

function makeResolver(leaves, errors) {
  const byPath = new Map(leaves.map((leaf) => [leaf.path.join('.'), leaf]));
  const resolving = new Set();
  const resolve = (value, where) => {
    if (typeof value === 'string') {
      const match = REF.exec(value);
      if (!match) return value;
      const target = byPath.get(match[1]);
      if (!target) {
        errors.push(`${where}: reference ${value} does not resolve`);
        return value;
      }
      if (resolving.has(match[1])) {
        errors.push(`${where}: reference cycle through ${value}`);
        return value;
      }
      resolving.add(match[1]);
      const out = resolve(target.node.$value, match[1]);
      resolving.delete(match[1]);
      return out;
    }
    if (Array.isArray(value)) return value.map((item) => resolve(item, where));
    if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolve(item, where)]));
    return value;
  };
  return resolve;
}

// ---- web formatting (each must give today's live CSS string byte for byte; tokens.generated.t173.test.js checks) ----

const formatNumber = (value) => String(value);

const formatFontFamily = (value) =>
  (Array.isArray(value) ? value : [value]).map((name) => (/^[\w-]+$/.test(name) ? name : `"${name}"`)).join(', ');

const formatCubicBezier = (value) => `cubic-bezier(${value.map(formatNumber).join(', ')})`;

// DTCG shadow layer → CSS. Lengths are written as the source writes them ("0", "10px"); a trailing "0" spread, and
// then a trailing "0" blur, is left out, as CSS writes them (`0 16px 40px rgba(…)`, `0 0 #0000`).
function formatShadowLayer(layer) {
  const lengths = [layer.offsetX, layer.offsetY, layer.blur, layer.spread].map((part) => (part === undefined ? '0' : String(part)));
  while (lengths.length > 2 && lengths[lengths.length - 1] === '0') lengths.pop();
  return `${layer.inset ? 'inset ' : ''}${lengths.join(' ')} ${layer.color}`;
}
const formatShadow = (value) => (Array.isArray(value) ? value : [value]).map(formatShadowLayer).join(', ');

// DTCG stops (position 0–1) + $extensions.gymido.gradient { kind, angle | shape } → CSS. The first stop at 0 and the
// last at 1 are implicit in CSS and left out; any other position is written as a percentage.
function formatGradient(stops, ext) {
  const spec = ext.gradient || {};
  const kind = spec.kind === 'radial' ? 'radial' : 'linear';
  const head = kind === 'radial' ? spec.shape : spec.angle;
  const last = stops.length - 1;
  const parts = stops.map((stop, index) => {
    const implicit = stop.position === undefined || (index === 0 && stop.position === 0) || (index === last && stop.position === 1);
    return implicit ? stop.color : `${stop.color} ${Math.round(stop.position * 10000) / 100}%`;
  });
  return `${kind}-gradient(${head ? `${head}, ` : ''}${parts.join(', ')})`;
}

// One leaf → its web declarations [[name, value], …] (typography gives several, Tailwind v4's --text-* convention).
function webDeclarations(name, type, value, ext) {
  switch (type) {
    case 'cubicBezier':
      return [[name, formatCubicBezier(value)]];
    case 'fontFamily':
      return [[name, formatFontFamily(value)]];
    case 'shadow':
      return [[name, formatShadow(value)]];
    case 'gradient':
      return [[name, formatGradient(value, ext)]];
    case 'typography': {
      const out = [[name, String(value.fontSize)]];
      if (value.lineHeight !== undefined) out.push([`${name}--line-height`, String(value.lineHeight)]);
      if (value.fontWeight !== undefined) out.push([`${name}--font-weight`, String(value.fontWeight)]);
      if (value.letterSpacing !== undefined) out.push([`${name}--letter-spacing`, String(value.letterSpacing)]);
      return out;
    }
    default:
      return [[name, formatNumber(value)]];
  }
}

const describe = (text) => String(text).replace(/\s+/g, ' ').trim();

/**
 * @param {object} source  parsed tokens.json
 * @param {{ tailwindDefaults?: Map<string,string> }} [options]  Tailwind's default theme vars (name → value), for the
 *        "no new name shadows a Tailwind default" guard (UX RFC §5 R1); a live override is marked
 *        `$extensions.gymido.overridesTailwind: true`.
 */
function generate(source, options = {}) {
  const errors = [];
  if (!isPlainObject(source)) return { css: '', tokens: [], errors: ['the source is not a JSON object'] };
  if (typeof source.$version !== 'string' || !/^\d+\.\d+\.\d+$/.test(source.$version)) errors.push('$version must be semver (x.y.z)');

  const leaves = walk(source);
  const resolve = makeResolver(leaves, errors);
  const tokens = [];
  const lines = [];
  const webNames = new Map();

  for (const leaf of leaves) {
    const where = leaf.path.join('.');
    const { node } = leaf;
    const ext = gymido(node);
    if (!TYPES.has(node.$type)) errors.push(`${where}: unknown or missing $type (${node.$type})`);
    if (node.$description !== undefined) {
      BANNED_IN_DESCRIPTION.forEach((pattern) => {
        if (pattern.test(String(node.$description))) errors.push(`${where}: $description must not contain ${pattern}`);
      });
    }
    const platform = isPlainObject(ext.platform) ? ext.platform : null;
    const value = resolve(node.$value, where);
    const webValue = platform && Object.prototype.hasOwnProperty.call(platform, 'web') ? resolve(platform.web, where) : value;
    const name = `--${leaf.path.join('-')}`;
    tokens.push({ path: leaf.path, name, type: node.$type, value, web: leaf.web !== 'skip' && webValue !== null, native: leaf.native !== 'skip', deprecated: Boolean(node.$deprecated) });

    if (leaf.web === 'skip' || webValue === null) continue;
    let declarations;
    try {
      declarations = webDeclarations(name, node.$type, webValue, ext);
    } catch (error) {
      errors.push(`${where}: cannot format its value (${error.message})`);
      continue;
    }
    if (node.$description !== undefined) lines.push(`  /* ${describe(node.$description)} */`);
    for (const [varName, varValue] of declarations) {
      if (webNames.has(varName)) errors.push(`${where}: web name ${varName} is also made by ${webNames.get(varName)}`);
      webNames.set(varName, where);
      const fallback = options.tailwindDefaults && options.tailwindDefaults.get(varName);
      if (fallback !== undefined && fallback !== varValue && ext.overridesTailwind !== true) {
        errors.push(`${where}: ${varName} would change Tailwind's default (${fallback}) for every existing class; pick another name (R1)`);
      }
      lines.push(`  ${varName}: ${varValue};`);
    }
  }

  // Reviewer L2: Tailwind's `text-X` reads --text-X (size) and --color-X (colour); one name in both is ambiguous.
  for (const token of tokens) {
    if (token.path[0] !== 'text' || !token.web) continue;
    const colour = `--color-${token.path.slice(1).join('-')}`;
    if (webNames.has(colour)) errors.push(`${token.path.join('.')}: ${token.name} has the same name as ${colour}; text-${token.path.slice(1).join('-')} would be ambiguous (L2)`);
  }

  return { css: `${lines.join('\n')}\n`, tokens, errors };
}

module.exports = { generate, formatShadow, formatGradient, formatFontFamily, formatCubicBezier, BANNED_IN_DESCRIPTION };
