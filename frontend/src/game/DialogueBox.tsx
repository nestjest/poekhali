import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { RichText } from '../components/RichText';
import { CHARACTERS } from '../content';
import { StageCtx, type StageLayout } from './Stage';

/** Typewriter over visible characters; markup ([[term]], `code`) is revealed when finished. */
export function useTypewriter(text: string, cps = 55) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce) { setN(text.length); return; }
    setN(0);
    const id = setInterval(() => setN((v) => {
      if (v >= text.length) { clearInterval(id); return v; }
      return v + 1;
    }), 1000 / cps);
    return () => clearInterval(id);
  }, [text, cps, reduce]);
  const plain = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1').replace(/\*\*/g, '');
  const done = n >= text.length;
  return { shown: done ? text : plain.slice(0, Math.round((n / text.length) * plain.length)), done, finish: () => setN(text.length) };
}

/** Speech bubble next to the speaker (tail towards them) when there is room; otherwise the bar at the bottom. */
function bubblePlace(stage: StageLayout | null, who: string | undefined): { style: CSSProperties; tail: 'left' | 'right' } | null {
  if (!stage || stage.narrow || !who) return null;
  const sp = stage.cast.find((c) => CHARACTERS[c.who]?.name === who);
  if (!sp) return null;
  const sx = (sp.x / 100) * stage.w;
  const gap = stage.charSize * 0.5;  // clears a raised hand of the broadest figure (the widest pose)
  // The tail (40 px below the bubble's top) points at the speaker's eyes: the figure stands on the bottom edge, 240×300.
  const figTop = stage.h - stage.charSize * 1.25;
  const eyes = figTop + stage.charSize * 1.25 * 0.4;
  const top = Math.max(16, Math.min(eyes - 44, stage.h - 380));
  if (sp.x <= 50) {
    const left = sx + gap;
    const width = Math.min(600, stage.w - left - 32);
    return width >= 320 ? { style: { left, width, top }, tail: 'left' } : null;
  }
  const right = stage.w - sx + gap;
  const width = Math.min(600, sx - gap - 32);
  return width >= 320 ? { style: { right, width, top }, tail: 'right' } : null;
}

export interface Choice { text: string; onPick: () => void; tone?: 'primary' | 'normal'; disabled?: boolean; note?: string }

export function DialogueBox({ who, player, narrate, text, onNext, choices, nextLabel = 'Дальше', extra, choicesAt = 'end' }: {
  who?: string; player?: boolean; narrate?: boolean; text: string; onNext?: () => void;
  choices?: Choice[]; nextLabel?: string; extra?: ReactNode; choicesAt?: 'end' | 'center';
}) {
  const { shown, done, finish } = useTypewriter(text);
  const reduce = useReducedMotion();
  const nextRef = useRef<HTMLButtonElement>(null);
  const stage = useContext(StageCtx);
  const place = player || narrate ? null : bubblePlace(stage, who);

  const click = () => (done ? onNext?.() : finish());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], dialog, .cm-editor')) return;
      if (choices?.length && done) {
        const k = Number(e.key);
        if (k >= 1 && k <= choices.length && !choices[k - 1].disabled) { e.preventDefault(); choices[k - 1].onPick(); }
        return;
      }
      if ((e.key === ' ' || e.key === 'Enter') && !t.closest('button')) { e.preventDefault(); click(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (done) nextRef.current?.focus({ preventScroll: true }); }, [done, text]);

  return (
    <div className={place ? `dlg-wrap dlg-bubble tail-${place.tail}` : 'dlg-wrap'} style={place?.style}>
      <AnimatePresence>
        {done && choices && choices.length > 0 && !place && (
          <motion.ol className={`dlg-choices ${choicesAt}`} aria-label="Что ответить"
            initial={reduce ? false : 'hidden'} animate="show"
            variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.06 } } }}>
            {choices.map((c, i) => (
              <motion.li key={c.text} variants={{ hidden: { opacity: 0, x: 24 }, show: { opacity: 1, x: 0 } }}>
                <button ref={i === 0 ? nextRef : undefined} className={`dlg-choice ${c.tone === 'primary' ? 'primary' : ''}`}
                  onClick={c.onPick} disabled={c.disabled}>
                  <span className="dlg-key" aria-hidden="true">{i + 1}</span>
                  <span>{c.text}{c.note && <span className="dlg-note">{c.note}</span>}</span>
                </button>
              </motion.li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
      <motion.div className={`dlg ${player ? 'player' : ''} ${narrate ? 'narrate' : ''}`} onClick={click}
        initial={reduce ? false : { y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {who && <span className="dlg-name">{who}</span>}
        <div className="dlg-text" aria-live="polite">{done ? <RichText text={text} /> : shown}<span className="sr-only">{done ? '' : text}</span></div>
        {extra}
        {onNext && !choices?.length && (
          <button ref={nextRef} className="dlg-next" onClick={(e) => { e.stopPropagation(); click(); }} aria-label={done ? nextLabel : 'Показать весь текст'}>
            {done ? <>{nextLabel} <span aria-hidden="true">▼</span></> : <span aria-hidden="true">…</span>}
          </button>
        )}
      </motion.div>
      {done && choices && choices.length > 0 && place && (
        <ol className="dlg-choices pills" aria-label="Что ответить">
          {choices.map((c, i) => (
            <motion.li key={c.text} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : i * 0.06 }}>
              <button ref={i === 0 ? nextRef : undefined} className={`dlg-choice pill ${c.tone === 'primary' ? 'primary' : ''}`} onClick={c.onPick} disabled={c.disabled}>
                <span className="dlg-key" aria-hidden="true">{i + 1}</span>
                <span>{c.text}{c.note && <span className="dlg-note">{c.note}</span>}</span>
              </button>
            </motion.li>
          ))}
        </ol>
      )}
    </div>
  );
}
