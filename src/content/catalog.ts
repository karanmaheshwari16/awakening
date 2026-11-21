import raw from 'virtual:catalog';
import type { Catalog, Gate, Lesson, LessonMeta, Region } from './schema';

const levelSort = (a: LessonMeta, b: LessonMeta) =>
  a.level - b.level || Number(b.bridge) - Number(a.bridge) || a.id.localeCompare(b.id);

export const catalog: Catalog = {
  unlock_every_sessions: raw.regions.unlock_every_sessions,
  regions: raw.regions.regions,
  links: raw.regions.links,
  lessons: [...raw.lessons].sort(levelSort),
  gates: [...raw.gates].sort((a, b) => a.tier - b.tier),
};

export const regionById = new Map<string, Region>(catalog.regions.map((r) => [r.id, r]));
export const lessonById = new Map<string, LessonMeta>(catalog.lessons.map((l) => [l.id, l]));
export const gateById = new Map<string, Gate>(catalog.gates.map((g) => [g.id, g]));

export function lessonsInRegion(regionId: string): LessonMeta[] {
  return catalog.lessons.filter((l) => l.region === regionId);
}

export function lessonsInTopic(regionId: string, topicId: string): LessonMeta[] {
  return catalog.lessons.filter((l) => l.region === regionId && l.topic === topicId);
}

export function topicTitle(regionId: string, topicId: string): string {
  return regionById.get(regionId)?.topics.find((t) => t.id === topicId)?.title ?? topicId;
}

/** Topic key used for shadows and topic-level adaptation: "region/topic". */
export const topicKey = (region: string, topic: string) => `${region}/${topic}`;

export function gatesInRegion(regionId: string): Gate[] {
  return catalog.gates.filter((g) => g.region === regionId);
}

// Full lessons are separate files, loaded on demand (and precached for offline use).
const loaders = import.meta.glob<Lesson>('/content/lessons/**/*.json', { import: 'default' });
const byId = new Map<string, () => Promise<Lesson>>();
for (const [path, load] of Object.entries(loaders)) {
  const id = path.split('/').pop()!.replace(/\.json$/, '');
  byId.set(id, load);
}
const cache = new Map<string, Lesson>();

export async function loadLesson(id: string): Promise<Lesson | null> {
  if (cache.has(id)) return cache.get(id)!;
  const load = byId.get(id);
  if (!load) return null;
  const lesson = await load();
  cache.set(id, lesson);
  return lesson;
}
