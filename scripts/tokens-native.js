#!/usr/bin/env node
// T-173: shared/gymido/design/tokens/tokens.json → src/shared/theme/tokens.generated.json (native values, source
// paths, source order). The shared generator core (generate.js, synced from gymido) walks the source, resolves
// references and validates; this file only formats each value the way native writes it:
//   colour     hex upper-cased (#ffc21a → #FFC21A); rgb()/rgba() exactly as the source writes them
//   dimension  px number (rem × 16)            duration  ms number (s × 1000)
//   number     as is                           cubicBezier / fontFamily  the array as is
//   shadow     the RN boxShadow string native uses: every length in px ("0px 10px 24px -12px rgba(…)"),
//              a trailing 0 spread (then 0 blur) left out, layers joined with ", "
//   gradient   GradientFill props: linear { angle, colors, stops? }, stops only when not evenly spaced;
//              radial { shape, colors, stops } (the CSS shape string; native radial geometry is a native.* token)
// `$extensions.gymido.platform.native` replaces the value (null = no native value); `native: "skip"` is left out.
//
//   node scripts/tokens-native.js           write the file
//   node scripts/tokens-native.js --check   exit 1 if the committed file is stale (Jest check 2 does the same)
'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, SHARED_DIR } = require('./shared-files');

const SOURCE = path.join(SHARED_DIR, 'design/tokens/tokens.json');
const CORE = path.join(SHARED_DIR, 'design/tokens/generate.js');
const OUTPUT = path.join(ROOT, 'src/shared/theme/tokens.generated.json');

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function formatColor(value) {
  if (typeof value !== 'string') throw new Error(`colour is not a string (${JSON.stringify(value)})`);
  return value.startsWith('#') ? value.toUpperCase() : value;
}

function toPx(value) {
  if (typeof value === 'number') return value;
  const match = /^(-?\d*\.?\d+)(px|rem)?$/.exec(String(value).trim());
  if (!match) throw new Error(`not a px/rem length (${JSON.stringify(value)})`);
  const number = Number(match[1]);
  return match[2] === 'rem' ? number * 16 : number;
}

function toMs(value) {
  if (typeof value === 'number') return value;
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(String(value).trim());
  if (!match) throw new Error(`not a ms/s duration (${JSON.stringify(value)})`);
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
}

function formatShadowLayer(layer) {
  const lengths = [layer.offsetX, layer.offsetY, layer.blur, layer.spread].map((part) => (part === undefined ? 0 : toPx(part)));
  while (lengths.length > 2 && lengths[lengths.length - 1] === 0) lengths.pop();
  return `${layer.inset ? 'inset ' : ''}${lengths.map((n) => `${n}px`).join(' ')} ${formatColor(layer.color)}`;
}

function formatGradient(stops, ext) {
  const spec = isPlainObject(ext.gradient) ? ext.gradient : {};
  const colors = stops.map((stop) => formatColor(stop.color));
  const positions = stops.map((stop, index) => (stop.position === undefined ? index / (stops.length - 1) : stop.position));
  if (spec.kind === 'radial') return { shape: spec.shape, colors, stops: positions };
  const even = positions.every((position, index) => position === index / (positions.length - 1));
  const angle = Number(String(spec.angle === undefined ? '180deg' : spec.angle).replace(/deg$/, ''));
  if (!Number.isFinite(angle)) throw new Error(`gradient angle ${JSON.stringify(spec.angle)} is not in deg`);
  return even ? { angle, colors } : { angle, colors, stops: positions };
}

function formatNative(type, value, ext) {
  switch (type) {
    case 'color':
      return formatColor(value);
    case 'dimension':
      return toPx(value);
    case 'duration':
      return toMs(value);
    case 'number':
      return Number(value);
    case 'cubicBezier':
    case 'fontFamily':
      return Array.isArray(value) ? [...value] : value;
    case 'shadow':
      return (Array.isArray(value) ? value : [value]).map(formatShadowLayer).join(', ');
    case 'gradient':
      return formatGradient(value, ext);
    default:
      throw new Error(`no native format for $type ${type}`);
  }
}

function nodeAt(source, tokenPath) {
  return tokenPath.reduce((node, key) => node[key], source);
}

// The native value tree: { group: { name: value } }, source order, with "$version" / "$generated" on top.
function buildNativeTokens(source, generate) {
  const { tokens, errors } = generate(source);
  if (errors.length) throw new Error(`tokens.json is invalid:\n- ${errors.join('\n- ')}`);
  const byPath = new Map(tokens.map((token) => [token.path.join('.'), token]));
  const resolveRef = (value, where) => {
    const match = typeof value === 'string' && /^\{([^{}]+)\}$/.exec(value);
    if (!match) return value;
    if (!byPath.has(match[1])) throw new Error(`${where}: platform.native reference ${value} does not resolve`);
    return byPath.get(match[1]).value;
  };

  const out = {
    $generated: 'Do not edit. Run `npm run tokens` (scripts/tokens-native.js) from shared/gymido/design/tokens/tokens.json.',
    $version: source.$version,
  };
  for (const token of tokens) {
    if (!token.native) continue;
    const where = token.path.join('.');
    const node = nodeAt(source, token.path);
    const ext = isPlainObject(node.$extensions) && isPlainObject(node.$extensions.gymido) ? node.$extensions.gymido : {};
    const platform = isPlainObject(ext.platform) ? ext.platform : null;
    const raw = platform && Object.prototype.hasOwnProperty.call(platform, 'native') ? resolveRef(platform.native, where) : token.value;
    if (raw === null) continue;
    let value;
    try {
      value = formatNative(token.type, raw, ext);
    } catch (error) {
      throw new Error(`${where}: ${error.message}`);
    }
    let parent = out;
    token.path.slice(0, -1).forEach((key) => {
      parent[key] = parent[key] || {};
      parent = parent[key];
    });
    parent[token.path[token.path.length - 1]] = value;
  }
  return out;
}

const render = (tree) => `${JSON.stringify(tree, null, 2)}\n`;

function expectedOutput() {
  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const { generate } = require(CORE);
  return render(buildNativeTokens(source, generate));
}

function writeGenerated() {
  fs.writeFileSync(OUTPUT, expectedOutput());
  console.log(`tokens: wrote ${path.relative(ROOT, OUTPUT)}`);
}

function isStale() {
  return !fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== expectedOutput();
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    if (isStale()) {
      console.error('tokens: src/shared/theme/tokens.generated.json is stale; run npm run tokens');
      process.exit(1);
    }
    console.log('tokens: tokens.generated.json is up to date');
  } else {
    writeGenerated();
  }
}

module.exports = { buildNativeTokens, formatNative, render, expectedOutput, writeGenerated, isStale, SOURCE, CORE, OUTPUT };
