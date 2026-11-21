import type { ComponentChildren } from 'preact';

// A deliberately tiny Markdown subset for lesson text:
// paragraphs, "## " subheadings, "- " lists, "1. " lists, **bold**, *italic*, `code`.
// Rendered as real elements (never raw HTML), so lesson text can't inject anything.

export function inline(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2]) out.push(<strong key={i++}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={i++}>{m[3]}</em>);
    else if (m[4]) out.push(<code key={i++}>{m[4]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ text }: { text: string }) {
  const chunks = text.trim().split(/\n\s*\n/);
  return (
    <>
      {chunks.map((chunk, i) => {
        const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 1 && lines[0].startsWith('## ')) return <h3 key={i}>{inline(lines[0].slice(3))}</h3>;
        if (lines.every((l) => /^[-•] /.test(l)))
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        if (lines.every((l) => /^\d+\. /.test(l)))
          return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ''))}</li>)}</ol>;
        return <p key={i}>{inline(lines.join(' '))}</p>;
      })}
    </>
  );
}
