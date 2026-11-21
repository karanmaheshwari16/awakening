// Local-calendar day helpers. A "day" is a string like "2026-11-22" in the device's time zone.

const DEV_OFFSET_KEY = 'awakening:dev-day-offset';

/** Dev-only: shift "today" by N days to test streaks and reviews. */
export function devDayOffset(): number {
  if (!import.meta.env.DEV) return 0;
  return Number(localStorage.getItem(DEV_OFFSET_KEY) || 0);
}
export function setDevDayOffset(n: number) {
  localStorage.setItem(DEV_OFFSET_KEY, String(n));
}

export function now(): number {
  return Date.now() + devDayOffset() * 86_400_000;
}

export function dayOf(t: number): string {
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const today = () => dayOf(now());

/** Whole-day number, for differences between days. */
export function dayNum(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function addDays(day: string, n: number): string {
  const t = (dayNum(day) + n) * 86_400_000;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);

export function prettyDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
