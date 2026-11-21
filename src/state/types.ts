export type Result = 'got' | 'mostly' | 'lost';
export type QuestTag = 'daily' | 'bonus';

interface Base {
  id: string; // unique: deviceId + counter → safe to merge across devices
  t: number; // timestamp (ms)
  day: string; // local day "YYYY-MM-DD"
}

export interface LessonEvent extends Base {
  k: 'lesson';
  lesson: string;
  region: string;
  topic: string;
  level: number;
  result: Result;
  explained: boolean;
  quest?: QuestTag;
}
export interface PenaltyEvent extends Base {
  k: 'penalty';
}
export interface ReviewEvent extends Base {
  k: 'review';
  topic: string; // topic key "region/topic"
  region: string;
  result: Result;
  quest?: QuestTag;
}
export interface GateEvent extends Base {
  k: 'gate';
  gate: string;
  region: string;
  tier: number;
  covered: number;
  total: number;
}
export type GameEvent = LessonEvent | PenaltyEvent | ReviewEvent | GateEvent;
// Distributive Omit so each event shape keeps its own fields.
export type NewEvent = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'id' | 't' | 'day'> : never) : never;

export interface Settings {
  textSize: 'S' | 'M' | 'L' | 'XL';
  paper: boolean;
  motion: 'system' | 'reduce';
}

export interface Saved {
  version: 1;
  deviceId: string;
  createdAt: number;
  counter: number;
  events: GameEvent[];
  /** Your own-words explanations per lesson (newest wins on merge). */
  notes: Record<string, { text: string; t: number }>;
  /** Gate answers (newest wins on merge). */
  gateNotes: Record<string, { text: string; t: number; covered?: number[] }>;
  /** The daily quest chosen for each day. */
  quests: Record<string, { lesson: string; kind: 'continue' | 'discover' }>;
  /** Device-only: reading settings and what's already been "seen" (for NEW badges). */
  settings: Settings;
  seen: { regions: string[]; achievements: string[]; intro?: boolean };
}
