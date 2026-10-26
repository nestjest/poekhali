import { describe, expect, it } from 'vitest';
import { lessonDone, lessonStates, pickLesson } from './lessons';

const L = [{ id: 'lesson1', number: 1 }, { id: 'lesson0', number: 0 }, { id: 'lesson2', number: 2 }];

describe('current lesson', () => {
  it('starts with the first lesson', () => {
    expect(pickLesson(L, [], null)?.id).toBe('lesson0');
  });
  it('moves on after «Конец смены» of the previous lesson', () => {
    expect(pickLesson(L, ['lesson0:closing'], null)?.id).toBe('lesson1');
    expect(pickLesson(L, ['lesson0:closing', 'lesson1:orders'], null)?.id).toBe('lesson1');
  });
  it('stays on the last lesson when everything is done', () => {
    expect(pickLesson(L, ['lesson0:closing', 'lesson1:closing', 'lesson2:closing'], null)?.id).toBe('lesson2');
  });
  it('a teacher-led lesson wins, even if earlier lessons are not done', () => {
    expect(pickLesson(L, [], 2)?.id).toBe('lesson2');
    expect(pickLesson(L, [], 7)?.id).toBe('lesson0');
  });
  it('lesson cards: done / current / closed', () => {
    const cur = pickLesson(L, ['lesson0:closing'], null);
    expect(lessonStates(L, ['lesson0:closing'], cur).map((x) => x.state)).toEqual(['done', 'current', 'closed']);
    expect(lessonDone(L[0], ['lesson1:closing'])).toBe(true);
    expect(lessonDone(L[1], ['lesson1:closing'])).toBe(false);
  });
});
