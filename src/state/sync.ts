// ─── Automatic sync through a private GitHub Gist ──────────────────
//
// No server of our own: your progress file lives in a *secret gist* in your
// own GitHub account. Each device keeps its own copy and, whenever something
// changes (or the app is opened), it downloads the gist, merges it with the
// local copy (same union-of-events merge as Import & merge), and uploads the
// result if the gist was missing anything.
//
// The GitHub key is stored only on this device, never in backups.

import { atom } from '../lib/atom';
import type { Saved } from './types';
import { applyMerged, getSaved, mergeSaved, parseBackup, subscribe, type BackupFile } from './store';

const CFG_KEY = 'awakening:sync';
const FILE = 'awakening-progress.json';
const API = 'https://api.github.com';

export interface SyncConfig {
  token: string;
  login?: string;
  gistId?: string;
  lastSync?: number;
}

export type SyncStatus =
  | { state: 'off' }
  | { state: 'idle'; login?: string; lastSync?: number }
  | { state: 'syncing'; login?: string; lastSync?: number }
  | { state: 'offline'; login?: string; lastSync?: number }
  | { state: 'error'; login?: string; lastSync?: number; message: string };

function readCfg(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    const c = raw ? (JSON.parse(raw) as SyncConfig) : null;
    return c?.token ? c : null;
  } catch {
    return null;
  }
}
function writeCfg(c: SyncConfig | null) {
  if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c));
  else localStorage.removeItem(CFG_KEY);
}

let cfg = readCfg();
export const syncStatus = atom<SyncStatus>(cfg ? { state: 'idle', login: cfg.login, lastSync: cfg.lastSync } : { state: 'off' });

const base = () => ({ login: cfg?.login, lastSync: cfg?.lastSync });

class SyncError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

async function gh(path: string, init: RequestInit = {}, token = cfg?.token): Promise<any> {
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new SyncError('offline');
  }
  if (res.status === 401) throw new SyncError('GitHub rejected the key. It may have expired. Paste a new one.', 401);
  if (res.status === 403 || res.status === 404) {
    throw new SyncError(
      res.headers.get('x-ratelimit-remaining') === '0'
        ? 'GitHub says too many requests. Sync will retry later.'
        : "This key can't access gists. Create it again with the “gist” box ticked.",
      res.status,
    );
  }
  if (!res.ok) throw new SyncError(`GitHub error ${res.status}. Sync will retry later.`, res.status);
  return res.status === 204 ? null : res.json();
}

/** Only the parts that should travel between devices matter for "is anything missing?". */
function missingFrom(target: Saved, source: Saved): boolean {
  const ids = new Set(target.events.map((e) => e.id));
  if (source.events.some((e) => !ids.has(e.id))) return true;
  const newer = <T extends { t: number }>(a: Record<string, T> = {}, b: Record<string, T> = {}) =>
    Object.entries(b).some(([k, v]) => !a[k] || v.t > a[k].t);
  if (newer(target.notes, source.notes) || newer(target.gateNotes, source.gateNotes)) return true;
  return Object.keys(source.quests ?? {}).some((day) => !target.quests?.[day]);
}

function fileContent(data: Saved): string {
  const file: BackupFile = { app: 'awakening', exportedAt: Date.now(), data };
  return JSON.stringify(file);
}

async function findGist(): Promise<string | undefined> {
  for (let page = 1; page <= 10; page++) {
    const list = (await gh(`/gists?per_page=100&page=${page}`)) as { id: string; files: Record<string, unknown> }[];
    const hit = list.find((g) => g.files && FILE in g.files);
    if (hit) return hit.id;
    if (list.length < 100) return undefined;
  }
  return undefined;
}

async function readGist(id: string): Promise<Saved | null> {
  const g = await gh(`/gists/${id}`);
  const f = g?.files?.[FILE];
  if (!f) return null;
  let text: string = f.content;
  if (f.truncated && f.raw_url) {
    const res = await fetch(f.raw_url, { cache: 'no-store' });
    text = await res.text();
  }
  return parseBackup(text);
}

async function createGist(data: Saved): Promise<string> {
  const g = await gh('/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: 'Awakening progress (kept in sync by the app, please leave it here)',
      public: false,
      files: { [FILE]: { content: fileContent(data) } },
    }),
  });
  return g.id;
}

async function writeGist(id: string, data: Saved, keepalive = false) {
  const body = JSON.stringify({ files: { [FILE]: { content: fileContent(data) } } });
  // keepalive lets the upload finish while iOS is putting the app to sleep (limited to ~64 KB).
  await gh(`/gists/${id}`, { method: 'PATCH', body, keepalive: keepalive && body.length < 60000 });
}

// ─── The sync loop ─────────────────────────────────────────────────

let running: Promise<void> | null = null;
let again = false;
let lastUploadSig = '';
let applying = false;
const sig = (s: Saved) =>
  `${s.events.length}|${s.events[s.events.length - 1]?.id ?? ''}|${JSON.stringify(s.notes).length}|${JSON.stringify(s.gateNotes).length}|${Object.keys(s.quests).length}`;

export interface SyncResult {
  pulled: number;
}

let onPulled: ((n: number) => void) | null = null;
/** Called when sessions from another device arrive (used for a toast). */
export function onSyncPulled(fn: (n: number) => void) {
  onPulled = fn;
}

async function runOnce(opts: { keepalive?: boolean } = {}): Promise<SyncResult> {
  if (!cfg) return { pulled: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    syncStatus.set({ state: 'offline', ...base() });
    return { pulled: 0 };
  }
  syncStatus.set({ state: 'syncing', ...base() });
  let pulled = 0;
  try {
    let remote: Saved | null = null;
    if (cfg.gistId) {
      try {
        remote = await readGist(cfg.gistId);
      } catch (e) {
        // The gist was deleted on github.com: start a fresh one.
        if ((e as SyncError).status === 404) cfg = { ...cfg, gistId: undefined };
        else throw e;
      }
    }
    if (!cfg.gistId) {
      cfg.gistId = await findGist();
      if (cfg.gistId) remote = await readGist(cfg.gistId);
    }

    const local = getSaved();
    if (remote) {
      const merged = mergeSaved(local, remote);
      if (missingFrom(local, remote)) {
        pulled = merged.events.length - local.events.length;
        applying = true;
        try {
          applyMerged(merged);
        } finally {
          applying = false;
        }
      }
      if (missingFrom(remote, merged)) await writeGist(cfg.gistId!, merged, opts.keepalive);
    } else if (cfg.gistId) {
      await writeGist(cfg.gistId, local, opts.keepalive);
    } else {
      cfg.gistId = await createGist(local);
    }

    lastUploadSig = sig(getSaved());
    cfg = { ...cfg, lastSync: Date.now() };
    writeCfg(cfg);
    syncStatus.set({ state: 'idle', ...base() });
    if (pulled > 0) onPulled?.(pulled);
    return { pulled };
  } catch (e) {
    const err = e as SyncError;
    if (cfg) writeCfg(cfg);
    if (err.message === 'offline') syncStatus.set({ state: 'offline', ...base() });
    else syncStatus.set({ state: 'error', ...base(), message: err.message || 'Sync failed.' });
    throw err;
  }
}

/** Sync now. Safe to call often: overlapping calls are combined. */
export function syncNow(opts: { keepalive?: boolean } = {}): Promise<void> {
  if (!cfg) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await runOnce(opts).catch(() => undefined);
      } while (again && cfg);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Connect this device with a GitHub key: checks it, finds or creates the gist, and syncs. */
export async function connect(token: string): Promise<SyncResult> {
  token = token.trim();
  if (!token) throw new Error('Paste your GitHub key first.');
  let user: { login: string };
  try {
    user = await gh('/user', {}, token);
  } catch (e) {
    const err = e as SyncError;
    throw new Error(err.message === 'offline' ? "Couldn't reach GitHub. Check your internet connection." : err.message);
  }
  cfg = { token, login: user.login };
  writeCfg(cfg);
  try {
    return await runOnce();
  } catch (e) {
    const err = e as SyncError;
    // A bad key shouldn't stay saved.
    if (err.status === 401 || err.status === 403 || err.status === 404) disconnect();
    throw new Error(err.message === 'offline' ? "Couldn't reach GitHub. Check your internet connection." : err.message);
  }
}

/** Forget the key on this device. The gist (and other devices) are left alone. */
export function disconnect() {
  cfg = null;
  writeCfg(null);
  syncStatus.set({ state: 'off' });
}

/** After erasing progress: replace the gist's copy with this (empty) one. */
export async function overwriteRemote(): Promise<void> {
  if (!cfg?.gistId) return;
  try {
    await writeGist(cfg.gistId, getSaved());
    lastUploadSig = sig(getSaved());
  } catch {
    /* next sync will try again */
  }
}

export const isConnected = () => !!cfg;

// ─── When to sync ──────────────────────────────────────────────────

let debounce: number | undefined;
let started = false;

/** Start automatic syncing: on open, on return to the app, when back online, and shortly after progress changes. */
export function startAutoSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  setTimeout(() => void syncNow(), 800);
  document.addEventListener('visibilitychange', () => {
    if (!cfg) return;
    if (document.visibilityState === 'visible') void syncNow();
    else if (sig(getSaved()) !== lastUploadSig) {
      clearTimeout(debounce);
      void syncNow({ keepalive: true });
    }
  });
  window.addEventListener('online', () => void syncNow());
  subscribe(() => {
    if (!cfg || applying) return;
    if (sig(getSaved()) === lastUploadSig) return;
    if (running) {
      again = true; // picked up as soon as the current sync finishes
      return;
    }
    clearTimeout(debounce);
    debounce = window.setTimeout(() => void syncNow(), 2500);
  });
}
