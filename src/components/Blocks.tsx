import { useState } from 'preact/hooks';
import type { Block } from '../content/schema';
import { Md } from '../lib/md';
import { Icon } from './Icon';

const TONE: Record<string, { icon: string; label: string }> = {
  analogy: { icon: 'analogy', label: 'Think of it like this' },
  definition: { icon: 'definition', label: 'Definition' },
  note: { icon: 'info', label: 'Note' },
  caution: { icon: 'caution', label: 'Careful' },
  'open-question': { icon: 'question', label: 'Open question' },
  example: { icon: 'example', label: 'Example' },
};

const ROLE_HEADINGS: Record<string, string> = {
  core: 'The core idea',
  example: 'Worked example',
  why: 'Why this matters',
};

export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'text': {
      const heading = block.heading ?? (block.role ? ROLE_HEADINGS[block.role] : undefined);
      return (
        <div class={`block ${block.role === 'hook' ? 'hook' : ''}`}>
          {heading && <h2 class="block-heading">{heading}</h2>}
          <Md text={block.md} />
        </div>
      );
    }
    case 'callout': {
      const t = TONE[block.tone] ?? TONE.note;
      return (
        <aside class={`block callout callout-${block.tone}`}>
          <div class="callout-head">
            <Icon name={t.icon} size={16} />
            {block.title ?? t.label}
          </div>
          <Md text={block.md} />
        </aside>
      );
    }
    case 'keypoints':
      return (
        <section class="block keypoints" aria-label="Key points">
          <div class="sys-label">[ {block.title ?? 'Key points'} ]</div>
          <ul>
            {block.items.map((it) => (
              <li>
                <Icon name="check" size={16} />
                <span>
                  <Md text={it} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      );
    case 'reveal':
      return <Reveal prompt={block.prompt} md={block.md} />;
    case 'steps':
      return <Steps title={block.title} items={block.items} />;
    case 'diagram':
      return (
        <figure class="diagram">
          {/* SVG is authored with the lessons and checked by the validator (no scripts). */}
          <div class="diagram-box" role="img" aria-label={block.alt} dangerouslySetInnerHTML={{ __html: block.svg }} />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
  }
}

function Reveal({ prompt, md }: { prompt: string; md: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div class="block reveal">
      <button class="reveal-q" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span class="reveal-text">
          <span>{prompt}</span>
          <small>{open ? 'Tap to hide' : 'Think about it first, then tap to reveal'}</small>
        </span>
        <span class={`reveal-plus ${open ? 'open' : ''}`} aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div class="reveal-a">
          <Md text={md} />
        </div>
      )}
    </div>
  );
}

function Steps({ title, items }: { title: string; items: string[] }) {
  const [shown, setShown] = useState(1);
  const all = shown >= items.length;
  return (
    <div class="block steps">
      <div class="steps-title">{title}</div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-live="polite">
        {items.slice(0, shown).map((it, i) => (
          <li class="step">
            <span class="step-n">{i + 1}</span>
            <div>
              <Md text={it} />
            </div>
          </li>
        ))}
      </ol>
      <div class="steps-foot">
        <span class="mono">
          STEP {Math.min(shown, items.length)} / {items.length}
        </span>
        {!all ? (
          <button class="btn btn-ghost" onClick={() => setShown(shown + 1)}>
            Next step
          </button>
        ) : (
          <button class="btn btn-quiet" onClick={() => setShown(1)}>
            Replay
          </button>
        )}
      </div>
    </div>
  );
}
