import { catalog } from '../content/catalog';
import { Icon } from '../components/Icon';
import { Bar, RankBadge, Sys } from '../components/ui';
import { go, href } from '../lib/router';
import { prettyDay } from '../lib/date';
import { ACHIEVEMENTS } from '../state/achievements';
import { unlockOrder } from '../state/derive';
import { REGION_THRESHOLDS } from '../state/rules';
import { useGame } from '../state/store';

export function Hunter() {
  const { d } = useGame();
  const order = unlockOrder();
  const regions = [...catalog.regions].sort((a, b) => {
    const ua = d.unlocked.has(a.id) ? 0 : 1;
    const ub = d.unlocked.has(b.id) ? 0 : 1;
    return ua - ub || d.regions[b.id].xp - d.regions[a.id].xp || order.indexOf(a.id) - order.indexOf(b.id);
  });
  const commanders = [...d.shadows.values()].filter((s) => s.stage >= 3).length;

  return (
    <>
      <div class="row" style={{ justifyContent: 'space-between', margin: '4px 0 12px' }}>
        <h1 class="page-title" style={{ margin: 0 }}>Hunter</h1>
        <button class="icon-btn" aria-label="Settings" onClick={() => go(href.settings())}>
          <Icon name="settings" size={22} />
        </button>
      </div>

      <div class="hunter-grid">
        <div style={{ display: 'grid', gap: 16 }}>
          <Sys label="Status" tone="accent">
            <div class="hunter-hero">
              <RankBadge rank={d.rank.rank} size="lg" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1>{d.rank.rank}-Rank Hunter</h1>
                <div class="muted mono" style={{ fontSize: 13 }}>LV.{d.rank.sub} · {d.xp.toLocaleString()} XP</div>
                <Bar value={d.rank.progress} label="Progress to next rank" />
                <div class="muted" style={{ fontSize: 13 }}>
                  {d.rank.next ? `${(d.rank.next - d.xp).toLocaleString()} XP to ${'EDCBAS'[d.rank.index + 1]}-Rank` : 'The highest rank. Keep exploring.'}
                </div>
              </div>
            </div>
          </Sys>

          <div class="stat-grid">
            <div class="stat"><b>{d.lessonsDone}</b><span>Lessons</span></div>
            <div class="stat"><b>{Math.round(d.minutes / 60 * 10) / 10}</b><span>Hours learned</span></div>
            <div class="stat"><b>{d.activeDays.size}</b><span>Active days</span></div>
            <div class="stat"><b>{d.streak.current}</b><span>Streak</span></div>
            <div class="stat"><b>{d.streak.best}</b><span>Best streak</span></div>
            <div class="stat"><b>{d.gatesCleared.size}</b><span>Gates</span></div>
            <div class="stat"><b>{d.shadows.size}</b><span>Shadows</span></div>
            <div class="stat"><b>{commanders}</b><span>Commanders</span></div>
            <div class="stat"><b>{d.explanations}</b><span>Explained</span></div>
          </div>

          <Sys label="Achievements" as="div">
            <div class="achv-grid">
              {ACHIEVEMENTS.map((a) => {
                const got = d.achievements.get(a.id);
                return (
                  <div class={`achv ${got ? 'got' : 'locked'}`}>
                    <b>
                      <Icon name={got ? 'star' : 'lock'} size={15} /> {a.name}
                    </b>
                    <span>{a.desc}</span>
                    {got && <span class="mono" style={{ fontSize: 11 }}>{prettyDay(got)}</span>}
                  </div>
                );
              })}
            </div>
          </Sys>
        </div>

        <Sys label="Regions" as="div">
          <div class="region-bars">
            {regions.map((r) => {
              const st = d.regions[r.id];
              const unlocked = d.unlocked.has(r.id);
              const next = REGION_THRESHOLDS[st.rank.index + 1];
              return (
                <button class="rb" disabled={!unlocked} onClick={() => go(href.region(r.id))}>
                  <span class={`rb-name ${unlocked ? '' : 'dim'}`}>{unlocked ? r.name : '[ ??? ]'}</span>
                  <span class="rb-val">
                    {unlocked ? `${st.rank.rank} · LV.${st.level} · ${st.xp}${next ? `/${next}` : ''}` : 'LOCKED'}
                  </span>
                  <Bar value={unlocked ? st.rank.progress : 0} label={`${r.name} rank progress`} />
                </button>
              );
            })}
          </div>
        </Sys>
      </div>
    </>
  );
}
