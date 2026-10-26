// Entry test A (lesson 0) and final test B (lesson 3): same topics, different examples → learning gain B − A.
export const DIAG_A = 'l0-diagnostic';
export const DIAG_B = 'l3-diagnostic-b';

interface DialogueStat { done?: boolean; correct: number; total: number }
export interface DiagResult { correct: number; total: number }
export interface Growth { a: DiagResult | null; b: DiagResult | null; gain: number | null; gainPct: number | null }

const result = (d: DialogueStat | undefined): DiagResult | null =>
  d?.done && d.total > 0 ? { correct: d.correct, total: d.total } : null;

/** Gain in answers and in percentage points (comparable even if the tests had different length). */
export function diagGrowth(dialogues: Record<string, DialogueStat | undefined>): Growth {
  const a = result(dialogues[DIAG_A]);
  const b = result(dialogues[DIAG_B]);
  if (!a || !b) return { a, b, gain: null, gainPct: null };
  return { a, b, gain: b.correct - a.correct, gainPct: Math.round((b.correct / b.total - a.correct / a.total) * 100) };
}

export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
