// ─── Saving, loading, merging ──────────────────────────────────────
import { useEffect, useState } from 'preact/hooks';
import { dayOf, now, today } from '../lib/date';
import { derive, type Derived } from './derive';
import type { GameEvent, NewEvent, Saved, Settings } from './types';

const KEY = 'awakening:v1';

const DEFAULT_SETTINGS: Settings = { textSize: 'M', paper: false, motion: 'system' };

function fresh(): Saved {
  return {
    version: 1,
    deviceId: Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    counter: 0,
    events: [],
    notes: {},
    gateNotes: {},
    quests: {},
    settings: { ...DEFAULT_SETTINGS },
    seen: { regions: [], achievements: [] },
  };
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw) as Saved;
    // Fill in anything missing from older versions.
    const base = fresh();
    return { ...base, ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings }, seen: { ...base.seen, ...s.seen } };
  } catch {
    return fresh();
  }
}

let saved: Saved = load();
let derived: Derived = derive(saved);
let saveError: string | null = null;
const listeners = new Set<() => void>();

function commit(next: Saved, rederive = true) {
  saved = next;
  if (rederive) derived = derive(saved);
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
    saveError = null;
  } catch (err) {
    saveError = 'Could not save progress on this device. Export a backup to be safe.';
    console.error(err);
  }
  listeners.forEach((l) => l());
}

export const getSaved = () => saved;

/** Listen for any change to progress or settings. Returns an unsubscribe function. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const getDerived = () => derived;
export const getSaveError = () => saveError;

/** Re-derive (e.g. when the day changes while the app is open). */
export function refresh() {
  derived = derive(saved);
  listeners.forEach((l) => l());
}

export function useGame(): { saved: Saved; d: Derived } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  return { saved, d: derived };
}

export interface Outcome {
  before: Derived;
  after: Derived;
  event: GameEvent;
}

export function addEvent(e: NewEvent): Outcome {
  const before = derived;
  const t = now();
  const counter = saved.counter + 1;
  const event = { ...e, id: `${saved.deviceId}-${counter}`, t, day: dayOf(t) } as GameEvent;
  commit({ ...saved, counter, events: [...saved.events, event] });
  return { before, after: derived, event };
}

export function setNote(lessonId: string, text: string) {
  const notes = { ...saved.notes };
  if (text.trim()) notes[lessonId] = { text, t: now() };
  else delete notes[lessonId];
  commit({ ...saved, notes }, false);
}

export function setGateNote(gateId: string, text: string, covered?: number[]) {
  commit({ ...saved, gateNotes: { ...saved.gateNotes, [gateId]: { text, t: now(), covered } } }, false);
}

export function setQuestPick(day: string, lesson: string, kind: 'continue' | 'discover') {
  if (saved.quests[day]) return;
  commit({ ...saved, quests: { ...saved.quests, [day]: { lesson, kind } } }, false);
}

export function setSettings(patch: Partial<Settings>) {
  commit({ ...saved, settings: { ...saved.settings, ...patch } }, false);
}

export function markSeen(kind: 'regions' | 'achievements', ids: string[]) {
  const set = new Set(saved.seen[kind]);
  const before = set.size;
  ids.forEach((id) => set.add(id));
  if (set.size === before) return;
  commit({ ...saved, seen: { ...saved.seen, [kind]: [...set] } }, false);
}

export function markIntroSeen() {
  commit({ ...saved, seen: { ...saved.seen, intro: true } }, false);
}

export function resetAll() {
  const s = fresh();
  s.settings = saved.settings;
  commit(s);
}

// ─── Backup & sync between devices ─────────────────────────────────

export interface BackupFile {
  app: 'awakening';
  exportedAt: number;
  data: Saved;
}

export function backupBlob(): { blob: Blob; filename: string } {
  const file: BackupFile = { app: 'awakening', exportedAt: Date.now(), data: saved };
  const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
  return { blob, filename: `awakening-backup-${today()}.json` };
}

export function parseBackup(text: string): Saved {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON. Pick an Awakening backup file.");
  }
  const f = parsed as Partial<BackupFile>;
  const s = f?.data as Saved | undefined;
  if (f?.app !== 'awakening' || !s || s.version !== 1 || !Array.isArray(s.events)) {
    throw new Error("That doesn't look like an Awakening backup.");
  }
  for (const e of s.events) {
    if (!e || typeof e.id !== 'string' || typeof e.t !== 'number' || typeof e.day !== 'string' || !e.k) {
      throw new Error('The backup contains damaged entries.');
    }
  }
  return s;
}

/** Merge another device's progress into this one. Nothing is lost or double-counted. */
export function mergeSaved(local: Saved, incoming: Saved): Saved {
  const byId = new Map<string, GameEvent>();
  for (const e of local.events) byId.set(e.id, e);
  for (const e of incoming.events) if (!byId.has(e.id)) byId.set(e.id, e);
  const newest = <T extends { t: number }>(a: Record<string, T>, b: Record<string, T>) => {
    const out: Record<string, T> = { ...a };
    for (const [k, v] of Object.entries(b ?? {})) if (!out[k] || v.t > out[k].t) out[k] = v;
    return out;
  };
  return {
    ...local,
    createdAt: Math.min(local.createdAt, incoming.createdAt ?? local.createdAt),
    events: [...byId.values()].sort((a, b) => a.t - b.t),
    notes: newest(local.notes, incoming.notes),
    gateNotes: newest(local.gateNotes, incoming.gateNotes),
    quests: { ...(incoming.quests ?? {}), ...local.quests },
  };
}

export function previewMerge(incoming: Saved): { merged: Saved; before: Derived; after: Derived; added: number } {
  const merged = mergeSaved(saved, incoming);
  return { merged, before: derived, after: derive(merged), added: merged.events.length - saved.events.length };
}

export function applyMerged(merged: Saved) {
  commit(merged);
}

/** Ask the browser not to clear our storage under pressure (helps on iOS). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

// Recalculate when coming back to the app (the day may have changed).
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && derived.today !== today()) refresh();
  });
  // Another tab on the same device changed progress.
  window.addEventListener('storage', (ev) => {
    if (ev.key === KEY) {
      saved = load();
      refresh();
    }
  });
}
