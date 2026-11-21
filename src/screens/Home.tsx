import { regionById, topicTitle } from '../content/catalog';
import { Icon } from '../components/Icon';
import { StarMap } from '../components/StarMap';
import { Bar, Btn, RankBadge, Sys, pad, roman } from '../components/ui';
import { go, href } from '../lib/router';
import { discoverLesson, dueShadows } from '../state/derive';
import { questStatus } from '../state/quests';
import { useGame } from '../state/store';

export function Home() {
  const { saved, d } = useGame();
  const q = questStatus(saved, d);
  const due = dueShadows(d);
  const explore = discoverLesson(d, q.daily ? [q.daily.lesson.region] : []);
  const streakOn = d.streak.status === 'active';
  const glowPenalty = !!q.penalty;

  return (
    <div class="home">
      <div class="home-side">
        {/* ── Hunter HUD ── */}
        <div class="hud">
          <RankBadge rank={d.rank.rank} />
          <div class="hud-main">
            <div class="hud-line">
              <span class="hud-title">{d.rank.rank}-Rank Hunter</span>
              <span class="hud-xp mono">LV.{d.rank.sub}</span>
            </div>
            <Bar value={d.rank.progress} label="Progress to next rank" />
            <div class="hud-sub mono">
              {d.xp.toLocaleString()}
              {d.rank.next ? ` / ${d.rank.next.toLocaleString()}` : ''} XP
              {!q.dailyDone && q.daily && <span class="accent"> · Quest waiting</span>}
            </div>
          </div>
          <div class={`hud-streak ${streakOn ? 'on' : ''}`} aria-label={`Streak: ${d.streak.current} days`}>
            <b>{pad(d.streak.current)}</b>
            <small>STREAK</small>
          </div>
        </div>

        {/* ── Penalty / return quest ── */}
        {q.penalty && (
          <Sys label={q.penalty.restores ? 'Penalty Quest' : 'Return Quest'} tone="accent">
            <p class="quest-copy">
              {q.penalty.restores
                ? 'The System noticed a gap. A short 5-minute recall will restore your streak, Hunter.'
                : 'Welcome back, Hunter. The gates are still open. Warm up with a 5-minute recall of what you already know.'}
            </p>
            <Btn class="wide" glow icon="recall" onClick={() => go(href.penalty())}>
              Begin recall · 5 min
            </Btn>
          </Sys>
        )}

        {/* ── Daily quest ── */}
        <Sys label="Daily Quest" tone={q.dailyDone ? 'default' : 'accent'}>
          {!q.daily && (
            <p class="quest-copy">
              Every open path is complete for now. Clear a Gate or wait for the next wave of lessons.
            </p>
          )}
          {q.daily && !q.dailyDone && (
            <>
              <div class="label">{q.daily.kind === 'continue' ? 'Continue your path' : 'Discover'}</div>
              <div class="quest-title">{q.daily.lesson.title}</div>
              <div class="quest-meta">
                <span>{regionById.get(q.daily.lesson.region)?.name}</span>
                <span class="mono">{q.daily.lesson.estimated_minutes} MIN</span>
                <span class="mono">TIER {roman(q.daily.lesson.level)}</span>
              </div>
              <Btn
                class="wide"
                glow={!glowPenalty}
                variant={glowPenalty ? 'ghost' : 'primary'}
                icon="arrow"
                onClick={() => go(href.lesson(q.daily!.lesson.id))}
              >
                Accept quest
              </Btn>
            </>
          )}
          {q.daily && q.dailyDone && (
            <>
              <div class="quest-done">
                <Icon name="check" /> Cleared today: {q.daily.lesson.title}
              </div>
              {q.bonus && !q.bonus.done && q.bonus.suggestion && (
                <div style={{ marginTop: 14 }}>
                  <div class="label">Bonus quest · optional</div>
                  <div class="quest-title" style={{ fontSize: 18 }}>
                    {q.bonus.suggestion.type === 'review'
                      ? `Re-summon: ${topicTitle(q.bonus.suggestion.shadow.region, q.bonus.suggestion.shadow.topic)}`
                      : q.bonus.suggestion.lesson.title}
                  </div>
                  <Btn
                    variant="ghost"
                    class="wide"
                    onClick={() => {
                      const s = q.bonus!.suggestion!;
                      go(s.type === 'review' ? href.review(s.shadow.key) : href.lesson(s.lesson.id));
                    }}
                  >
                    Take the bonus
                  </Btn>
                </div>
              )}
              {q.bonus?.done && <p class="quest-copy" style={{ marginTop: 10, marginBottom: 0 }}>Bonus cleared too. Rest well, Hunter.</p>}
            </>
          )}
        </Sys>

        <div class="mini-cards">
          <button class="mini" onClick={() => go(href.shadows())}>
            <b>{due.length ? `${due.length} shadow${due.length > 1 ? 's' : ''} stirring` : 'Shadow Army'}</b>
            <span>{due.length ? 'Ready to re-summon' : `${d.shadows.size} raised`}</span>
          </button>
          <button class="mini" disabled={!explore} onClick={() => explore && go(href.lesson(explore.id))}>
            <b>Explore something new</b>
            <span>{explore ? regionById.get(explore.region)?.name : 'Nothing new yet'}</span>
          </button>
        </div>
      </div>

      {/* ── The map ── */}
      <div class="map-wrap">
        <div class="map-head">
          <span class="label">[ Knowledge Map ]</span>
          <span class="label mono">
            {pad(d.unlocked.size)}/{pad(regionById.size)} regions
          </span>
        </div>
        <StarMap d={d} saved={saved} questRegion={!q.dailyDone ? q.daily?.lesson.region : undefined} />
        <div class="map-foot">
          <span>
            {d.nextUnlock
              ? `Next region reveals in ${d.nextUnlock.sessionsLeft} session${d.nextUnlock.sessionsLeft === 1 ? '' : 's'}`
              : 'Every region revealed'}
          </span>
          <span class="mono">{d.lessonsDone} LESSONS</span>
        </div>
      </div>
    </div>
  );
}
