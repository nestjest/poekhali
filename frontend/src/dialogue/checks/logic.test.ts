import { describe, expect, it } from 'vitest';
import {
  isFillCorrect, isFindBugCorrect, isMatchCorrect, isMultiCorrect, isOrderCorrect, isSingleCorrect,
  normalizeOutput, samePrintedOutput, seededShuffle,
} from './logic';

describe('normalizeOutput', () => {
  it('handles CRLF, trailing spaces and trailing empty lines', () => {
    expect(normalizeOutput('a  \r\nb\t\r\n\r\n\n')).toEqual(['a', 'b']);
  });
  it('keeps inner empty lines and handles empty input', () => {
    expect(normalizeOutput('a\n\nb')).toEqual(['a', '', 'b']);
    expect(normalizeOutput('')).toEqual([]);
  });
});

describe('single / findBug', () => {
  it('compares index', () => {
    expect(isSingleCorrect(1, 1)).toBe(true);
    expect(isSingleCorrect(1, 0)).toBe(false);
    expect(isSingleCorrect(0, null)).toBe(false);
    expect(isFindBugCorrect(2, 2)).toBe(true);
    expect(isFindBugCorrect(2, null)).toBe(false);
  });
});

describe('isMultiCorrect', () => {
  it('is set equality', () => {
    expect(isMultiCorrect([0, 2], [2, 0])).toBe(true);
    expect(isMultiCorrect([0, 2], [0])).toBe(false);
    expect(isMultiCorrect([0, 2], [0, 1, 2])).toBe(false);
    expect(isMultiCorrect([], [])).toBe(true);
  });
});

describe('isOrderCorrect', () => {
  it('compares sequence', () => {
    expect(isOrderCorrect(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(isOrderCorrect(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(isOrderCorrect(['a', 'b'], ['a'])).toBe(false);
  });
});

describe('isFillCorrect', () => {
  const chips = ['int', 'str', 'int'];
  it('exact index', () => expect(isFillCorrect([0, 1], [0, 1], chips)).toBe(true));
  it('same chip text counts', () => expect(isFillCorrect([0], [2], chips)).toBe(true));
  it('wrong or empty', () => {
    expect(isFillCorrect([0], [1], chips)).toBe(false);
    expect(isFillCorrect([0, 1], [0, null], chips)).toBe(false);
    expect(isFillCorrect([0, 1], [0], chips)).toBe(false);
  });
});

describe('isMatchCorrect', () => {
  const pairs: [string, string][] = [['a', '1'], ['b', '2']];
  it('checks all pairs', () => {
    expect(isMatchCorrect(pairs, { a: '1', b: '2' })).toBe(true);
    expect(isMatchCorrect(pairs, { a: '2', b: '1' })).toBe(false);
    expect(isMatchCorrect(pairs, { a: '1' })).toBe(false);
  });
});

describe('samePrintedOutput', () => {
  it('ignores trailing whitespace and CRLF', () => {
    expect(samePrintedOutput(['Привет', '5'], 'Привет \r\n5\n\n')).toBe(true);
    expect(samePrintedOutput('x\ny', 'x\ny\n')).toBe(true);
  });
  it('detects difference', () => {
    expect(samePrintedOutput(['a'], 'b')).toBe(false);
    expect(samePrintedOutput(['a', 'b'], 'a')).toBe(false);
  });
});

describe('seededShuffle', () => {
  it('is deterministic and a permutation', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const a = seededShuffle(items, 'seed');
    expect(a).toEqual(seededShuffle(items, 'seed'));
    expect([...a].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('never returns the original order', () => {
    for (let i = 0; i < 300; i++) {
      expect(seededShuffle(['a', 'b'], 'k' + i)).not.toEqual(['a', 'b']);
      expect(seededShuffle([1, 2, 3], 'k' + i)).not.toEqual([1, 2, 3]);
    }
  });
  it('handles tiny arrays', () => {
    expect(seededShuffle([], 's')).toEqual([]);
    expect(seededShuffle([1], 's')).toEqual([1]);
  });
});
