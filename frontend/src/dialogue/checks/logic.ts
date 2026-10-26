// Pure check logic (no React).

export function normalizeOutput(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export const isSingleCorrect = (answer: number, picked: number | null): boolean => picked !== null && picked === answer;

export function isMultiCorrect(answer: number[], picked: number[]): boolean {
  const a = new Set(answer);
  const p = new Set(picked);
  if (a.size !== p.size) return false;
  for (const x of a) if (!p.has(x)) return false;
  return true;
}

export function isOrderCorrect(lines: string[], arranged: string[]): boolean {
  return lines.length === arranged.length && lines.every((l, i) => l === arranged[i]);
}

/** slots hold chip indexes; a chip with the same text as the expected one also counts. */
export function isFillCorrect(answer: number[], slots: (number | null)[], chips: string[] = []): boolean {
  if (slots.length !== answer.length) return false;
  return answer.every((exp, i) => {
    const got = slots[i];
    if (got === null || got === undefined) return false;
    if (got === exp) return true;
    const a = chips[exp];
    const b = chips[got];
    return a !== undefined && b !== undefined && a.trim() === b.trim();
  });
}

export const isFindBugCorrect = (answer: number, picked: number | null): boolean => picked !== null && picked === answer;

export function isMatchCorrect(pairs: [string, string][], chosen: Record<string, string>): boolean {
  return pairs.every(([l, r]) => chosen[l] === r);
}

export function samePrintedOutput(expected: string[] | string, actual: string): boolean {
  const e = typeof expected === 'string' ? normalizeOutput(expected) : normalizeOutput(expected.join('\n'));
  const a = normalizeOutput(actual);
  return e.length === a.length && e.every((l, i) => l === a[i]);
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic shuffle; for length >= 2 never returns the original order. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const out = items.slice();
  let s = hash(seed) || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length >= 2 && out.every((x, i) => x === items[i])) out.push(out.shift() as T);
  return out;
}
