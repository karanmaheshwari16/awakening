import { useEffect, useState } from 'preact/hooks';
import { loadLesson, regionById } from '../content/catalog';
import type { Lesson } from '../content/schema';
import { Icon } from '../components/Icon';
import { showReward } from '../components/Reward';
import { Btn, Sys, TopBar } from '../components/ui';
import { Md } from '../lib/md';
import { dayNum } from '../lib/date';
import { href } from '../lib/router';
import { questStatus } from '../state/quests';
import { addEvent, useGame } from '../state/store';

/** A 5-minute recall of 2–3 lessons you've already completed. */
export function PenaltyScreen() {
  const { saved, d } = useGame();
  const q = questStatus(saved, d);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Pick up to 3 completed lessons from different topics, varied by day.
    const done = [...d.completed.keys()];
    const seed = dayNum(d.today);
    const picked: string[] = [];
    const topics = new Set<string>();
    for (let i = 0; i < done.length && picked.length < 3; i++) {
      const id = done[(seed + i * 7) % done.length];
      const topic = id.split('.').slice(0, 2).join('.');
      if (picked.includes(id) || topics.has(topic)) continue;
      picked.push(id);
      topics.add(topic);
    }
    Promise.all(picked.map(loadLesson)).then((ls) => setLessons(ls.filter(Boolean) as Lesson[]));
  }, [d.today]);

  if (!q.penalty && !q.penaltyDoneToday)
    return (
      <>
        <TopBar />
        <div class="empty"><p>No recall quest is waiting. You're on track.</p></div>
      </>
    );

  const finish = () => {
    const outcome = addEvent({ k: 'penalty' });
    showReward({ outcome, title: 'Penalty Quest complete', primary: { label: 'Back to the map', href: href.home() } });
  };

  return (
    <>
      <TopBar sub={q.penalty?.restores ? 'Penalty Quest' : 'Return Quest'} title="Recall" />
      <div class="lesson-head">
        <span class="label">[ {q.penalty?.restores ? 'Penalty Quest' : 'Return Quest'} ]</span>
        <h1 class="lesson-title">Bring it back</h1>
        <p class="lesson-meta">
          For each card, pause and try to remember the main ideas. Then reveal them. About 5 minutes.
        </p>
      </div>
      {!lessons && <div class="loading">PREPARING…</div>}
      <div class="prose" style={{ display: 'grid', gap: 14 }}>
        {lessons?.map((l, i) => {
          const kp = l.blocks.find((b) => b.type === 'keypoints');
          const open = shown.has(i);
          return (
            <Sys label={regionById.get(l.region)?.name} as="div">
              <div class="quest-title" style={{ fontSize: 19 }}>{l.title}</div>
              {!open ? (
                <Btn variant="ghost" class="wide" onClick={() => setShown(new Set([...shown, i]))}>
                  I've tried to recall it: reveal
                </Btn>
              ) : (
                kp?.type === 'keypoints' && (
                  <ul class="keypoints" style={{ listStyle: 'none', margin: 0 }}>
                    {kp.items.map((it) => (
                      <li><Icon name="check" size={16} /><span><Md text={it} /></span></li>
                    ))}
                  </ul>
                )
              )}
            </Sys>
          );
        })}
      </div>
      {lessons && (
        <div class="lesson-end">
          <Btn glow={shown.size >= lessons.length} disabled={shown.size < lessons.length || q.penaltyDoneToday} onClick={finish} icon="recall">
            {q.penaltyDoneToday ? 'Completed today' : 'Recall complete'}
          </Btn>
        </div>
      )}
    </>
  );
}
