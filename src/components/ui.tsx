import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { atom } from '../lib/atom';
import { back } from '../lib/router';
import { Icon } from './Icon';

/** A "System window": thin border, corner ticks, small-caps label. */
export function Sys(props: {
  label?: string;
  children: ComponentChildren;
  class?: string;
  tone?: 'default' | 'accent' | 'gold' | 'quiet';
  as?: 'section' | 'div';
}) {
  const Tag = props.as ?? 'section';
  return (
    <Tag class={`sys sys-${props.tone ?? 'default'} ${props.class ?? ''}`}>
      {props.label && <div class="sys-label">[ {props.label} ]</div>}
      {props.children}
    </Tag>
  );
}

export function Label({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  return <div class={`label ${cls ?? ''}`}>{children}</div>;
}

export function Bar({ value, gold, label }: { value: number; gold?: boolean; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      class={`bar ${gold ? 'bar-gold' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, size = 56, stroke = 2, dim }: { value: number; size?: number; stroke?: number; dim?: boolean }) {
  const r = size / 2 - stroke - 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg class={`ring ${dim ? 'ring-dim' : ''}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle class="ring-track" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} fill="none" />
      {v > 0 && (
        <circle
          class="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke-width={stroke}
          fill="none"
          stroke-dasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}

export function RankBadge({ rank, size = 'md' }: { rank: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div class={`rank-badge rank-${size}`} aria-label={`Rank ${rank}`}>
      <span>{rank}</span>
    </div>
  );
}

export function TopBar(props: { title?: string; fallback?: string; right?: ComponentChildren; sub?: string }) {
  return (
    <header class="topbar">
      <button class="icon-btn" onClick={() => back(props.fallback)} aria-label="Back">
        <Icon name="back" size={22} />
      </button>
      <div class="topbar-title">
        {props.sub && <div class="label">{props.sub}</div>}
        {props.title && <div class="topbar-name">{props.title}</div>}
      </div>
      <div class="topbar-right">{props.right}</div>
    </header>
  );
}

export function Btn(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' | 'gold'; glow?: boolean; icon?: string },
) {
  const { variant = 'primary', glow, icon, class: cls, children, ...rest } = props;
  return (
    <button class={`btn btn-${variant} ${glow ? 'glow' : ''} ${cls ?? ''}`} {...rest}>
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  );
}

// ─── Toasts ───────────────────────────────────────────────────────
const toastAtom = atom<{ id: number; text: string } | null>(null);
let toastTimer: number | undefined;
export function toast(text: string) {
  toastAtom.set({ id: Date.now(), text });
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastAtom.set(null), 3200);
}
export function Toasts() {
  const t = toastAtom.use();
  return (
    <div class="toast-wrap" aria-live="polite">
      {t && (
        <div class="toast" key={t.id}>
          {t.text}
        </div>
      )}
    </div>
  );
}

// ─── Bottom sheet / dialog ─────────────────────────────────────────
export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => removeEventListener('keydown', onKey);
  }, [props.open]);
  if (!props.open) return null;
  return (
    <div class="scrim" onClick={props.onClose}>
      <div
        class="sheet sys"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="sheet-head">
          <div class="sys-label">[ {props.title} ]</div>
          <button class="icon-btn" onClick={props.onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div class="seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button
          role="radio"
          aria-checked={props.value === o.value}
          class={props.value === o.value ? 'on' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button class="toggle-row" role="switch" aria-checked={props.checked} onClick={() => props.onChange(!props.checked)}>
      <span class="toggle-text">
        <span>{props.label}</span>
        {props.desc && <small>{props.desc}</small>}
      </span>
      <span class={`toggle ${props.checked ? 'on' : ''}`} aria-hidden="true">
        <i />
      </span>
    </button>
  );
}

/** Media-query hook (e.g. laptop layout). */
export function useMedia(q: string): boolean {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const f = () => setM(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [q]);
  return m;
}

export const roman = (n: number) => ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'][n] ?? String(n);
export const pad = (n: number, w = 2) => String(n).padStart(w, '0');
