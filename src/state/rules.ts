// ─── All the game numbers live here, so they're easy to tune. ───────
import type { Result } from './types';

export const XP = {
  lessonBase: (level: number) => 40 + 20 * (level - 1),
  check: { got: 20, mostly: 15, lost: 15 } as Record<Result, number>,
  explained: 15,
  reread: 20,
  daily: 50,
  bonus: 30,
  penalty: 40,
  review: 20,
  gate: 150,
};

export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof RANKS)[number];

export const HUNTER_THRESHOLDS = [0, 1000, 3500, 8000, 16000, 28000];
export const REGION_THRESHOLDS = [0, 150, 400, 800, 1400, 2200];

export interface RankInfo {
  rank: Rank;
  index: number;
  sub: number; // Lv. 1–10 within the rank
  xp: number;
  floor: number; // xp where this rank starts
  next: number | null; // xp where the next rank starts
  progress: number; // 0–1 towards next rank
}

export function rankFor(xp: number, thresholds: number[]): RankInfo {
  let i = 0;
  while (i + 1 < thresholds.length && xp >= thresholds[i + 1]) i++;
  const floor = thresholds[i];
  const next = i + 1 < thresholds.length ? thresholds[i + 1] : null;
  const span = next === null ? Math.max(thresholds[i] - thresholds[i - 1], 1) : next - floor;
  const raw = (xp - floor) / span;
  const progress = next === null ? raw - Math.floor(raw) : Math.min(raw, 1);
  const sub = next === null ? Math.min(10, 1 + Math.floor(raw * 10)) : Math.min(10, 1 + Math.floor(raw * 10));
  return { rank: RANKS[i], index: i, sub, xp, floor, next, progress };
}

/** Adaptive level: two "Got it"s in a row raise the region level. */
export const GOT_RUN_TO_LEVEL_UP = 2;
/** Region level drops only if this many of the last RECENT_WINDOW checks were "Lost me". */
export const LOST_TO_LEVEL_DOWN = 2;
export const RECENT_WINDOW = 4;
export const MAX_LEVEL = 5;

/** Shadow re-summon intervals (days) for stage 0, 1, 2. Stage 3 = Commander. */
export const REVIEW_INTERVALS = [3, 10, 30];

/** A gate opens after this many lessons at its tier (or all of them, if fewer exist). */
export const GATE_LESSONS_NEEDED = 4;

/** A missed day can be forgiven by a Penalty Quest at most once per this many days. */
export const FORGIVE_COOLDOWN_DAYS = 7;
