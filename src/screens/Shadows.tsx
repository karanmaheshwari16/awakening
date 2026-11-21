import { useEffect, useState } from 'preact/hooks';
import { loadLesson, lessonsInTopic, regionById, topicKey, topicTitle } from '../content/catalog';
import type { Lesson } from '../content/schema';
import { BlockView } from '../components/Blocks';
import { Icon } from '../components/Icon';
import { showReward } from '../components/Reward';
import { Btn, Sys, TopBar } from '../components/ui';
import { go, href } from '../lib/router';
import { prettyDay } from '../lib/date';
import { dueShadows, type Shadow } from '../state/derive';
import { questTagFor } from '../state/quests';
import { addEvent, useGame } from '../state/store';
import type { Result } from '../state/types';

function Pips({ stage }: { stage: number }) {
  return (
    <span class="pips" aria-label={`${Math.min(stage, 3)} of 3 re-summons`}>
      {[0, 1, 2].map((i) => (
        <i class={i < stage ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Shadows() {
  const { d } = useGame();
  const due = dueShadows(d);
  const all = [...d.shadows.values()].sort((a, b) => (a.joinedDay < b.joinedDay ? 1 : -1));

  const card = (s: Shadow) => {
    const isDue = s.due !== null && s.due <= d.today;
    const commander = s.stage >= 3;
    return (
      <button class={`shadow-card ${isDue ? 'due' : ''} ${commander ? 'commander' : ''}`} onClick={() => go(href.review(s.key))}>
        <Icon name="shadows" class="shadow-glyph" size={30} />
        <b>{topicTitle(s.region, s.topic)}</b>
        <span>
          {regionById.get(s.region)?.name}
          <br />
          {commander ? 'Commander' : isDue ? 'Ready to re-summon' : `Next: ${prettyDay(s.due!)}`}
        </span>
        <Pips stage={s.stage} />
      </button>
    );
  };

  return (
    <>
      <h1 class="page-title">Shadow Army</h1>
      <p class="page-sub">
        Topics you've mastered rise as shadows. Re-summon them after 3, 10 and 30 days to keep them for good.
      </p>
      {all.length === 0 && (
        <Sys label="No shadows yet" as="div">
          <div class="empty" style={{ padding: '18px 8px' }}>
            <Icon name="shadows" size={32} />
            <p>Finish a lesson and answer “Got it”. The topic will rise as your first shadow.</p>
          </div>
        </Sys>
      )}
      {due.length > 0 && (
        <>
          <div class="section-title">
            <span class="label">[ Shadows to re-summon ]</span>
            <span class="label mono">{due.length}</span>
          </div>
          <div class="shadow-grid">{due.map(card)}</div>
        </>
      )}
      {all.length > 0 && (
        <>
          <div class="section-title">
            <span class="label">[ Your army ]</span>
            <span class="label mono">{all.length}</span>
          </div>
          <div class="shadow-grid">{all.map(card)}</div>
        </>
      )}
    </>
  );
}

export function ReviewScreen({ region, topic }: { region: string; topic: string }) {
  const { d } = useGame();
  const key = topicKey(region, topic);
  const shadow = d.shadows.get(key);
  const done = lessonsInTopic(region, topic).filter((l) => d.completed.has(l.id));
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all(done.map((l) => loadLesson(l.id))).then((ls) => setLessons(ls.filter(Boolean) as Lesson[]));
  }, [key]);

  if (!shadow)
    return (
      <>
        <TopBar fallback={href.shadows()} />
        <div class="empty">
          <p>This shadow hasn't risen yet.</p>
        </div>
      </>
    );

  const isDue = shadow.due !== null && shadow.due <= d.today;

  const submit = (result: Result) => {
    if (busy) return;
    setBusy(true);
    const quest = questTagFor(null);
    const outcome = addEvent({ k: 'review', topic: key, region, result, ...(quest === 'bonus' ? { quest } : {}) });
    const nextDue = dueShadows(outcome.after)[0];
    showReward({
      outcome,
      title: 'Shadow re-summoned',
      primary: nextDue ? { label: 'Next shadow', href: href.review(nextDue.key) } : { label: 'Back to the army', href: href.shadows() },
      secondary: { label: 'Back to the map', href: href.home() },
    });
  };

  return (
    <>
      <TopBar sub="Re-summon" title={topicTitle(region, topic)} fallback={href.shadows()} />
      <div class="lesson-head">
        <div class="lesson-eyebrow">
          <span class="label">{regionById.get(region)?.name}</span>
          <Pips stage={shadow.stage} />
        </div>
        <h1 class="lesson-title">{topicTitle(region, topic)}</h1>
        <p class="lesson-meta">
          Before each card, try to recall the idea yourself. Then read the key points and check yourself.
        </p>
      </div>
      {!lessons && <div class="loading">SUMMONING…</div>}
      <div class="prose">
        {lessons?.map((l) => (
          <section style={{ marginBottom: 28 }}>
            <h2 class="block-heading">{l.title}</h2>
            {l.blocks
              .filter((b) => b.type === 'keypoints' || b.type === 'reveal')
              .map((b) => (
                <BlockView block={b} />
              ))}
            <Btn variant="quiet" icon="book" onClick={() => go(href.lesson(l.id))}>
              Re-read the full lesson
            </Btn>
          </section>
        ))}
      </div>
      {isDue ? (
        <>
          <div class="section-title">
            <span class="label">How well did it come back?</span>
          </div>
          <div class="choices">
            <button class="choice choice-got" onClick={() => submit('got')} disabled={busy}>
              <Icon name="got" size={26} />
              <span><b>Got it</b><small>Came back clearly.</small></span>
            </button>
            <button class="choice choice-mostly" onClick={() => submit('mostly')} disabled={busy}>
              <Icon name="mostly" size={26} />
              <span><b>Mostly</b><small>Some of it came back.</small></span>
            </button>
            <button class="choice choice-lost" onClick={() => submit('lost')} disabled={busy}>
              <Icon name="lost" size={26} />
              <span><b>Lost me</b><small>It faded. I'll see it again sooner.</small></span>
            </button>
          </div>
        </>
      ) : (
        <Sys label={shadow.stage >= 3 ? 'Commander' : 'Resting'} as="div">
          <p class="quest-copy" style={{ margin: 0 }}>
            {shadow.stage >= 3
              ? 'This shadow is a Commander. It stays in your army for good. Re-read whenever you like.'
              : `This shadow can be re-summoned on ${prettyDay(shadow.due!)}. Spacing out reviews is what makes memories last.`}
          </p>
        </Sys>
      )}
    </>
  );
}
