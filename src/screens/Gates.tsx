import { useState } from 'preact/hooks';
import { catalog, gateById, regionById, topicTitle } from '../content/catalog';
import { Icon } from '../components/Icon';
import { showReward } from '../components/Reward';
import { Btn, Sys, TopBar, roman } from '../components/ui';
import { Md } from '../lib/md';
import { go, href } from '../lib/router';
import { gateState, type GateState } from '../state/derive';
import { addEvent, getSaved, setGateNote, useGame } from '../state/store';

const STATUS_TEXT: Record<GateState['status'], string> = {
  cleared: 'Cleared',
  open: 'Open: enter when ready',
  sealed: 'Sealed',
  future: 'Beyond your current tier',
};

export function Gates() {
  const { d } = useGame();
  const states = catalog.gates.filter((g) => d.unlocked.has(g.region)).map((g) => gateState(d, g));
  const open = states.filter((s) => s.status === 'open');
  const rest = states.filter((s) => s.status !== 'open');

  const card = (s: GateState) => (
    <button class={`gate-card ${s.status}`} onClick={() => go(href.gate(s.gate.id))} disabled={s.status === 'future'}>
      <Icon name={s.status === 'cleared' ? 'check' : s.status === 'open' ? 'gates' : 'lock'} size={24} />
      <div class="gc-main">
        <b>{s.gate.title}</b>
        <span>
          {regionById.get(s.gate.region)?.name} · Gate {roman(s.gate.tier)} ·{' '}
          {s.status === 'sealed' ? `${s.done}/${s.needed} Tier ${roman(s.gate.tier)} lessons` : STATUS_TEXT[s.status]}
        </span>
      </div>
    </button>
  );

  return (
    <>
      <h1 class="page-title">Gates</h1>
      <p class="page-sub">
        At the end of each tier, a Gate asks you to connect what you've learned. Write your answer, then compare it
        with the System's. No scores: you judge yourself. Clearing a Gate opens the next tier.
      </p>
      {states.length === 0 && (
        <div class="empty">
          <Icon name="gates" size={32} />
          <p>No Gates have appeared in your revealed regions yet.</p>
        </div>
      )}
      {open.length > 0 && (
        <>
          <div class="section-title"><span class="label">[ Open gates ]</span></div>
          <div class="gate-list">{open.map(card)}</div>
        </>
      )}
      {rest.length > 0 && (
        <>
          <div class="section-title"><span class="label">[ All gates ]</span></div>
          <div class="gate-list">{rest.map(card)}</div>
        </>
      )}
    </>
  );
}

export function GateScreen({ id }: { id: string }) {
  const { d } = useGame();
  const gate = gateById.get(id);
  const note = getSaved().gateNotes[id];
  const [text, setText] = useState(note?.text ?? '');
  const [revealed, setRevealed] = useState(!!note?.covered || (gate ? d.gatesCleared.has(gate.id) : false));
  const [covered, setCovered] = useState<number[]>(note?.covered ?? []);

  if (!gate) return <TopBar fallback={href.gates()} />;
  const s = gateState(d, gate);
  const cleared = s.status === 'cleared';

  if (s.status === 'sealed' || s.status === 'future')
    return (
      <>
        <TopBar sub="Gate" title={gate.title} fallback={href.gates()} />
        <Sys label={`Gate ${roman(gate.tier)} · Sealed`} as="div">
          <h1 class="quest-title">{gate.title}</h1>
          <p class="quest-copy">
            {s.status === 'future'
              ? 'This Gate lies beyond your current tier.'
              : `Complete ${s.needed - s.done} more Tier ${roman(gate.tier)} lesson${s.needed - s.done === 1 ? '' : 's'} in ${regionById.get(gate.region)?.name} to open it.`}
          </p>
          <Btn variant="ghost" onClick={() => go(href.region(gate.region))}>
            Go to region
          </Btn>
        </Sys>
      </>
    );

  const toggle = (i: number) => {
    const next = covered.includes(i) ? covered.filter((x) => x !== i) : [...covered, i];
    setCovered(next);
    setGateNote(id, text, next);
  };

  const clear = () => {
    setGateNote(id, text, covered);
    const outcome = addEvent({ k: 'gate', gate: id, region: gate.region, tier: gate.tier, covered: covered.length, total: gate.key_points.length });
    showReward({
      outcome,
      title: 'Gate cleared',
      primary: { label: `Enter Tier ${roman(gate.tier + 1)}`, href: href.region(gate.region) },
      secondary: { label: 'Back to the map', href: href.home() },
    });
  };

  return (
    <>
      <TopBar sub={`Gate ${roman(gate.tier)} · ${regionById.get(gate.region)?.name}`} title={gate.title} fallback={href.gates()} />
      <Sys label={cleared ? 'Gate cleared' : 'A Gate has opened'} tone="gold">
        <h1 class="quest-title">{gate.title}</h1>
        <div class="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {gate.links.map((t) => (
            <span class="chip">{topicTitle(gate.region, t)}</span>
          ))}
        </div>
        <p class="gate-q">{gate.question}</p>
        <label class="sr-only" for="gate-answer">Your answer</label>
        <textarea
          id="gate-answer"
          class="field"
          style={{ minHeight: 180 }}
          placeholder="Write your answer. A few sentences is plenty."
          value={text}
          readOnly={revealed}
          onInput={(e) => {
            const v = (e.target as HTMLTextAreaElement).value;
            setText(v);
            setGateNote(id, v);
          }}
        />
        {!revealed && (
          <Btn class="wide" style={{ marginTop: 12 }} disabled={text.trim().length < 10} onClick={() => { setGateNote(id, text, []); setRevealed(true); }}>
            Seal my answer &amp; reveal the System's
          </Btn>
        )}
      </Sys>

      {revealed && (
        <>
          <div class="section-title"><span class="label">[ The System's answer ]</span></div>
          <div class="prose block">
            <Md text={gate.model_answer} />
          </div>
          <div class="section-title"><span class="label">[ Which key points did you cover? ]</span></div>
          <ul class="covered">
            {gate.key_points.map((k, i) => (
              <li>
                <button role="checkbox" aria-checked={covered.includes(i)} onClick={() => !cleared && toggle(i)}>
                  <span class="box">{covered.includes(i) && <Icon name="check" size={14} />}</span>
                  <span>{k}</span>
                </button>
              </li>
            ))}
          </ul>
          <p class="field-note" style={{ marginTop: 10 }}>
            This is self-assessment, not a test. Missing points are simply what to look at next.
          </p>
          {!cleared && (
            <Btn class="wide" variant="gold" style={{ marginTop: 16 }} icon="gates" onClick={clear}>
              Clear the Gate
            </Btn>
          )}
        </>
      )}
    </>
  );
}
