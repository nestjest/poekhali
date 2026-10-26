import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { findTerm } from '../content';

/** Term button: opens a plain-words explanation in place, without leaving the page. */
export function Term({ word, term }: { word: string; term: string }) {
  const entry = findTerm(term) ?? findTerm(word);
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  if (!entry) return <>{word}</>;
  return (
    <span className="term-wrap" ref={ref}>
      <button type="button" className="term" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        {word}
      </button>
      {open && (
        <span role="note" id={id} className="term-pop">
          <strong>{entry.term}</strong> — {entry.simple}
          {entry.example && <code className="term-ex">{entry.example}</code>}
        </span>
      )}
    </span>
  );
}

/** Content text: `code`, **bold**, [[term]] / [[form|term]], paragraphs by \n. */
export function RichText({ text, plain = false }: { text: string; plain?: boolean }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(`[^`]+`|\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g).map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('[[') && part.endsWith(']]')) {
        const [word, term] = part.slice(2, -2).split('|');
        return plain ? <Fragment key={i}>{word}</Fragment> : <Term key={i} word={word} term={term ?? word} />;
      }
      return <Fragment key={i}>{part}</Fragment>;
    });
  const paras = text.split('\n').filter((p) => p.trim());
  if (paras.length === 1) return <>{inline(paras[0])}</>;
  return <>{paras.map((p, i) => <p key={i}>{inline(p)}</p>)}</>;
}
