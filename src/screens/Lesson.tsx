import { useEffect, useState } from 'preact/hooks';
import { loadLesson, regionById, topicTitle } from '../content/catalog';
import type { Lesson } from '../content/schema';
import { BlockView } from '../components/Blocks';
import { Icon } from '../components/Icon';
import { ReadingSheet } from '../components/ReadingSheet';
import { Btn, TopBar, roman } from '../components/ui';
import { go, href } from '../lib/router';
import { lessonAccess } from '../state/derive';
import { lessonById } from '../content/catalog';
import { useGame } from '../state/store';

export const DISCLAIMERS = {
  health: 'This is general education, not medical advice. For personal health questions, talk to a qualified professional.',
  legal: 'This is general education, not legal advice. Laws differ between countries and change over time.',
  financial: 'This is general education, not financial advice. Your own situation and local rules matter.',
} as const;

export function useLesson(id: string) {
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    loadLesson(id).then((l) => alive && setLesson(l));
    return () => void (alive = false);
  }, [id]);
  return lesson;
}

function useReadProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const f = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - innerHeight;
        setP(max > 0 ? Math.min(1, scrollY / max) : 0);
      });
    };
    addEventListener('scroll', f, { passive: true });
    f();
    return () => removeEventListener('scroll', f);
  }, []);
  return p;
}

export function LessonScreen({ id }: { id: string }) {
  const { d } = useGame();
  const lesson = useLesson(id);
  const [sheet, setSheet] = useState(false);
  const progress = useReadProgress();
  const meta = lessonById.get(id);
  const access = meta ? lessonAccess(d, meta) : 'locked';

  if (lesson === undefined) return <div class="loading">LOADING…</div>;
  if (lesson === null || !meta)
    return (
      <>
        <TopBar />
        <div class="empty">
          <p>This lesson couldn't be found.</p>
        </div>
      </>
    );

  if (access === 'locked')
    return (
      <>
        <TopBar fallback={href.region(lesson.region)} />
        <div class="empty">
          <Icon name="lock" size={28} />
          <p>This lesson is beyond your current tier. Clear the Gate in {regionById.get(lesson.region)?.name} first.</p>
        </div>
      </>
    );

  const done = access === 'done';
  return (
    <>
      <div class="read-progress" aria-hidden="true">
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <TopBar
        fallback={href.region(lesson.region)}
        sub={regionById.get(lesson.region)?.name}
        right={
          <button class="icon-btn" onClick={() => setSheet(true)} aria-label="Reading settings">
            <Icon name="text" size={22} />
          </button>
        }
      />
      <article>
        <header class="lesson-head">
          <div class="lesson-eyebrow">
            <span class="label">{topicTitle(lesson.region, lesson.topic)}</span>
            {lesson.bridge && <span class="chip chip-accent">Bridge</span>}
            {done && <span class="chip chip-ok"><Icon name="check" size={12} /> Completed</span>}
          </div>
          <h1 class="lesson-title">{lesson.title}</h1>
          <div class="lesson-meta mono">
            {lesson.estimated_minutes} MIN · TIER {roman(lesson.level)}
          </div>
        </header>
        <div class="prose">
          {lesson.blocks.map((b) => (
            <BlockView block={b} />
          ))}
          {lesson.disclaimer && (
            <p class="disclaimer">
              <Icon name="info" size={16} />
              <span>{DISCLAIMERS[lesson.disclaimer]}</span>
            </p>
          )}
        </div>
        <div class="lesson-end">
          <Btn glow={progress > 0.9} icon="arrow" onClick={() => go(href.check(lesson.id))}>
            {done ? 'Check in again' : "I've read it: check my understanding"}
          </Btn>
        </div>
      </article>
      <ReadingSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  );
}
