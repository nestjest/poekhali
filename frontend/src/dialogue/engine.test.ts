import { describe, expect, it } from 'vitest';
import type { Check, Dialogue } from '../types';
import { advance, back, current, start } from './engine';

const check = { kind: 'single', prompt: '?', options: ['a', 'b'], answer: 0, hint: 'h', explain: 'e',
  feedback_correct: 'ok', feedback_wrong: 'no' } as Check;

const D: Dialogue = {
  id: 'd', lesson: 0, nodes: [
    { id: 'f', type: 'flag', set: 'started' },
    { id: 's1', type: 'say', who: 'vika', text: 'Привет' },
    { id: 'c1', type: 'check', check },
    { id: 'ch', type: 'choice', options: [{ text: 'Понятно', next: 's3' }, { text: 'Ещё раз', next: 's2' }] },
    { id: 's2', type: 'say', who: 'vika', text: 'Повторяю', next: 's3' },
    { id: 's3', type: 'say', who: 'max', text: 'Ага' },
    { id: 'c2', type: 'check', check },
    { id: 'j', type: 'jump', next: 'end' },
    { id: 'skipped', type: 'say', who: 'vika', text: 'never' },
    { id: 'end', type: 'end' },
  ],
};

const id = (s: ReturnType<typeof start>) => current(D, s)?.id;

describe('dialogue engine', () => {
  it('skips flags and starts on first interactive node', () => {
    const s = start(D);
    expect(id(s)).toBe('s1');
    expect(s.flags).toEqual(['started']);
  });

  it('applies scene, cast and board automatically and restores them on back', () => {
    const V: Dialogue = { id: 'v', lesson: 0, nodes: [
      { id: 'sc', type: 'scene', location: 'reception', cast: [{ who: 'olga', pos: 'center' }] },
      { id: 'a', type: 'say', who: 'olga', mood: 'joy', text: 'Привет' },
      { id: 'b', type: 'board', title: 'print', lines: ['`print("Привет")`'] },
      { id: 'u', type: 'unlock', feature: 'phone' },
      { id: 'c', type: 'narrate', text: 'Доска заполнилась.' },
    ] };
    let s = start(V);
    expect(s.scene?.location).toBe('reception');
    expect(s.cast[0]).toEqual({ who: 'olga', pos: 'center', mood: 'joy' });
    s = advance(V, s);
    expect(s.board?.title).toBe('print');
    expect(s.unlocked).toEqual(['phone']);
    s = back(V, s);
    expect(s.board).toBeNull();
  });

  it('follows choices, next and jumps to the end', () => {
    let s = advance(D, advance(D, start(D)));       // s1 → c1 → ch
    expect(id(s)).toBe('ch');
    expect(advance(D, s)).toBe(s);                  // choice needs an option
    s = advance(D, s, { choice: 1 });
    expect(id(s)).toBe('s2');
    s = advance(D, s);                              // explicit next → s3
    expect(id(s)).toBe('s3');
    s = advance(D, advance(D, s));                  // c2 → jump → end
    expect(s.done).toBe(true);
    expect(current(D, s)).toBeNull();
  });

  it('re-asks deferred checks at the end, then finishes', () => {
    let s = advance(D, start(D));                    // c1
    s = advance(D, s, { defer: true });              // defer c1 → choice
    s = advance(D, s, { choice: 0 });
    s = advance(D, advance(D, s));                   // s3 → c2 → (end) → c1 again
    expect(id(s)).toBe('c1');
    expect(s.retrying).toBe(true);
    s = advance(D, s, { defer: true });             // «Не знаю» again → no endless loop
    expect(s.done).toBe(true);
  });

  it('back returns to the previous say node', () => {
    let s = advance(D, advance(D, start(D)));       // at choice
    s = back(D, s);
    expect(id(s)).toBe('s1');
    expect(back(D, s)).toEqual(s);
  });
});

describe('launch cutscene node', () => {
  it('waits for the player (the cutscene calls advance when it ends)', () => {
    const L: Dialogue = { id: 'l', lesson: 0, nodes: [
      { id: 'sc', type: 'scene', location: 'launch', time: 'evening' },
      { id: 'go', type: 'launch', craft: 'Искорка' },
      { id: 'after', type: 'say', who: 'gromov', text: 'Поехали!' },
      { id: 'e', type: 'end' },
    ] };
    let s = start(L);
    expect(current(L, s)?.id).toBe('go');
    expect(s.scene?.location).toBe('launch');
    s = advance(L, s);
    expect(current(L, s)?.id).toBe('after');
  });
});