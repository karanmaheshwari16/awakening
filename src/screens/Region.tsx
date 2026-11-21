import { gatesInRegion, lessonsInRegion, regionById } from '../content/catalog';
import { Icon } from '../components/Icon';
import { Bar, Btn, RankBadge, Sys, TopBar, roman } from '../components/ui';
import { go, href } from '../lib/router';
import { gateState, lessonAccess, nextInRegion } from '../state/derive';
import { REGION_THRESHOLDS } from '../state/rules';
import { useGame } from '../state/store';

const TIER_NAMES = ['', 'Foundations', 'Deeper', 'Advanced', 'Expert', 'Frontier'];

export function RegionScreen({ id }: { id: string }) {
  const { d } = useGame();
  const region = regionById.get(id);
  if (!region) return <NotFound />;
  const st = d.regions[id];
  const lessons = lessonsInRegion(id).filter((l) => !l.bridge);
  const next = nextInRegion(d, id);
  const gates = gatesInRegion(id);
  const maxTier = Math.max(0, ...lessons.map((l) => l.level));
  const withLessons = new Set(lessons.map((l) => l.topic));
  const uncharted = region.topics.filter((t) => !withLessons.has(t.id));
  const nextThreshold = REGION_THRESHOLDS[st.rank.index + 1];

  if (!d.unlocked.has(id)) {
    return (
      <>
        <TopBar />
        <div class="empty">
          <Icon name="lock" size={28} />
          <p>This region hasn't revealed itself yet. Keep completing sessions.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar sub="Region" title={region.name} />
      <div class="region-hero">
        <RankBadge rank={st.rank.rank} />
        <div>
          <h1>{region.name}</h1>
          <p class="region-blurb">{region.blurb}</p>
        </div>
      </div>
      <div class="region-stats">
        <span class="mono">LV.{st.level}</span>
        <Bar value={st.rank.progress} label="Region rank progress" />
        <span class="mono">
          {st.xp}
          {nextThreshold ? ` / ${nextThreshold}` : ''} XP
        </span>
      </div>

      {next && (
        <Sys label={st.bridge === next.id ? 'Bridge lesson' : 'Recommended next'} tone="accent" class="" as="div">
          <div class="quest-title" style={{ fontSize: 19 }}>{next.title}</div>
          <div class="quest-meta">
            <span class="mono">{next.estimated_minutes} MIN</span>
            <span class="mono">TIER {roman(next.level)}</span>
          </div>
          <Btn class="wide" icon="arrow" onClick={() => go(href.lesson(next.id))}>
            Begin
          </Btn>
        </Sys>
      )}

      {maxTier === 0 && (
        <div class="empty">
          <Icon name="sparkle" size={28} />
          <p>The first lessons for this region arrive with the next content wave.</p>
        </div>
      )}

      {Array.from({ length: maxTier }, (_, i) => i + 1).map((tier) => {
        const tierLessons = lessons.filter((l) => l.level === tier);
        const locked = tier > st.tier;
        const gate = gates.find((g) => g.tier === tier);
        const gs = gate ? gateState(d, gate) : null;
        return (
          <section class={`tier ${locked ? 'locked' : ''}`}>
            <div class="tier-head">
              <span class="label">
                Tier {roman(tier)} · {TIER_NAMES[tier]}
              </span>
              {locked && (
                <span class="chip">
                  <Icon name="lock" size={13} /> Clear Gate {roman(tier - 1)}
                </span>
              )}
            </div>
            {region.topics
              .filter((t) => tierLessons.some((l) => l.topic === t.id))
              .map((t) => (
                <div class="topic-block">
                  <div class="topic-name">{t.title}</div>
                  {tierLessons
                    .filter((l) => l.topic === t.id)
                    .map((l) => {
                      const acc = lessonAccess(d, l);
                      const isNext = next?.id === l.id;
                      return (
                        <button
                          class={`lesson-row ${acc} ${isNext ? 'next' : ''}`}
                          disabled={acc === 'locked'}
                          onClick={() => go(href.lesson(l.id))}
                        >
                          <div class="lr-main">
                            <div class="lr-title">{l.title}</div>
                            <div class="lr-meta">{l.estimated_minutes} min</div>
                          </div>
                          <div class="lr-state">
                            {acc === 'done' && <><Icon name="check" size={16} /> DONE</>}
                            {acc === 'open' && (isNext ? <><Icon name="arrow" size={16} /> NEXT</> : <Icon name="arrow" size={16} />)}
                            {acc === 'locked' && <><Icon name="lock" size={16} /> LOCKED</>}
                          </div>
                        </button>
                      );
                    })}
                </div>
              ))}
            {gate && gs && (
              <button class={`gate-row ${gs.status}`} onClick={() => go(href.gate(gate.id))} disabled={gs.status === 'future'}>
                <Icon name="gates" size={22} />
                <div class="lr-main">
                  <div class="lr-title">Gate {roman(tier)}: {gate.title}</div>
                  <div class="lr-meta">
                    {gs.status === 'cleared' && 'Cleared'}
                    {gs.status === 'open' && 'The Gate is open. Enter when ready.'}
                    {gs.status === 'sealed' && `Sealed: complete ${gs.needed - gs.done} more Tier ${roman(tier)} lesson${gs.needed - gs.done === 1 ? '' : 's'}`}
                    {gs.status === 'future' && 'Beyond your current tier'}
                  </div>
                </div>
              </button>
            )}
          </section>
        );
      })}

      {uncharted.length > 0 && (
        <div class="uncharted">
          <div class="label">Uncharted · arriving in future waves</div>
          <ul>
            {uncharted.map((t) => (
              <li>{t.title}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function NotFound() {
  return (
    <>
      <TopBar />
      <div class="empty">
        <p>That page doesn't exist.</p>
      </div>
    </>
  );
}
