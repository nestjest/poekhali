import { describe, expect, it } from 'vitest';
import { DIAG_A, DIAG_B, diagGrowth, signed } from './diagnostics';
import { skippedStage, trackLessons } from './lessons';

describe('diagGrowth', () => {
  it('needs both finished tests', () => {
    expect(diagGrowth({}).gain).toBeNull();
    expect(diagGrowth({ [DIAG_A]: { done: true, correct: 4, total: 10 } }).a).toEqual({ correct: 4, total: 10 });
    expect(diagGrowth({ [DIAG_A]: { done: true, correct: 4, total: 10 }, [DIAG_B]: { done: false, correct: 3, total: 5 } }).gain).toBeNull();
  });
  it('counts gain in answers and percentage points', () => {
    const g = diagGrowth({ [DIAG_A]: { done: true, correct: 4, total: 10 }, [DIAG_B]: { done: true, correct: 8, total: 10 } });
    expect(g.gain).toBe(4);
    expect(g.gainPct).toBe(40);
  });
  it('formats signs', () => {
    expect(signed(3)).toBe('+3');
    expect(signed(-2)).toBe('−2');
    expect(signed(0)).toBe('0');
  });
});

describe('intro track', () => {
  const lessons = [0, 1, 2, 3].map((n) => ({ number: n }));
  it('keeps lessons 0–1 and skips diagnostics', () => {
    expect(trackLessons(lessons, 'intro').map((l) => l.number)).toEqual([0, 1]);
    expect(trackLessons(lessons, 'course')).toHaveLength(4);
    expect(trackLessons(lessons, undefined)).toHaveLength(4);
    expect(skippedStage('diagnostic', 'intro')).toBe(true);
    expect(skippedStage('diagnostic_b', 'intro')).toBe(true);
    expect(skippedStage('orders', 'intro')).toBe(false);
    expect(skippedStage('diagnostic', 'course')).toBe(false);
  });
});
