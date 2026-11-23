// ─── Daily, bonus and penalty quests ───────────────────────────────
import { lessonById } from '../content/catalog';
import type { LessonMeta } from '../content/schema';
import { currentRegion, discoverLesson, dueShadows, nextInRegion, type Derived, type Shadow } from './derive';
import { getDerived, getSaved, setQuestPick } from './store';
import type { QuestTag, Saved } from './types';

function pickDaily(d: Derived): { lesson: LessonMeta; kind: 'continue' | 'discover' } | null {
  // Stay in the region you're exploring until you choose to switch (or it runs out of open lessons).
  const cur = currentRegion(d);
  const cont = cur ? nextInRegion(d, cur) : null;
  if (cont) return { lesson: cont, kind: 'continue' };
  const disc = discoverLesson(d, cur ? [cur] : []) ?? discoverLesson(d);
  return disc ? { lesson: disc, kind: 'discover' } : null;
}

/** Choose today's quest once, so it stays the same all day (and on reload). */
export function ensureDailyQuest() {
  const d = getDerived();
  const saved = getSaved();
  const existing = saved.quests[d.today];
  if (existing && lessonById.has(existing.lesson)) return;
  const pick = pickDaily(d);
  if (pick) setQuestPick(d.today, pick.lesson.id, pick.kind);
}

export type BonusSuggestion = { type: 'review'; shadow: Shadow } | { type: 'lesson'; lesson: LessonMeta };

export interface QuestStatus {
  daily: { lesson: LessonMeta; kind: 'continue' | 'discover'; done: boolean } | null;
  dailyDone: boolean;
  bonus: { done: boolean; suggestion: BonusSuggestion | null } | null; // shown after the daily
  penalty: { restores: boolean } | null;
  penaltyDoneToday: boolean;
}

export function questStatus(saved: Saved, d: Derived): QuestStatus {
  const todays = saved.events.filter((e) => e.day === d.today);
  const dailyDone = todays.some((e) => 'quest' in e && e.quest === 'daily');
  const bonusDone = todays.some((e) => 'quest' in e && e.quest === 'bonus');
  const penaltyDoneToday = todays.some((e) => e.k === 'penalty');

  const pick = saved.quests[d.today];
  const meta = pick ? lessonById.get(pick.lesson) : undefined;
  const daily = meta ? { lesson: meta, kind: pick!.kind, done: dailyDone } : null;

  let bonus: QuestStatus['bonus'] = null;
  if (dailyDone) {
    const due = dueShadows(d)[0];
    const lesson = discoverLesson(d, meta ? [meta.region] : []);
    bonus = {
      done: bonusDone,
      suggestion: due ? { type: 'review', shadow: due } : lesson ? { type: 'lesson', lesson } : null,
    };
  }

  // Penalty (recap) quest: offered when you've missed at least one day and have something to recall.
  let penalty: QuestStatus['penalty'] = null;
  const gap = d.streak.gapBeforeToday;
  if (!penaltyDoneToday && gap !== null && gap >= 2 && d.lessonsDone > 0) {
    penalty = { restores: gap === 2 && d.streak.canForgive && d.streak.best > 0 };
  }
  return { daily, dailyDone, bonus, penalty, penaltyDoneToday };
}

/** Which quest (if any) a session completed right now counts towards. */
export function questTagFor(lessonId: string | null): QuestTag | undefined {
  const saved = getSaved();
  const d = getDerived();
  const s = questStatus(saved, d);
  if (lessonId && !s.dailyDone && saved.quests[d.today]?.lesson === lessonId) return 'daily';
  if (s.dailyDone && !s.bonus?.done) return 'bonus';
  return undefined;
}
