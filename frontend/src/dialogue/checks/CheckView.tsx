import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { codeText, type Check, type RunError } from '../../types';
import { RichText } from '../../components/RichText';
import { CodeEditor } from '../../components/CodeEditor';
import { py } from '../../py/runner';
import {
  isFillCorrect, isFindBugCorrect, isMatchCorrect, isMultiCorrect, isOrderCorrect, isSingleCorrect,
  samePrintedOutput, seededShuffle,
} from './logic';

export interface CheckResult { correct: boolean; skipped?: boolean; attempts: number }

interface Outcome { correct: boolean; output?: string; error?: RunError | null }
type Evaluator = () => Outcome | Promise<Outcome>;
type Of<K extends Check['kind']> = Extract<Check, { kind: K }>;

interface KindProps<K extends Check['kind']> {
  check: Of<K>;
  /** true while running or after checking: input is frozen */
  locked: boolean;
  /** result of the last check (marks are shown), null before checking */
  outcome: Outcome | null;
  bind: (ready: boolean, evaluate: Evaluator) => void;
}

const resetBtn: CSSProperties = { width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' };
const srOnly: CSSProperties = {
  position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
};

/** Visible ✓/✗ plus a screen-reader word, so the result never relies on color alone. */
function Mark({ ok }: { ok: boolean }) {
  return (
    <>
      <span aria-hidden="true">{ok ? '✓' : '✗'}</span>
      <span style={srOnly}>{ok ? 'верно' : 'неверно'}</span>
    </>
  );
}

// ------------------------------------------------------------- single / multi
function Choice({ check, locked, outcome, bind }: KindProps<'single'> | KindProps<'multi'>) {
  const multi = check.kind === 'multi';
  const [picked, setPicked] = useState<number[]>([]);
  const answer = check.kind === 'multi' ? check.answer : [check.answer];
  bind(picked.length > 0, () => ({
    correct: check.kind === 'multi'
      ? isMultiCorrect(check.answer, picked)
      : isSingleCorrect(check.answer, picked[0] ?? null),
  }));
  const toggle = (i: number) => {
    if (locked) return;
    setPicked((p) => (multi ? (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]) : [i]));
  };
  return (
    <div className="stack-sm">
      {multi && <p className="muted" style={{ margin: 0 }}>Можно выбрать несколько</p>}
      {check.options.map((opt, i) => {
        const on = picked.includes(i);
        const ok = answer.includes(i);
        const cls = ['option', outcome && on ? (ok ? 'right' : 'wrong') : ''].filter(Boolean).join(' ');
        return (
          <button key={i} type="button" className={cls} aria-pressed={on} onClick={() => toggle(i)}>
            <span aria-hidden="true">{multi ? (on ? '☑' : '☐') : (on ? '●' : '○')}</span>
            <span style={{ flex: 1 }}><RichText text={opt} plain /></span>
            {outcome && on && <Mark ok={ok} />}
          </button>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------- predict
function Screen({ text }: { text: string }) {
  return (
    <div className="stack-sm">
      <strong>Экран</strong>
      <div className="client-screen"><pre className="out" tabIndex={0} aria-label="Экран">{text === "" ? "(ничего не напечатано)" : text}</pre></div>
    </div>
  );
}

function Predict({ check, locked, outcome, bind }: KindProps<'predict'>) {
  const [text, setText] = useState('');
  const id = useId();
  bind(text.trim().length > 0, async () => {
    const r = await py().runCode(codeText(check.code), check.stdin ?? []);
    return { correct: !r.error && samePrintedOutput(text, r.stdout), output: r.stdout, error: r.error };
  });
  return (
    <div className="stack">
      <CodeEditor value={codeText(check.code)} readOnly label="Код для чтения" />
      {check.stdin && check.stdin.length > 0 && (
        <p className="muted" style={{ margin: 0 }}>Ввод: {check.stdin.map((s, i) => <code key={i}>{s} </code>)}</p>
      )}
      <label htmlFor={id}><strong>Что появится на экране?</strong></label>
      <textarea id={id} className="stdin" value={text} disabled={locked} rows={3}
        onChange={(e) => setText(e.target.value)} />
      {outcome && outcome.output !== undefined && <Screen text={outcome.output} />}
    </div>
  );
}

// ---------------------------------------------------------------------- order
function Order({ check, locked, outcome, bind }: KindProps<'order'>) {
  const [arr, setArr] = useState<string[]>(() => seededShuffle(check.lines, check.prompt));
  const [live, setLive] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  bind(true, () => ({ correct: isOrderCorrect(check.lines, arr) }));
  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= arr.length || from === to) return;
    const next = arr.slice();
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setArr(next);
    setLive(`Строка перемещена на место ${to + 1} из ${arr.length}`);
  };
  return (
    <div className="stack-sm">
      <p className="muted" style={{ margin: 0 }}>Расставь строки по порядку кнопками со стрелками.</p>
      <div className="code-lines" role="list">
        {arr.map((line, i) => (
          <div key={`${i}-${line}`} className="code-line" role="listitem" draggable={!locked}
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }}>
            <span className="num" aria-hidden="true">{i + 1}</span>
            <span style={{ flex: 1, whiteSpace: 'pre' }}>{line}</span>
            <button type="button" className="btn small" aria-label="Выше" disabled={locked || i === 0}
              onClick={() => move(i, i - 1)}>↑</button>
            <button type="button" className="btn small" aria-label="Ниже" disabled={locked || i === arr.length - 1}
              onClick={() => move(i, i + 1)}>↓</button>
            {outcome && <Mark ok={line === check.lines[i]} />}
          </div>
        ))}
      </div>
      <span style={srOnly} aria-live="polite">{live}</span>
    </div>
  );
}

// ----------------------------------------------------------------------- fill
function Fill({ check, locked, outcome, bind }: KindProps<'fill'>) {
  const [slots, setSlots] = useState<(number | null)[]>(() => check.answer.map(() => null));
  const [sel, setSel] = useState<number | null>(null);
  bind(slots.every((s) => s !== null), () => ({ correct: isFillCorrect(check.answer, slots, check.chips) }));
  const clickChip = (ci: number) => {
    if (locked || slots.includes(ci)) return;
    const target = sel !== null && slots[sel] === null ? sel : slots.findIndex((s) => s === null);
    if (target < 0) return;
    setSlots(slots.map((s, i) => (i === target ? ci : s)));
    setSel(null);
  };
  const clickSlot = (si: number) => {
    if (locked) return;
    if (slots[si] !== null) setSlots(slots.map((s, i) => (i === si ? null : s)));
    setSel(si);
  };
  const lines = codeText(check.code).replace(/\n$/, '').split('\n');
  return (
    <div className="stack">
      <div className="code-lines">
        {lines.map((line, li) => (
          <div key={li} className="code-line" style={{ whiteSpace: 'pre', flexWrap: 'wrap' }}>
            <span className="num" aria-hidden="true">{li + 1}</span>
            {line.split(/\{\{(\d+)\}\}/).map((part, pi) => {
              if (pi % 2 === 0) return <span key={pi}>{part}</span>;
              const si = Number(part);
              const ci = slots[si] ?? null;
              const ok = ci !== null && isFillCorrect([check.answer[si]], [ci], check.chips);
              return (
                <button key={pi} type="button" aria-label={`Пропуск ${si + 1}`}
                  className={ci !== null ? 'slot filled' : 'slot'}
                  style={{ ...resetBtn, width: 'auto', textAlign: 'center', color: 'var(--text)', outline: sel === si && !locked ? '3px solid var(--focus)' : undefined }}
                  aria-pressed={sel === si}
                  onClick={() => clickSlot(si)}>
                  {ci !== null ? check.chips[ci] : '…'}
                  {outcome && ci !== null && <> <Mark ok={ok} /></>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="row" role="group" aria-label="Варианты">
        {check.chips.map((c, ci) => (
          <button key={ci} type="button" className="btn small" disabled={locked || slots.includes(ci)}
            onClick={() => clickChip(ci)}>{c}</button>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- find_bug
function FindBug({ check, locked, outcome, bind }: KindProps<'find_bug'>) {
  const [picked, setPicked] = useState<number | null>(null);
  bind(picked !== null, () => ({ correct: isFindBugCorrect(check.answer, picked) }));
  return (
    <div className="stack-sm">
      <p className="muted" style={{ margin: 0 }}>Выбери строку, в которой ошибка.</p>
      <div className="code-lines">
        {check.code.map((line, i) => {
          const n = i + 1;
          const on = picked === n;
          return (
            <button key={i} type="button" className="code-line" aria-pressed={on}
              style={{
                ...resetBtn, whiteSpace: 'pre',
                background: on ? (outcome ? (n === check.answer ? 'var(--ok-bg)' : 'var(--bad-bg)') : 'var(--accent-soft)') : undefined,
              }}
              onClick={() => { if (!locked) setPicked(n); }}>
              <span className="num">{n}</span>
              <span style={{ flex: 1 }}>{line}</span>
              {outcome && on && <Mark ok={n === check.answer} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ tiny_code
function TinyCode({ check, locked, outcome, bind }: KindProps<'tiny_code'>) {
  const starter = codeText(check.starter);
  const [code, setCode] = useState(starter);
  bind(code.trim().length > 0 && code !== starter, async () => {
    const r = await py().runCode(code, check.stdin ?? []);
    return { correct: !r.error && samePrintedOutput(check.expected_stdout, r.stdout), output: r.stdout, error: r.error };
  });
  return (
    <div className="stack">
      <CodeEditor value={code} onChange={locked ? undefined : setCode} readOnly={locked} label="Твой код" className="tiny" />
      {outcome && outcome.output !== undefined && <Screen text={outcome.output} />}
      {outcome?.error && (
        <div className="alert bad">
          <strong>{outcome.error.explain.title}</strong>
          <span>{outcome.error.explain.check}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------- match
function Match({ check, locked, outcome, bind }: KindProps<'match'>) {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const rights = seededShuffle(check.pairs.map((p) => p[1]), check.prompt);
  const baseId = useId();
  bind(check.pairs.every(([l]) => !!chosen[l]), () => ({ correct: isMatchCorrect(check.pairs, chosen) }));
  return (
    <div className="stack-sm">
      {check.pairs.map(([left, right], i) => {
        const id = `${baseId}-${i}`;
        return (
          <div key={left} className="row" style={{ flexWrap: 'nowrap' }}>
            <label htmlFor={id} style={{ flex: 1 }}><RichText text={left} plain /></label>
            <select id={id} value={chosen[left] ?? ''} disabled={locked}
              style={{
                flex: 1, minHeight: 'var(--tap)', padding: '0 var(--s2)', font: 'inherit', color: 'var(--text)',
                background: 'var(--surface)', border: '2px solid var(--ink)', borderRadius: 'var(--r1)',
              }}
              onChange={(e) => setChosen({ ...chosen, [left]: e.target.value })}>
              <option value="">— выбери —</option>
              {rights.map((r, ri) => <option key={ri} value={r}>{r}</option>)}
            </select>
            {outcome && <Mark ok={chosen[left] === right} />}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------- main view
export function CheckView({ check, onDone, classic = false }: {
  check: Check; onDone: (r: CheckResult) => void; classic?: boolean;
}) {
  const [round, setRound] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const evaluator = useRef<Evaluator>(() => ({ correct: false }));
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const bind = (r: boolean, ev: Evaluator) => {
    evaluator.current = ev;
    if (r !== ready) setReady(r);
  };
  const locked = running || outcome !== null;

  const runCheck = async () => {
    if (running || !ready) return;
    setRunning(true);
    setFailed(false);
    try {
      const o = await evaluator.current();
      if (!alive.current) return;
      setAttempts((a) => a + 1);
      setOutcome(o);
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setRunning(false);
    }
  };
  const retry = () => { setOutcome(null); setReady(false); setRound((r) => r + 1); };
  const done = (skipped?: boolean) =>
    onDone(skipped
      ? { correct: false, skipped: true, attempts }
      : { correct: attempts === 1 && !!outcome?.correct, attempts });

  const props = { locked, outcome, bind };
  let body: ReactNode;
  switch (check.kind) {
    case 'single': body = <Choice key={round} check={check} {...props} />; break;
    case 'multi': body = <Choice key={round} check={check} {...props} />; break;
    case 'predict': body = <Predict key={round} check={check} {...props} />; break;
    case 'order': body = <Order key={round} check={check} {...props} />; break;
    case 'fill': body = <Fill key={round} check={check} {...props} />; break;
    case 'find_bug': body = <FindBug key={round} check={check} {...props} />; break;
    case 'tiny_code': body = <TinyCode key={round} check={check} {...props} />; break;
    case 'match': body = <Match key={round} check={check} {...props} />; break;
  }

  return (
    <section className={classic ? 'card stack classic' : 'card stack'} aria-label="Проверка">
      <div><RichText text={check.prompt} /></div>
      {body}

      <div className="stack-sm" aria-live="polite">
        {running && <p className="muted" style={{ margin: 0 }}>Запускаю…</p>}
        {failed && <div className="alert bad">Не получилось запустить проверку. Это не ошибка в твоём ответе — попробуй ещё раз.</div>}
        {outcome?.correct && <div className="alert ok"><RichText text={check.feedback_correct} /></div>}
        {outcome && !outcome.correct && <div className="alert bad"><RichText text={check.feedback_wrong} /></div>}
        {hintOpen && <div className="alert hint"><RichText text={check.hint} /></div>}
        {explainOpen && <div className="alert hint"><RichText text={check.explain} /></div>}
      </div>

      <div className="row">
        {explainOpen ? (
          <>
            <button type="button" className="btn primary" onClick={() => done(true)}>Понятно, вернусь к вопросу позже</button>
            <button type="button" className="btn ghost" onClick={() => setExplainOpen(false)}>Вернуться к ответу</button>
          </>
        ) : (
          <>
            {!outcome && (
              <button type="button" className="btn primary" disabled={!ready || running} onClick={() => { void runCheck(); }}>Проверить</button>
            )}
            {outcome?.correct && <button type="button" className="btn primary" onClick={() => done()}>Дальше</button>}
            {outcome && !outcome.correct && (
              <>
                <button type="button" className="btn primary" onClick={retry}>Попробовать ещё</button>
                {attempts >= 2 && <button type="button" className="btn ghost" onClick={() => done()}>Дальше</button>}
              </>
            )}
            {!outcome?.correct && (
              <button type="button" className="btn ghost" disabled={hintOpen} onClick={() => setHintOpen(true)}>Подсказка</button>
            )}
            <button type="button" className="btn ghost" onClick={() => setExplainOpen(true)}>Не знаю — объясни</button>
          </>
        )}
      </div>
    </section>
  );
}
