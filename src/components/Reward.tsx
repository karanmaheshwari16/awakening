import { useEffect, useState } from 'preact/hooks';
import { lessonById, regionById, topicTitle } from '../content/catalog';
import { atom } from '../lib/atom';
import { swap } from '../lib/router';
import { achievementById } from '../state/achievements';
import type { Outcome } from '../state/store';
import { Icon } from './Icon';
import { Bar, Btn, Sys } from './ui';

export interface RewardData {
  outcome: Outcome;
  title: string;
  /** Small progress line under the actions, e.g. "Physics: 3 of 12 lessons explored". */
  note?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}

const rewardAtom = atom<RewardData | null>(null);
export const showReward = (r: RewardData) => rewardAtom.set(r);
export const hideReward = () => rewardAtom.get() && rewardAtom.set(null);

interface Line {
  tone: 'gold' | 'accent' | 'ok' | 'plain';
  icon: string;
  head: string;
  text: string;
}

function linesFor({ before, after, event }: Outcome): Line[] {
  const lines: Line[] = [];
  if ('quest' in event && event.quest === 'daily')
    lines.push({ tone: 'gold', icon: 'check', head: 'Quest complete', text: 'Daily Quest cleared. Streak secured for today.' });
  if ('quest' in event && event.quest === 'bonus')
    lines.push({ tone: 'gold', icon: 'star', head: 'Bonus quest', text: 'Extra effort recognised.' });
  if (event.k === 'penalty')
    lines.push({
      tone: 'ok', icon: 'recall', head: 'Recall complete',
      text: after.streak.current > 1 ? `Streak restored: ${after.streak.current} days.` : 'Knowledge refreshed. A new streak begins.',
    });

  if (after.rank.index > before.rank.index)
    lines.push({ tone: 'gold', icon: 'sparkle', head: 'Rank up', text: `You are now an ${after.rank.rank}-Rank Hunter.` });

  if ('region' in event) {
    const rb = before.regions[event.region];
    const ra = after.regions[event.region];
    const name = regionById.get(event.region)?.name ?? event.region;
    if (ra.rank.index > rb.rank.index)
      lines.push({ tone: 'gold', icon: 'star', head: 'Region rank up', text: `${name}: rank ${ra.rank.rank}.` });
    if (ra.level > rb.level)
      lines.push({ tone: 'accent', icon: 'sparkle', head: 'Level up', text: `${name} is now Lv.${ra.level}. Lessons will go deeper.` });
    if (ra.level < rb.level)
      lines.push({ tone: 'plain', icon: 'info', head: 'Pace adjusted', text: `${name} eased to Lv.${ra.level} to build a stronger base.` });
    if (ra.tier > rb.tier)
      lines.push({ tone: 'gold', icon: 'gates', head: 'Gate cleared', text: `Tier ${ra.tier} of ${name} is now open.` });
    if (event.k === 'lesson' && event.result === 'lost' && ra.bridge) {
      const b = lessonById.get(ra.bridge);
      if (b) lines.push({ tone: 'accent', icon: 'book', head: 'Bridge ready', text: `A gentler path: "${b.title}".` });
    }
  }

  for (const [key, s] of after.shadows) {
    if (!before.shadows.has(key))
      lines.push({ tone: 'accent', icon: 'shadows', head: 'Arise', text: `"${topicTitle(s.region, s.topic)}" joins your Shadow Army.` });
    else if (s.stage >= 3 && before.shadows.get(key)!.stage < 3)
      lines.push({ tone: 'gold', icon: 'shadows', head: 'Commander', text: `"${topicTitle(s.region, s.topic)}" is now a Commander.` });
  }

  for (const id of after.unlocked) {
    if (!before.unlocked.has(id))
      lines.push({ tone: 'accent', icon: 'map', head: 'New region detected', text: `${regionById.get(id)?.name} appears on your map.` });
  }

  for (const [id] of after.achievements) {
    if (!before.achievements.has(id)) {
      const a = achievementById.get(id);
      if (a) lines.push({ tone: 'gold', icon: 'star', head: 'Achievement', text: `${a.name}: ${a.desc}` });
    }
  }

  if (after.streak.current > before.streak.current && event.k !== 'penalty' && after.streak.current > 1)
    lines.push({ tone: 'ok', icon: 'flame', head: 'Streak', text: `${after.streak.current} days in a row.` });
  return lines;
}

export function RewardOverlay() {
  const data = rewardAtom.use();
  const [fill, setFill] = useState(0);

  useEffect(() => {
    if (!data) return;
    const { before, after } = data.outcome;
    const rankedUp = after.rank.index > before.rank.index;
    setFill(rankedUp ? 0 : before.rank.progress);
    const t = setTimeout(() => setFill(after.rank.progress), 250);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;
  const { before, after } = data.outcome;
  const gained = after.xp - before.xp;
  const lines = linesFor(data.outcome);
  const close = (to: string) => {
    rewardAtom.set(null);
    swap(to);
  };

  return (
    <div class="scrim">
      <Sys label={data.title} tone="gold" class="reward" as="div">
        <div role="status" aria-live="polite">
          <div class="reward-xp">
            +{gained}
            <small>XP</small>
          </div>
          <div class="reward-bar">
            <Bar value={fill} gold label="Hunter rank progress" />
            <div class="reward-bar-meta">
              <span>
                {after.rank.rank}-RANK · LV.{after.rank.sub}
              </span>
              <span>
                {after.xp.toLocaleString()}
                {after.rank.next ? ` / ${after.rank.next.toLocaleString()}` : ''} XP
              </span>
            </div>
          </div>
          {lines.length > 0 && (
            <ul class="reward-lines">
              {lines.map((l, i) => (
                <li class={`reward-line tone-${l.tone}`} style={{ animationDelay: `${0.35 + i * 0.12}s` }}>
                  <Icon name={l.icon} />
                  <div>
                    <b>{l.head}</b>
                    {l.text}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div class="reward-actions">
          <Btn glow onClick={() => close(data.primary.href)} icon="arrow">
            {data.primary.label}
          </Btn>
          {data.secondary && (
            <Btn variant="quiet" onClick={() => close(data.secondary!.href)}>
              {data.secondary.label}
            </Btn>
          )}
        </div>
        {data.note && <div class="reward-note mono">{data.note}</div>}
      </Sys>
    </div>
  );
}
