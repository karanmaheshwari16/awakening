// Thin-line icons (24×24, stroke-based), drawn to match the System look.
const P: Record<string, string> = {
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  map: 'M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z M5 3.5v2 M4 4.5h2 M19 17.5v2 M18 18.5h2',
  shadows: 'M12 3c-3.5 0-6 2.8-6 6.5V21l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5V9.5C18 5.8 15.5 3 12 3z M9.5 10h.01 M14.5 10h.01',
  gates: 'M5 21V9a7 7 0 0114 0v12 M9 21v-8a3 3 0 016 0v8 M3 21h18',
  hunter: 'M12 3l7 4v5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V7z M9 12l2 2 4-4',
  settings: 'M4 7h10 M18 7h2 M4 17h4 M12 17h8 M16 5v4 M10 15v4',
  got: 'M5 12.5l4.5 4.5L19 7.5',
  mostly: 'M4 12c2.5-3 5-3 8 0s5.5 3 8 0',
  lost: 'M9.2 9a3 3 0 015.6 1.2c0 2-2.8 2.4-2.8 4.3 M12 18h.01 M12 21a9 9 0 110-18 9 9 0 010 18z',
  lock: 'M7 11V8a5 5 0 0110 0v3 M5.5 11h13v10h-13z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  flame: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.7-8.3.4 1.8 1.4 3 2.6 3.6C12 7.4 13 5 15.3 3c-.2 3 1.2 4.6 2.2 6.3.9 1.5 1.5 3.1 1.5 5.2C19 18.3 16 21 12 21z',
  star: 'M12 4l2.3 5.3 5.7.5-4.3 3.8 1.3 5.6L12 16.3 7 19.2l1.3-5.6L4 9.8l5.7-.5z',
  text: 'M4 19L9 5l5 14 M5.8 14h6.4 M15 19l3-8 3 8 M15.9 16.6h4.2',
  download: 'M12 4v11 M7 10.5l5 5 5-5 M5 20h14',
  upload: 'M12 20V9 M7 13.5l5-5 5 5 M5 4h14',
  sync: 'M4.5 11a7.5 7.5 0 0113.3-4.3 M18.5 3v4h-4 M19.5 13a7.5 7.5 0 01-13.3 4.3 M5.5 21v-4h4',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  book: 'M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z M12 6v13.5',
  recall: 'M4 12a8 8 0 108-8c-2.6 0-4.8 1.2-6.3 3 M4 4v4h4 M12 8v4l3 2',
  sparkle: 'M12 3v5 M12 16v5 M3 12h5 M16 12h5 M6 6l2.5 2.5 M15.5 15.5L18 18 M18 6l-2.5 2.5 M8.5 15.5L6 18',
  info: 'M12 21a9 9 0 110-18 9 9 0 010 18z M12 11v6 M12 7.5h.01',
  caution: 'M12 4l9 16H3z M12 10v4.5 M12 17.5h.01',
  analogy: 'M9 18h6 M10 21h4 M12 3a6 6 0 00-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0012 3z',
  definition: 'M5 4h11l3 3v13H5z M9 10h6 M9 14h6',
  question: 'M9.2 9a3 3 0 015.6 1.2c0 2-2.8 2.4-2.8 4.3 M12 18h.01',
  example: 'M8 6l-5 6 5 6 M16 6l5 6-5 6 M14 4l-4 16',
};

export function Icon({ name, size = 20, class: cls }: { name: keyof typeof P | string; size?: number; class?: string }) {
  return (
    <svg
      class={`icon ${cls ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
