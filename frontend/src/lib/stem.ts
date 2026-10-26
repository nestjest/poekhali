// Tiny Russian stemmer for glossary search (strip common endings). Good enough for terms.
const ENDINGS = [
  'иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ых', 'их', 'ой', 'ей', 'ий', 'ый',
  'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ов', 'ев', 'ом', 'ем', 'ам', 'ям', 'ах', 'ях', 'ую', 'юю',
  'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь',
];

export function stem(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  if (w.length <= 3) return w;
  for (const e of ENDINGS) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length);
  return w;
}

export const stemText = (text: string) =>
  (text.toLowerCase().match(/[a-zа-яё0-9_]+/gi) ?? []).map(stem).join(' ');
