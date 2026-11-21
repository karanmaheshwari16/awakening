export interface Achievement {
  id: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'awakened', name: 'Awakened', desc: 'Complete your first session.' },
  { id: 'streak-3', name: 'Momentum', desc: 'Reach a 3-day streak.' },
  { id: 'streak-7', name: 'Seven Suns', desc: 'Reach a 7-day streak.' },
  { id: 'streak-30', name: 'Unbroken', desc: 'Reach a 30-day streak.' },
  { id: 'explorer', name: 'Explorer', desc: 'Learn in 5 different regions.' },
  { id: 'polymath', name: 'Polymath', desc: 'Learn in 10 different regions.' },
  { id: 'first-gate', name: 'Gate Breaker', desc: 'Clear your first Gate.' },
  { id: 'shadows-10', name: 'Shadow Legion', desc: 'Raise 10 shadows.' },
  { id: 'shadows-25', name: 'Shadow Monarch', desc: 'Raise 25 shadows.' },
  { id: 'commander', name: 'First Commander', desc: 'Re-summon a shadow three times.' },
  { id: 'honest', name: 'Honest Hunter', desc: 'Say "Lost me", then later master that topic.' },
  { id: 'scribe', name: 'Scribe', desc: 'Explain 10 lessons in your own words.' },
  { id: 'night', name: 'Night Reader', desc: 'Finish a session after 10 pm.' },
  { id: 'second-wind', name: 'Second Wind', desc: 'Complete a Penalty Quest.' },
  { id: 'seasoned', name: 'Seasoned', desc: 'Complete 25 lessons.' },
  { id: 'veteran', name: 'Veteran', desc: 'Complete 100 lessons.' },
  { id: 'rank-c', name: 'C-Rank Hunter', desc: 'Reach Hunter rank C.' },
  { id: 'sovereign', name: 'Sovereign', desc: 'Reach rank S in any region.' },
];

export const achievementById = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
