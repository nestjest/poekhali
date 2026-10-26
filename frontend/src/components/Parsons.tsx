import { useMemo } from 'react';

interface Props {
  lines: Array<{ code: string; distractor?: boolean }>;
  chosen: number[];
  onChange: (chosen: number[]) => void;
  seed: string;
}

// Deterministic shuffle so the order is stable between renders and visits.
function shuffled(n: number, seed: string): number[] {
  let h = [...seed].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

export function Parsons({ lines, chosen, onChange, seed }: Props) {
  const order = useMemo(() => shuffled(lines.length, seed), [lines.length, seed]);
  const pool = order.filter((i) => !chosen.includes(i));
  const move = (pos: number, d: number) => {
    const next = [...chosen];
    const to = pos + d;
    if (to < 0 || to >= next.length) return;
    [next[pos], next[to]] = [next[to], next[pos]];
    onChange(next);
  };
  return (
    <div className="parsons">
      <div className="stack">
        <h3>Строки</h3>
        <div className="parsons-col" aria-label="Доступные строки">
          {pool.length === 0 && <span className="muted">Все строки в программе</span>}
          {pool.map((i) => (
            <div key={i} className="parsons-line">
              <code>{lines[i].code}</code>
              <button className="btn small" onClick={() => onChange([...chosen, i])} aria-label={`Добавить строку ${lines[i].code}`}>→</button>
            </div>
          ))}
        </div>
      </div>
      <div className="stack">
        <h3>Твоя программа</h3>
        <div className="parsons-col" aria-label="Программа">
          {chosen.length === 0 && <span className="muted">Добавляй строки по порядку</span>}
          {chosen.map((i, pos) => (
            <div key={i} className="parsons-line">
              <span className="muted" aria-hidden="true">{pos + 1}</span>
              <code>{lines[i].code}</code>
              <button className="btn small" onClick={() => move(pos, -1)} disabled={pos === 0} aria-label="Выше">↑</button>
              <button className="btn small" onClick={() => move(pos, 1)} disabled={pos === chosen.length - 1} aria-label="Ниже">↓</button>
              <button className="btn small" onClick={() => onChange(chosen.filter((x) => x !== i))} aria-label="Убрать">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
