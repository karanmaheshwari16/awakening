#!/usr/bin/env node
// Checks every lesson and gate file against the schema.
// Usage:  npm run validate        (errors + warnings)
//         npm run stats           (also prints counts per region)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content');
const showStats = process.argv.includes('--stats');

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const BLOCK_TYPES = new Set(['text', 'callout', 'keypoints', 'reveal', 'steps', 'diagram']);
const TONES = new Set(['analogy', 'definition', 'note', 'caution', 'open-question', 'example']);
const ROLES = new Set(['hook', 'core', 'example', 'why']);
const DISCLAIMERS = new Set(['health', 'legal', 'financial']);
const WORDS_MIN = 800;
const WORDS_MAX = 2300;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const words = (s) => (s.match(/[A-Za-z0-9’'-]+/g) || []).length;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    err(path.relative(root, file), `invalid JSON (${e.message})`);
    return null;
  }
}

// ─── Regions ─────────────────────────────────────────
const regionsFile = path.join(contentDir, 'regions.json');
const regionsData = readJson(regionsFile);
const regions = new Map();
if (regionsData) {
  if (!Number.isInteger(regionsData.unlock_every_sessions) || regionsData.unlock_every_sessions < 1)
    err('regions.json', 'unlock_every_sessions must be a positive integer');
  for (const r of regionsData.regions ?? []) {
    if (!/^[a-z0-9-]+$/.test(r.id ?? '')) err('regions.json', `bad region id "${r.id}"`);
    if (regions.has(r.id)) err('regions.json', `duplicate region id "${r.id}"`);
    if (!isStr(r.name) || !isStr(r.blurb)) err('regions.json', `${r.id}: needs name and blurb`);
    if (!Array.isArray(r.pos) || r.pos.length !== 2 || r.pos.some((n) => typeof n !== 'number' || n < 0 || n > 100))
      err('regions.json', `${r.id}: pos must be [x, y] in 0–100`);
    if (!Number.isInteger(r.unlock) || r.unlock < 1) err('regions.json', `${r.id}: unlock must be an integer ≥ 1`);
    const topics = new Set();
    for (const t of r.topics ?? []) {
      if (!/^[a-z0-9-]+$/.test(t.id ?? '')) err('regions.json', `${r.id}: bad topic id "${t.id}"`);
      if (topics.has(t.id)) err('regions.json', `${r.id}: duplicate topic "${t.id}"`);
      if (!isStr(t.title)) err('regions.json', `${r.id}/${t.id}: needs a title`);
      topics.add(t.id);
    }
    regions.set(r.id, { ...r, topicIds: topics });
  }
  for (const [a, b] of regionsData.links ?? []) {
    if (!regions.has(a) || !regions.has(b)) err('regions.json', `link [${a}, ${b}] refers to an unknown region`);
  }
}

// ─── SVG safety ──────────────────────────────────────
function checkSvg(file, svg) {
  if (!/^\s*<svg[\s>]/.test(svg)) err(file, 'diagram.svg must start with <svg');
  if (/<script|<foreignObject|<iframe|<image|<use/i.test(svg)) err(file, 'diagram.svg contains a disallowed element');
  if (/\son[a-z]+\s*=/i.test(svg)) err(file, 'diagram.svg contains an event handler attribute');
  if (/(href|src)\s*=|url\(\s*['"]?(https?:|data:|javascript:)/i.test(svg)) err(file, 'diagram.svg must not reference external resources');
  if (!/viewBox=/.test(svg)) warn(file, 'diagram.svg has no viewBox (it may not scale well)');
}

// ─── Lessons ─────────────────────────────────────────
const lessons = new Map();
const lessonsDir = path.join(contentDir, 'lessons');
const files = [];
for (const dir of fs.existsSync(lessonsDir) ? fs.readdirSync(lessonsDir) : []) {
  const full = path.join(lessonsDir, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  for (const f of fs.readdirSync(full)) if (f.endsWith('.json')) files.push(path.join(full, f));
}

for (const full of files) {
  const file = path.relative(root, full);
  const l = readJson(full);
  if (!l) continue;
  const folder = path.basename(path.dirname(full));
  const base = path.basename(full, '.json');

  for (const k of ['id', 'region', 'topic', 'title']) if (!isStr(l[k])) err(file, `missing "${k}"`);
  if (l.id !== base) err(file, `id "${l.id}" must match the filename`);
  if (l.region !== folder) err(file, `region "${l.region}" must match its folder "${folder}"`);
  if (!Number.isInteger(l.level) || l.level < 1 || l.level > 5) err(file, 'level must be an integer 1–5');
  const expectedId = `${l.region}.${l.topic}.${l.level}${l.bridge ? 'b' : ''}`;
  if (l.id !== expectedId) err(file, `id should be "${expectedId}" (region.topic.level${l.bridge ? ' + b for bridge' : ''})`);
  const region = regions.get(l.region);
  if (!region) err(file, `unknown region "${l.region}"`);
  else if (!region.topicIds.has(l.topic)) err(file, `topic "${l.topic}" isn't listed under ${l.region} in regions.json`);
  if (!Array.isArray(l.prerequisites)) err(file, 'prerequisites must be an array (use [] for none)');
  if (typeof l.estimated_minutes !== 'number' || l.estimated_minutes < 3 || l.estimated_minutes > 20)
    err(file, 'estimated_minutes must be a number between 3 and 20');
  if (l.disclaimer != null && !DISCLAIMERS.has(l.disclaimer)) err(file, `disclaimer must be one of ${[...DISCLAIMERS].join(', ')} or null`);
  if (!isStr(l.check?.explain_prompt)) err(file, 'check.explain_prompt is required');
  if (l.bridge !== undefined && typeof l.bridge !== 'boolean') err(file, 'bridge must be true/false');

  let text = '';
  let keypoints = 0;
  if (!Array.isArray(l.blocks) || l.blocks.length === 0) err(file, 'blocks must be a non-empty array');
  (l.blocks ?? []).forEach((b, i) => {
    const at = `blocks[${i}]`;
    if (!BLOCK_TYPES.has(b?.type)) return err(file, `${at}: unknown block type "${b?.type}"`);
    switch (b.type) {
      case 'text':
        if (!isStr(b.md)) err(file, `${at}: text needs md`);
        if (b.role && !ROLES.has(b.role)) err(file, `${at}: role must be one of ${[...ROLES].join(', ')}`);
        text += ' ' + (b.md ?? '') + ' ' + (b.heading ?? '');
        break;
      case 'callout':
        if (!TONES.has(b.tone)) err(file, `${at}: callout tone must be one of ${[...TONES].join(', ')}`);
        if (!isStr(b.md)) err(file, `${at}: callout needs md`);
        text += ' ' + (b.md ?? '') + ' ' + (b.title ?? '');
        break;
      case 'keypoints':
        keypoints++;
        if (!Array.isArray(b.items) || b.items.length < 3 || !b.items.every(isStr)) err(file, `${at}: keypoints needs 3+ items`);
        text += ' ' + (b.items ?? []).join(' ');
        break;
      case 'reveal':
        if (!isStr(b.prompt) || !isStr(b.md)) err(file, `${at}: reveal needs prompt and md`);
        text += ' ' + (b.prompt ?? '') + ' ' + (b.md ?? '');
        break;
      case 'steps':
        if (!isStr(b.title) || !Array.isArray(b.items) || b.items.length < 2 || !b.items.every(isStr))
          err(file, `${at}: steps needs a title and 2+ items`);
        text += ' ' + (b.title ?? '') + ' ' + (b.items ?? []).join(' ');
        break;
      case 'diagram':
        if (!isStr(b.svg)) err(file, `${at}: diagram needs svg`);
        else checkSvg(file, b.svg);
        if (!isStr(b.alt)) err(file, `${at}: diagram needs alt text (for screen readers)`);
        break;
    }
  });
  if (keypoints === 0) err(file, 'lesson needs a keypoints block (used by reviews and recall quests)');
  if (!(l.blocks ?? []).some((b) => b.type === 'text' && b.role === 'hook')) warn(file, 'no hook block (role: "hook")');
  if (!(l.blocks ?? []).some((b) => b.type === 'text' && b.role === 'why')) warn(file, 'no "why this matters" block (role: "why")');
  const w = words(text);
  if (!l.bridge && (w < WORDS_MIN || w > WORDS_MAX)) warn(file, `${w} words (target ${WORDS_MIN}–${WORDS_MAX})`);
  if (lessons.has(l.id)) err(file, `duplicate lesson id "${l.id}"`);
  lessons.set(l.id, { ...l, words: w, file });
}

for (const l of lessons.values()) {
  for (const p of l.prerequisites ?? []) if (!lessons.has(p)) err(l.file, `prerequisite "${p}" doesn't exist`);
  if (l.bridge && !lessons.has(l.id.slice(0, -1))) warn(l.file, `bridge for "${l.id.slice(0, -1)}", which doesn't exist`);
}

// ─── Gates ───────────────────────────────────────────
const gatesDir = path.join(contentDir, 'gates');
const gateIds = new Set();
let gateCount = 0;
for (const f of fs.existsSync(gatesDir) ? fs.readdirSync(gatesDir) : []) {
  if (!f.endsWith('.json')) continue;
  const file = `content/gates/${f}`;
  const data = readJson(path.join(gatesDir, f));
  if (!data) continue;
  for (const g of Array.isArray(data) ? data : [data]) {
    gateCount++;
    if (!isStr(g.id)) { err(file, 'gate missing id'); continue; }
    if (gateIds.has(g.id)) err(file, `duplicate gate id "${g.id}"`);
    gateIds.add(g.id);
    const region = regions.get(g.region);
    if (!region) err(file, `${g.id}: unknown region "${g.region}"`);
    if (g.id !== `${g.region}.gate.${g.tier}`) err(file, `${g.id}: id should be "${g.region}.gate.${g.tier}"`);
    if (!Number.isInteger(g.tier) || g.tier < 1 || g.tier > 4) err(file, `${g.id}: tier must be 1–4`);
    for (const k of ['title', 'question', 'model_answer']) if (!isStr(g[k])) err(file, `${g.id}: missing "${k}"`);
    if (!Array.isArray(g.key_points) || g.key_points.length < 2) err(file, `${g.id}: needs 2+ key_points`);
    if (!Array.isArray(g.links) || g.links.length < 1) err(file, `${g.id}: needs links (topic ids)`);
    for (const t of g.links ?? []) {
      if (region && !region.topicIds.has(t)) err(file, `${g.id}: link "${t}" isn't a topic of ${g.region}`);
      else if (![...lessons.values()].some((l) => l.region === g.region && l.topic === t && l.level <= g.tier))
        warn(file, `${g.id}: linked topic "${t}" has no Tier ≤${g.tier} lesson yet`);
    }
  }
}

// ─── Report ──────────────────────────────────────────
if (showStats) {
  console.log('\nRegion              Lessons  L1  L2  L3+  Words');
  for (const r of regions.values()) {
    const ls = [...lessons.values()].filter((l) => l.region === r.id);
    const by = (n) => ls.filter((l) => (n === 3 ? l.level >= 3 : l.level === n)).length;
    const w = ls.reduce((s, l) => s + l.words, 0);
    console.log(`${r.id.padEnd(20)}${String(ls.length).padStart(7)}${String(by(1)).padStart(4)}${String(by(2)).padStart(4)}${String(by(3)).padStart(5)}${String(w).padStart(7)}`);
  }
  console.log('');
}

for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
console.log(
  `\n${errors.length ? '✗' : '✓'} ${lessons.size} lessons, ${gateCount} gates, ${regions.size} regions — ${errors.length} error(s), ${warnings.length} warning(s)`,
);
process.exit(errors.length ? 1 : 0);
