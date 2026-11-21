// ─── Derive everything from the event log ──────────────────────────
// XP, ranks, levels, streaks, shadows, gates and achievements are never
// stored directly. They are recalculated by replaying your events in order.
// That's what makes merging two devices safe: merge the logs, replay.

import { catalog, lessonById, lessonsInRegion, regionById, topicKey } from '../content/catalog';
import type { Gate, LessonMeta } from '../content/schema';
import { addDays, dayNum, today as todayFn } from '../lib/date';
import {
  FORGIVE_COOLDOWN_DAYS,
  GATE_LESSONS_NEEDED,
  GOT_RUN_TO_LEVEL_UP,
  HUNTER_THRESHOLDS,
  LOST_TO_LEVEL_DOWN,
  MAX_LEVEL,
  RECENT_WINDOW,
  REGION_THRESHOLDS,
  REVIEW_INTERVALS,
  XP,
  rankFor,
  type RankInfo,
} from './rules';
import type { GameEvent, Result, Saved } from './types';
import { ACHIEVEMENTS } from './achievements';

export interface RegionState {
  id: string;
  xp: number;
  level: number;
  gotRun: number;
  recent: Result[];
  tier: number; // highest lesson level you can open (gates raise it)
  rank: RankInfo;
  completed: Set<string>;
  sessions: number;
  lastT: number;
  bridge: string | null; // a gentler lesson queued after "Lost me"
}

export interface TopicState {
  cap: number | null; // level cap after "Lost me" (eases off), cleared by a "Got it"
  lost: boolean; // ever said "Lost me" (for Honest Hunter)
  last: Result | null;
}

export interface Shadow {
  key: string; // "region/topic"
  region: string;
  topic: string;
  joinedDay: string;
  stage: number; // 0–2 normal, 3 = Commander
  due: string | null;
}

export interface Derived {
  xp: number;
  rank: RankInfo;
  regions: Record<string, RegionState>;
  topics: Record<string, TopicState>;
  completed: Map<string, { firstDay: string; last: Result; reads: number }>;
  shadows: Map<string, Shadow>;
  gatesCleared: Map<string, string>; // gate id → day
  sessions: number;
  lessonsDone: number;
  minutes: number;
  explanations: number;
  activeDays: Set<string>;
  streak: {
    current: number;
    best: number;
    status: 'active' | 'pending' | 'penalty' | 'broken' | 'none';
    // active = done today · pending = done yesterday, today still open
    // penalty = missed exactly one day and a recap can restore it
    gapBeforeToday: number | null; // days since the last active day before today
    canForgive: boolean;
  };
  unlocked: Set<string>;
  nextUnlock: { region: string; sessionsLeft: number } | null;
  achievements: Map<string, string>; // id → day earned
  today: string;
}

function emptyRegion(id: string): RegionState {
  return {
    id, xp: 0, level: 1, gotRun: 0, recent: [], tier: 1,
    rank: rankFor(0, REGION_THRESHOLDS), completed: new Set(), sessions: 0, lastT: 0, bridge: null,
  };
}

/** Bridge after "Lost me": a dedicated "…b" lesson, else the level below in the same topic. */
function bridgeFor(lessonId: string): string | null {
  const meta = lessonById.get(lessonId);
  if (!meta) return null;
  if (!meta.bridge && lessonById.has(lessonId + 'b')) return lessonId + 'b';
  const lower = catalog.lessons.find(
    (l) => l.region === meta.region && l.topic === meta.topic && !l.bridge && l.level === meta.level - 1,
  );
  return lower ? lower.id : null;
}

export function unlockOrder(): string[] {
  return [...catalog.regions].sort((a, b) => a.unlock - b.unlock).map((r) => r.id);
}

export function derive(saved: Saved, today = todayFn()): Derived {
  const events = [...saved.events].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  const regions: Record<string, RegionState> = {};
  for (const r of catalog.regions) regions[r.id] = emptyRegion(r.id);
  const reg = (id: string) => (regions[id] ??= emptyRegion(id));
  const topics: Record<string, TopicState> = {};
  const top = (k: string) => (topics[k] ??= { cap: null, lost: false, last: null });

  const d: Derived = {
    xp: 0,
    rank: rankFor(0, HUNTER_THRESHOLDS),
    regions,
    topics,
    completed: new Map(),
    shadows: new Map(),
    gatesCleared: new Map(),
    sessions: 0,
    lessonsDone: 0,
    minutes: 0,
    explanations: 0,
    activeDays: new Set(),
    streak: { current: 0, best: 0, status: 'none', gapBeforeToday: null, canForgive: true },
    unlocked: new Set(),
    nextUnlock: null,
    achievements: new Map(),
    today,
  };
  const penaltyDays = new Set<string>();
  const ctx: AchievementCtx = { d, maxStreak: 0, lostThenGot: false, nightRead: false, penaltyDone: false };

  const award = (regionId: string | null, xp: number) => {
    d.xp += xp;
    if (regionId) reg(regionId).xp += xp;
  };

  for (const e of events) {
    d.activeDays.add(e.day);
    if (e.k === 'lesson') {
      const r = reg(e.region);
      const tk = topicKey(e.region, e.topic);
      const t = top(tk);
      const prev = d.completed.get(e.lesson);
      d.sessions++;
      r.sessions++;
      r.lastT = e.t;
      if (!prev) {
        award(e.region, XP.lessonBase(e.level) + XP.check[e.result] + (e.explained ? XP.explained : 0));
        d.completed.set(e.lesson, { firstDay: e.day, last: e.result, reads: 1 });
        r.completed.add(e.lesson);
        d.lessonsDone++;
        d.minutes += lessonById.get(e.lesson)?.estimated_minutes ?? 12;
      } else {
        award(e.region, XP.reread);
        prev.reads++;
        prev.last = e.result;
      }
      if (e.explained) d.explanations++;
      if (e.quest === 'daily') award(null, XP.daily);
      if (e.quest === 'bonus') award(null, XP.bonus);

      // ── adaptive level ──
      r.recent = [...r.recent, e.result].slice(-RECENT_WINDOW);
      if (e.result === 'got') {
        r.gotRun++;
        if (r.gotRun >= GOT_RUN_TO_LEVEL_UP) {
          if (r.level < MAX_LEVEL) r.level++;
          r.gotRun = 0;
        }
        if (t.lost) ctx.lostThenGot = true;
        t.cap = null;
        r.bridge = null;
        if (!d.shadows.has(tk)) {
          d.shadows.set(tk, {
            key: tk, region: e.region, topic: e.topic, joinedDay: e.day, stage: 0, due: addDays(e.day, REVIEW_INTERVALS[0]),
          });
        }
      } else if (e.result === 'lost') {
        r.gotRun = 0;
        t.lost = true;
        t.cap = Math.max(1, e.level - 1);
        const lostCount = r.recent.filter((x) => x === 'lost').length;
        if (lostCount >= LOST_TO_LEVEL_DOWN && r.level > 1) {
          r.level--; // never more than one level at a time
          r.recent = []; // smoothing: needs fresh evidence before another drop
        }
        const b = bridgeFor(e.lesson);
        r.bridge = b && b !== e.lesson ? b : null;
      } else if (r.bridge === e.lesson) {
        r.bridge = null; // bridge read with "Mostly" → back on the main path
      }
      t.last = e.result;
      const hour = new Date(e.t).getHours();
      if (hour >= 22 || hour < 4) ctx.nightRead = true;
    } else if (e.k === 'penalty') {
      penaltyDays.add(e.day);
      ctx.penaltyDone = true;
      d.sessions++;
      award(null, XP.penalty);
    } else if (e.k === 'review') {
      d.sessions++;
      award(e.region, XP.review + (e.quest === 'bonus' ? XP.bonus : 0));
      const s = d.shadows.get(e.topic);
      if (s) {
        if (e.result === 'lost') s.stage = Math.max(0, s.stage - 1);
        else s.stage = Math.min(3, s.stage + 1);
        s.due = s.stage >= 3 ? null : addDays(e.day, REVIEW_INTERVALS[s.stage]);
      }
    } else if (e.k === 'gate') {
      if (!d.gatesCleared.has(e.gate)) {
        d.gatesCleared.set(e.gate, e.day);
        award(e.region, XP.gate);
        const r = reg(e.region);
        r.tier = Math.max(r.tier, e.tier + 1);
      }
    }
    for (const r of Object.values(regions)) r.rank = rankFor(r.xp, REGION_THRESHOLDS);
    d.rank = rankFor(d.xp, HUNTER_THRESHOLDS);
    computeStreak(d, penaltyDays, e.day);
    ctx.maxStreak = Math.max(ctx.maxStreak, d.streak.best);
    computeUnlocks(d);
    checkAchievements(ctx, e.day);
  }

  computeStreak(d, penaltyDays, today);
  computeUnlocks(d);
  return d;
}

function computeStreak(d: Derived, penaltyDays: Set<string>, today: string) {
  const days = [...d.activeDays].filter((x) => x <= today).sort();
  let streak = 0;
  let best = 0;
  let prev: number | null = null;
  let lastForgiven = -Infinity;
  for (const day of days) {
    const n = dayNum(day);
    if (prev === null) streak = 1;
    else {
      const gap = n - prev;
      if (gap === 1) streak++;
      else if (gap === 2 && penaltyDays.has(day) && n - lastForgiven >= FORGIVE_COOLDOWN_DAYS) {
        streak++;
        lastForgiven = n;
      } else streak = 1;
    }
    best = Math.max(best, streak);
    prev = n;
  }
  const T = dayNum(today);
  let status: Derived['streak']['status'] = 'none';
  let current = 0;
  if (prev !== null) {
    const gap = T - prev;
    if (gap === 0) { status = 'active'; current = streak; }
    else if (gap === 1) { status = 'pending'; current = streak; }
    else if (gap === 2 && T - lastForgiven >= FORGIVE_COOLDOWN_DAYS) { status = 'penalty'; current = streak; }
    else { status = 'broken'; current = 0; }
  }
  const before = days.filter((x) => x < today);
  const gapBeforeToday = before.length ? T - dayNum(before[before.length - 1]) : null;
  d.streak = { current, best, status, gapBeforeToday, canForgive: T - lastForgiven >= FORGIVE_COOLDOWN_DAYS };
}

function computeUnlocks(d: Derived) {
  const order = unlockOrder();
  const per = catalog.unlock_every_sessions;
  const initial = order.filter((id) => regionById.get(id)!.unlock <= 1);
  const rest = order.filter((id) => regionById.get(id)!.unlock > 1);
  d.unlocked = new Set(initial);
  const lessonSessions = Object.values(d.regions).reduce((n, r) => n + r.sessions, 0);
  const count = Math.floor(lessonSessions / per);
  rest.slice(0, count).forEach((id) => d.unlocked.add(id));
  const next = rest[count];
  d.nextUnlock = next ? { region: next, sessionsLeft: (count + 1) * per - lessonSessions } : null;
}

// ─── Achievements ──────────────────────────────────────────────────
interface AchievementCtx {
  d: Derived;
  maxStreak: number;
  lostThenGot: boolean;
  nightRead: boolean;
  penaltyDone: boolean;
}

function checkAchievements(ctx: AchievementCtx, day: string) {
  for (const a of ACHIEVEMENTS) {
    if (ctx.d.achievements.has(a.id)) continue;
    if (achievementMet(a.id, ctx)) ctx.d.achievements.set(a.id, day);
  }
}

function achievementMet(id: string, c: AchievementCtx): boolean {
  const d = c.d;
  const regionsTouched = Object.values(d.regions).filter((r) => r.completed.size > 0).length;
  const commanders = [...d.shadows.values()].filter((s) => s.stage >= 3).length;
  switch (id) {
    case 'awakened': return d.lessonsDone >= 1;
    case 'streak-3': return c.maxStreak >= 3;
    case 'streak-7': return c.maxStreak >= 7;
    case 'streak-30': return c.maxStreak >= 30;
    case 'explorer': return regionsTouched >= 5;
    case 'polymath': return regionsTouched >= 10;
    case 'first-gate': return d.gatesCleared.size >= 1;
    case 'shadows-10': return d.shadows.size >= 10;
    case 'shadows-25': return d.shadows.size >= 25;
    case 'commander': return commanders >= 1;
    case 'honest': return c.lostThenGot;
    case 'scribe': return d.explanations >= 10;
    case 'night': return c.nightRead;
    case 'second-wind': return c.penaltyDone;
    case 'seasoned': return d.lessonsDone >= 25;
    case 'veteran': return d.lessonsDone >= 100;
    case 'sovereign': return Object.values(d.regions).some((r) => r.rank.rank === 'S');
    case 'rank-c': return d.rank.index >= 2;
    default: return false;
  }
}

// ─── Lesson access & recommendations ───────────────────────────────

export type LessonAccess = 'done' | 'open' | 'locked';

export function lessonAccess(d: Derived, l: LessonMeta): LessonAccess {
  if (d.completed.has(l.id)) return 'done';
  if (!d.unlocked.has(l.region)) return 'locked';
  return l.level <= d.regions[l.region].tier ? 'open' : 'locked';
}

/** Target difficulty for a region: your level, limited by the gates you've cleared. */
export function targetLevel(d: Derived, regionId: string): number {
  const r = d.regions[regionId];
  return Math.min(r.level, r.tier);
}

/** The next lesson the System recommends in a region (or null if you need a gate or new content). */
export function nextInRegion(d: Derived, regionId: string): LessonMeta | null {
  const r = d.regions[regionId];
  if (!d.unlocked.has(regionId)) return null;
  if (r.bridge && lessonById.has(r.bridge)) return lessonById.get(r.bridge)!;
  const region = regionById.get(regionId)!;
  const order = new Map(region.topics.map((t, i) => [t.id, i]));
  const target = targetLevel(d, regionId);
  const open = lessonsInRegion(regionId).filter((l) => !l.bridge && !d.completed.has(l.id) && l.level <= r.tier);
  const prereqsMet = (l: LessonMeta) => l.prerequisites.every((p) => d.completed.has(p) || !lessonById.has(p));
  const byPath = (a: LessonMeta, b: LessonMeta) =>
    a.level - b.level || (order.get(a.topic) ?? 99) - (order.get(b.topic) ?? 99);
  const ideal = open
    .filter((l) => {
      const cap = d.topics[topicKey(regionId, l.topic)]?.cap ?? 99;
      return l.level <= Math.min(target, cap) && prereqsMet(l);
    })
    .sort(byPath);
  if (ideal.length) return ideal[0];
  // Nothing at exactly your level yet → nearest available.
  const near = open.sort((a, b) => Math.abs(a.level - target) - Math.abs(b.level - target) || byPath(a, b));
  return near[0] ?? null;
}

/** The region you're "in": most recent activity among unlocked regions. */
export function currentRegion(d: Derived): string | null {
  const touched = Object.values(d.regions).filter((r) => r.lastT > 0 && d.unlocked.has(r.id));
  touched.sort((a, b) => b.lastT - a.lastT);
  return touched[0]?.id ?? null;
}

/** "Explore something new": the least-explored unlocked region that has a lesson ready. */
export function discoverLesson(d: Derived, exclude: string[] = []): LessonMeta | null {
  const order = unlockOrder();
  const candidates = [...d.unlocked]
    .filter((id) => !exclude.includes(id))
    .map((id) => ({ id, next: nextInRegion(d, id), xp: d.regions[id].xp }))
    .filter((c) => c.next)
    .sort((a, b) => a.xp - b.xp || order.indexOf(a.id) - order.indexOf(b.id));
  return candidates[0]?.next ?? null;
}

export interface GateState {
  gate: Gate;
  status: 'cleared' | 'open' | 'sealed' | 'future';
  done: number;
  needed: number;
}

export function gateState(d: Derived, g: Gate): GateState {
  const atTier = lessonsInRegion(g.region).filter((l) => l.level === g.tier && !l.bridge);
  const done = atTier.filter((l) => d.completed.has(l.id)).length;
  const needed = Math.min(GATE_LESSONS_NEEDED, atTier.length);
  if (d.gatesCleared.has(g.id)) return { gate: g, status: 'cleared', done, needed };
  const r = d.regions[g.region];
  if (!d.unlocked.has(g.region) || r.tier < g.tier) return { gate: g, status: 'future', done, needed };
  if (needed > 0 && done >= needed) return { gate: g, status: 'open', done, needed };
  return { gate: g, status: 'sealed', done, needed };
}

export function dueShadows(d: Derived): Shadow[] {
  return [...d.shadows.values()]
    .filter((s) => s.due !== null && s.due <= d.today)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1));
}

/** Events that make up today's sessions. */
export function todaysEvents(saved: Saved, day: string): GameEvent[] {
  return saved.events.filter((e) => e.day === day);
}
