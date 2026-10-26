import { describe, expect, it } from 'vitest';
import { CREWS, LESSONS, MUSEUM, ORDERS, QUOTES } from '../content';
import { advance, current, start } from '../dialogue/engine';
import type { Dialogue, Lesson } from '../types';
import { museumQuestionDue, quizOf, quizScore } from './museum';
import { cardOpen, notebookPages, pagesWord } from './notebook';

describe('notebook', () => {
  const lesson = LESSONS.find((l) => l.number === 0) as Lesson;
  const later = LESSONS.find((l) => l.number === 2) as Lesson;

  it('is empty before any topic is met (the bug: every lesson was shown)', () => {
    const { open, closed } = notebookPages(LESSONS, [], []);
    expect(open).toEqual([]);
    expect(closed).toBe(LESSONS.reduce((n, l) => n + l.notebook.length, 0));
  });
  it('opens a card with its skill, aliases included', () => {
    const casts = lesson.notebook.find((c) => c.id === 'casts')!;
    expect(cardOpen(lesson, casts, ['print'], [])).toBe(false);
    expect(cardOpen(lesson, casts, ['int_cast'], [])).toBe(true);
    const { open } = notebookPages(LESSONS, ['print'], []);
    expect(open.map((c) => c.id)).toEqual(['print']);
  });
  it('opens the whole lesson after its instruction, but not later lessons', () => {
    const { open } = notebookPages(LESSONS, [], [`${lesson.id}:konspekt`]);
    expect(open.length).toBe(lesson.notebook.length);
    expect(open.every((c) => c.lesson === 0)).toBe(true);
    expect(later.notebook.some((c) => cardOpen(later, c, [], [`${lesson.id}:konspekt`]))).toBe(false);
  });
  it('declines «страница»', () => {
    expect([1, 2, 5, 11, 21, 24].map(pagesWord)).toEqual(['страница', 'страницы', 'страниц', 'страниц', 'страница', 'страницы']);
  });
});

describe('museum questions', () => {
  it('every exhibit has a quiz with a valid answer', () => {
    for (const ex of MUSEUM) {
      expect(ex.quiz?.length).toBeGreaterThan(0);
      for (const q of ex.quiz ?? []) expect(q.options[q.answer]).toBeTruthy();
    }
  });
  it('client questions and crew quizzes point to real questions', () => {
    for (const o of ORDERS.filter((x) => x.museum)) expect(quizOf(MUSEUM.find((e) => e.id === o.museum!.exhibit), o.museum!.question)).toBeTruthy();
    for (const m of Object.values(CREWS)) {
      expect(m.quiz?.length).toBeGreaterThan(1);
      for (const x of m.quiz ?? []) expect(quizOf(MUSEUM.find((e) => e.id === x.exhibit), x.question)).toBeTruthy();
    }
  });
  it('asks only after acceptance and only once', () => {
    expect(museumQuestionDue(true, true, undefined)).toBe(true);
    expect(museumQuestionDue(true, false, undefined)).toBe(false);
    expect(museumQuestionDue(true, true, { exhibit: 'ps1', choice: 0, correct: true })).toBe(false);
    expect(museumQuestionDue(false, true, undefined)).toBe(false);
  });
  it('scores a quiz by the right options', () => {
    const quiz = [{ exhibit: 'ps1', question: 0 }, { exhibit: 'korolev', question: 0 }];
    const right = Object.fromEntries(quiz.map((x) => [x.exhibit, quizOf(MUSEUM.find((e) => e.id === x.exhibit), x.question)!.answer]));
    expect(quizScore(quiz, MUSEUM, right)).toBe(2);
    expect(quizScore(quiz, MUSEUM, { ps1: right.ps1 })).toBe(1);
  });
});

describe('quote of the day', () => {
  it('every quote has a full name, years and a source', () => {
    for (const q of Object.values(QUOTES)) {
      expect(q.name.split(' ').length).toBeGreaterThanOrEqual(3);
      expect(q.years && q.source && q.role && q.quote).toBeTruthy();
    }
  });
  it('a quote node waits for the player', () => {
    const d: Dialogue = { id: 't', lesson: 0, nodes: [
      { id: 'a', type: 'narrate', text: 'Вечер.' }, { id: 'q', type: 'quote', quote: 'gagarin_go' }, { id: 'e', type: 'end' }] };
    let s = start(d);
    s = advance(d, s);
    expect(current(d, s)?.type).toBe('quote');
    expect(advance(d, s).done).toBe(true);
  });
});
