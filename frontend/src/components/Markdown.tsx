import { Fragment, type ReactNode } from 'react';

// Tiny markdown subset for content: paragraphs, `code`, **bold**.
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="stack">
      {text.split(/\n\s*\n/).map((p, i) => <p key={i}>{inline(p)}</p>)}
    </div>
  );
}
