import { useEffect, useState } from 'react';
import { py } from '../py/runner';
import type { TraceResult } from '../types';
import { CodeEditor } from './CodeEditor';

/** «Пошагово»: slider over steps, current line, variables (changed ones highlighted), output so far. */
export function TraceView({ source, stdin }: { source: string; stdin: string[] }) {
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    let alive = true;
    py().trace(source, stdin).then((t) => { if (alive) { setTrace(t); setI(0); } });
    return () => { alive = false; };
  }, [source, stdin]);
  if (!trace) return <p role="status">Готовлю пошаговый просмотр…</p>;
  const steps = trace.steps;
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  return (
    <div className="stack">
      <div className="row">
        <button className="btn small" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} aria-label="Шаг назад">←</button>
        <input type="range" min={0} max={steps.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))}
          aria-label="Шаг программы" style={{ flex: 1, minWidth: 120, minHeight: 44 }} />
        <button className="btn small primary" onClick={() => setI((v) => Math.min(steps.length - 1, v + 1))} disabled={last} aria-label="Следующий шаг">→</button>
        <span className="chip" aria-live="polite">Шаг {i + 1} из {steps.length}</span>
      </div>
      <p className="small muted">{last ? 'Программа закончилась.' : `Сейчас выполнится строка ${step.line}.`}
        {trace.truncated && ' Показаны первые 500 шагов.'}</p>
      <CodeEditor value={source} readOnly label="Код по шагам" runLine={last ? null : step.line} errorLine={last ? trace.error?.line ?? null : null} />
      <table className="vars" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <caption className="small muted" style={{ textAlign: 'left' }}>Переменные (коробки)</caption>
        <thead><tr><th scope="col" style={{ textAlign: 'left' }}>Имя</th><th scope="col" style={{ textAlign: 'left' }}>Тип</th><th scope="col" style={{ textAlign: 'left' }}>Значение</th></tr></thead>
        <tbody>
          {(last && i > 0 ? steps[i - 1].vars : step.vars).map((v) => (
            <tr key={v.name} style={{ background: v.changed ? 'var(--accent-soft)' : undefined }}>
              <td><code>{v.name}</code></td><td>{v.type}</td><td><code>{v.value}</code>{v.changed && <span className="sr-only"> (изменилось)</span>}</td>
            </tr>
          ))}
          {!step.vars.length && !last && <tr><td colSpan={3} className="muted">Пока пусто.</td></tr>}
        </tbody>
      </table>
      <div className="client-screen"><header>Экран</header><div className="out">{step.stdout || ' '}</div></div>
      {last && trace.error && <div className="alert bad"><strong>{trace.error.explain.title}</strong><span>{trace.error.explain.where} {trace.error.explain.check}</span></div>}
    </div>
  );
}
