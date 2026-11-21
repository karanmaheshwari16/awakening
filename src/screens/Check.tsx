import { useState } from 'preact/hooks';
import { lessonById } from '../content/catalog';
import { Icon } from '../components/Icon';
import { showReward } from '../components/Reward';
import { Sys, TopBar } from '../components/ui';
import { href } from '../lib/router';
import { nextInRegion } from '../state/derive';
import { questTagFor } from '../state/quests';
import { addEvent, getSaved, setNote, useGame } from '../state/store';
import type { Result } from '../state/types';
import { useLesson } from './Lesson';

const CHOICES: { result: Result; label: string; desc: string; icon: string }[] = [
  { result: 'got', label: 'Got it', desc: 'I could explain this to a friend.', icon: 'got' },
  { result: 'mostly', label: 'Mostly', desc: 'The gist is clear, some parts are fuzzy.', icon: 'mostly' },
  { result: 'lost', label: 'Lost me', desc: 'I need a gentler way in. That’s fine.', icon: 'lost' },
];

export function CheckScreen({ id }: { id: string }) {
  useGame();
  const lesson = useLesson(id);
  const meta = lessonById.get(id);
  const [text, setText] = useState(() => getSaved().notes[id]?.text ?? '');
  const [busy, setBusy] = useState(false);

  if (lesson === undefined) return <div class="loading">LOADING…</div>;
  if (!lesson || !meta) return <TopBar />;

  const submit = (result: Result) => {
    if (busy) return;
    setBusy(true);
    setNote(id, text);
    const quest = questTagFor(id);
    const outcome = addEvent({
      k: 'lesson',
      lesson: id,
      region: meta.region,
      topic: meta.topic,
      level: meta.level,
      result,
      explained: text.trim().length >= 20,
      ...(quest ? { quest } : {}),
    });
    const next = nextInRegion(outcome.after, meta.region);
    showReward({
      outcome,
      title: quest === 'daily' ? 'Daily Quest complete' : 'Session complete',
      primary: next ? { label: `Next: ${next.title}`, href: href.lesson(next.id) } : { label: 'Back to the map', href: href.home() },
      secondary: next ? { label: 'Back to the map', href: href.home() } : { label: 'View region', href: href.region(meta.region) },
    });
  };

  return (
    <>
      <TopBar sub="Understanding check" title={lesson.title} fallback={href.lesson(id)} />
      <Sys label="Understanding Check" tone="accent">
        <p class="check-prompt">{lesson.check.explain_prompt}</p>
        <label class="sr-only" for="explain">
          Your explanation (optional)
        </label>
        <textarea
          id="explain"
          class="field"
          placeholder="Explain it in your own words… (optional, saved only on this device)"
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        />
        <div class="field-note">Writing it down is the fastest way to find the fuzzy parts. +15 XP for a real attempt.</div>
      </Sys>

      <div class="section-title">
        <span class="label">How did that land?</span>
      </div>
      <div class="choices">
        {CHOICES.map((c) => (
          <button class={`choice choice-${c.result}`} onClick={() => submit(c.result)} disabled={busy}>
            <Icon name={c.icon} size={26} />
            <span>
              <b>{c.label}</b>
              <small>{c.desc}</small>
            </span>
          </button>
        ))}
      </div>
      <p class="field-note" style={{ marginTop: 14 }}>
        There are no wrong answers here. The System uses this to choose what comes next for you.
      </p>
    </>
  );
}
