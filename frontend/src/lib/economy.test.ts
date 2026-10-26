import { describe, expect, it } from 'vitest';
import { bktUpdate, mastered } from './bkt';
import { starsText, tipsDue } from './economy';
import { stem } from './stem';

describe('economy', () => {
  it('pays tips once per star level, difference on resubmission', () => {
    expect(tipsDue(0, 5)).toBe(50);
    expect(tipsDue(0, 2)).toBe(0);
    expect(tipsDue(3, 4)).toBe(15);
    expect(tipsDue(4, 4)).toBe(0);
    expect(tipsDue(5, 3)).toBe(0);
  });
  it('renders stars', () => expect(starsText(3)).toBe('★★★☆☆'));
});

describe('bkt', () => {
  it('rises with correct answers and reaches mastery', () => {
    let p: number | undefined;
    for (let i = 0; i < 4; i++) p = bktUpdate(p, true);
    expect(mastered(p)).toBe(true);
  });
  it('falls after a wrong answer', () => {
    const p = bktUpdate(0.6, false);
    expect(p).toBeLessThan(0.6);
  });
});

describe('stem', () => {
  it('maps word forms together', () => {
    expect(stem('переменная')).toBe(stem('переменной'));
    expect(stem('Строки')).toBe(stem('строка'));
  });
});
