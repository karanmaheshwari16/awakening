import { useEffect, useMemo } from 'preact/hooks';
import { catalog, lessonsInRegion } from '../content/catalog';
import { go, href } from '../lib/router';
import type { Derived } from '../state/derive';
import { markSeen } from '../state/store';
import type { Saved } from '../state/types';
import { Ring, toast, useMedia } from './ui';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function StarMap({ d, saved, questRegion }: { d: Derived; saved: Saved; questRegion?: string }) {
  const landscape = useMedia('(min-width: 900px)');
  const W = landscape ? 400 : 300;
  const H = landscape ? 300 : 440;

  // Region position: authored for portrait; transposed for the wide laptop map.
  const pos = (p: [number, number]) => (landscape ? { x: 6 + p[1] * 0.88, y: p[0] } : { x: p[0], y: p[1] });

  const stars = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 110 }, (_, i) => ({
      x: r() * W, y: r() * H, s: r() < 0.08 ? 0.9 : 0.25 + r() * 0.45, o: 0.2 + r() * 0.5, tw: i % 9 === 0,
      delay: r() * 7,
    }));
  }, [W, H]);

  const seen = new Set(saved.seen.regions);
  const fresh = [...d.unlocked].filter((id) => !seen.has(id));
  useEffect(() => {
    if (!fresh.length) return;
    const t = setTimeout(() => markSeen('regions', fresh), 2500);
    return () => clearTimeout(t);
  }, [fresh.join()]);

  const byId = new Map(catalog.regions.map((r) => [r.id, r]));

  return (
    <div class={`map ${landscape ? 'landscape' : ''}`} role="group" aria-label="Knowledge map">
      <svg class="map-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {stars.map((s) => (
          <circle
            class={`star ${s.tw ? 'tw' : ''}`}
            cx={s.x}
            cy={s.y}
            r={s.s}
            opacity={s.o}
            style={s.tw ? { animationDelay: `${s.delay}s` } : undefined}
          />
        ))}
        {catalog.links.map(([a, b]) => {
          const ra = byId.get(a);
          const rb = byId.get(b);
          if (!ra || !rb) return null;
          const pa = pos(ra.pos);
          const pb = pos(rb.pos);
          const lit = d.unlocked.has(a) && d.unlocked.has(b);
          return (
            <line
              class={`link ${lit ? '' : 'dim'}`}
              x1={(pa.x / 100) * W}
              y1={(pa.y / 100) * H}
              x2={(pb.x / 100) * W}
              y2={(pb.y / 100) * H}
            />
          );
        })}
      </svg>

      {catalog.regions.map((r) => {
        const p = pos(r.pos);
        const unlocked = d.unlocked.has(r.id);
        const st = d.regions[r.id];
        const total = lessonsInRegion(r.id).filter((l) => !l.bridge).length;
        const prog = total ? [...st.completed].filter((id) => !id.endsWith('b')).length / total : 0;
        const cls = [
          'node',
          unlocked ? '' : 'locked',
          unlocked && st.xp > 0 ? 'touched' : '',
          unlocked && !seen.has(r.id) ? 'new' : '',
          questRegion === r.id ? 'quest' : '',
        ].join(' ');
        const onClick = () => {
          if (unlocked) go(href.region(r.id));
          else if (d.nextUnlock?.region === r.id)
            toast(`This region reveals itself in ${d.nextUnlock.sessionsLeft} more session${d.nextUnlock.sessionsLeft === 1 ? '' : 's'}.`);
          else toast('An unexplored region. Keep completing sessions to reveal it.');
        };
        return (
          <button
            class={cls}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onClick={onClick}
            aria-label={
              unlocked
                ? `${r.name}, rank ${st.rank.rank}, level ${st.level}, ${Math.round(prog * 100)}% explored`
                : 'Locked region'
            }
          >
            <span class="node-core">
              <Ring value={unlocked ? prog : 0} size={56} dim={!unlocked} />
              <span class="node-dot">{unlocked ? st.rank.rank : '?'}</span>
            </span>
            <span class="node-name">{unlocked ? r.name : '[ ??? ]'}</span>
          </button>
        );
      })}
    </div>
  );
}
