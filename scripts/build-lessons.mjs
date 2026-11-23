// Converts plain-text lesson sources (content/src/**/*.txt) into the JSON
// files the app reads (content/lessons/<region>/<id>.json).
//
// A source file can hold several lessons, each starting with a header:
//
//   ##### LESSON
//   id: physics.energy.2
//   title: Where Energy Goes
//   minutes: 14
//   disclaimer: health            (optional: health | legal | financial)
//   prereq: physics.energy.1      (optional, comma-separated)
//   check: In your own words: ...
//
// followed by blocks, each starting with a line beginning "=== ":
//
//   === hook | core | example | why        text block with that role
//   === text Heading                        text block with a heading
//   === callout analogy|definition|note|caution|open-question|example [| Title]
//   === keypoints [Title]                   list items start with "- "
//   === steps Title                         list items start with "- "
//   === reveal The question?                the rest is the answer
//   === diagram Alt text | Caption          the rest is the <svg>
//
// Run: node scripts/build-lessons.mjs

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'content');
const srcDir = path.join(root, 'src');
const outDir = path.join(root, 'lessons');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.txt') ? [p] : [];
  });
}

const listItems = (body) => {
  const items = [];
  for (const line of body.split('\n')) {
    if (line.startsWith('- ')) items.push(line.slice(2).trim());
    else if (line.trim() && items.length) items[items.length - 1] += ' ' + line.trim();
  }
  return items;
};

function parseLesson(chunk, file) {
  const lines = chunk.split('\n');
  const meta = {};
  let i = 0;
  for (; i < lines.length && !lines[i].startsWith('=== '); i++) {
    const m = lines[i].match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  const blocks = [];
  let head = null;
  let body = [];
  const flush = () => {
    if (!head) return;
    const text = body.join('\n').trim();
    const [kind, ...restParts] = head.split(' ');
    const rest = restParts.join(' ').trim();
    if (['hook', 'core', 'example', 'why'].includes(kind) && !rest) blocks.push({ type: 'text', role: kind, md: text });
    else if (kind === 'text') blocks.push({ type: 'text', ...(rest ? { heading: rest } : {}), md: text });
    else if (kind === 'callout') {
      const [tone, title] = rest.split('|').map((s) => s.trim());
      blocks.push({ type: 'callout', tone, ...(title ? { title } : {}), md: text });
    } else if (kind === 'keypoints') blocks.push({ type: 'keypoints', ...(rest ? { title: rest } : {}), items: listItems(text) });
    else if (kind === 'steps') blocks.push({ type: 'steps', title: rest, items: listItems(text) });
    else if (kind === 'reveal') blocks.push({ type: 'reveal', prompt: rest, md: text });
    else if (kind === 'diagram') {
      const [alt, caption] = rest.split('|').map((s) => s.trim());
      blocks.push({ type: 'diagram', alt, ...(caption ? { caption } : {}), svg: text.replace(/\s*\n\s*/g, ' ') });
    } else throw new Error(`${file} (${meta.id}): unknown block "=== ${head}"`);
    head = null;
    body = [];
  };
  for (; i < lines.length; i++) {
    if (lines[i].startsWith('=== ')) {
      flush();
      head = lines[i].slice(4).trim();
    } else body.push(lines[i]);
  }
  flush();

  const [region, topic, levelPart] = (meta.id ?? '').split('.');
  const bridge = /b$/.test(levelPart ?? '');
  const lesson = {
    id: meta.id,
    region,
    topic,
    level: parseInt(levelPart, 10),
    ...(bridge ? { bridge: true } : {}),
    prerequisites: meta.prereq ? meta.prereq.split(',').map((s) => s.trim()).filter(Boolean) : [],
    title: meta.title,
    estimated_minutes: Number(meta.minutes),
    disclaimer: meta.disclaimer || null,
    blocks,
    check: { explain_prompt: meta.check },
  };
  return lesson;
}

let count = 0;
for (const file of walk(srcDir)) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const chunks = text.split(/^##### LESSON\s*$/m).slice(1);
  for (const chunk of chunks) {
    const l = parseLesson(chunk, path.relative(process.cwd(), file));
    const dir = path.join(outDir, l.region);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${l.id}.json`), JSON.stringify(l, null, 2) + '\n');
    count++;
  }
}
console.log(`Built ${count} lesson(s) from content/src`);
