// ─── Content schema ────────────────────────────────────────────────
// These types describe the lesson files in /content. The validator
// (scripts/validate.mjs) enforces the same rules on every file.

export type Level = 1 | 2 | 3 | 4 | 5;

export type Block =
  | { type: 'text'; md: string; heading?: string; role?: 'hook' | 'core' | 'example' | 'why' }
  | { type: 'callout'; tone: CalloutTone; title?: string; md: string }
  | { type: 'keypoints'; title?: string; items: string[] }
  | { type: 'reveal'; prompt: string; md: string }
  | { type: 'steps'; title: string; items: string[] }
  | { type: 'diagram'; svg: string; caption?: string; alt: string };

export type CalloutTone = 'analogy' | 'definition' | 'note' | 'caution' | 'open-question' | 'example';

export type Disclaimer = 'health' | 'legal' | 'financial';

export interface Lesson {
  id: string;
  region: string;
  topic: string;
  level: Level;
  bridge?: boolean;
  prerequisites: string[];
  title: string;
  estimated_minutes: number;
  disclaimer?: Disclaimer | null;
  blocks: Block[];
  check: { explain_prompt: string };
}

/** Lightweight lesson info, available instantly for every lesson. */
export interface LessonMeta {
  id: string;
  region: string;
  topic: string;
  level: Level;
  bridge: boolean;
  title: string;
  estimated_minutes: number;
  prerequisites: string[];
}

export interface Topic {
  id: string;
  title: string;
}

export interface Region {
  id: string;
  name: string;
  blurb: string;
  pos: [number, number];
  unlock: number;
  topics: Topic[];
}

export interface Gate {
  id: string;
  region: string;
  tier: number; // clearing it opens tier + 1
  title: string;
  question: string;
  links: string[]; // topic ids within the region
  model_answer: string; // markdown
  key_points: string[];
}

export interface Catalog {
  unlock_every_sessions: number;
  regions: Region[];
  links: [string, string][];
  lessons: LessonMeta[];
  gates: Gate[];
}
