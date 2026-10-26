import { describe, expect, it } from 'vitest';
import { CREWS } from '../content';
import { advance, start } from '../dialogue/engine';
import type { Dialogue } from '../types';
import { crewReady, crewSources, myParts, ownerOf, partWritten, placeLabel, pointsWord, type CrewView } from './crew';

const mission = CREWS.crew0;
const crew = (members: CrewView['members']): CrewView => ({
  id: 1, name: 'Кедр', mission: 'crew0', members, parts: {}, result: null, stars: 0, accepted: false, launched: false,
  start_place: null, checks: 0, chat: [],
});

describe('crew missions', () => {
  it('every lesson 0–3 has a crew mission with three parts', () => {
    for (const id of ['crew0', 'crew1', 'crew2', 'crew3']) expect(CREWS[id]?.parts.length).toBe(3);
  });

  it('solo player writes every part; in a crew — only own parts', () => {
    expect(myParts(mission, null, null)).toEqual(['input', 'calc', 'report']);
    const c = crew([{ id: 7, nick: 'Луна', avatar: 'a1', online: true, parts: ['input', 'report'] },
      { id: 8, nick: 'Вега', avatar: 'a2', online: true, parts: ['calc'] }]);
    expect(myParts(mission, c, 8)).toEqual(['calc']);
    expect(ownerOf(c, 'report')?.nick).toBe('Луна');
  });

  it('sources: own draft → saved by the crew → template', () => {
    const src = crewSources(mission, { calc: 'week = turns * 7\n' }, { input: 'craft = input()\n' });
    expect(src.input).toBe('craft = input()\n');
    expect(src.calc).toBe('week = turns * 7\n');
    expect(src.report).toContain('___');
  });

  it('a part with blanks is not written yet', () => {
    expect(partWritten(mission, 'calc', 'week = ___ * 7\n')).toBe(false);
    expect(partWritten(mission, 'calc', 'week = turns * 7\nletters = len(craft)\n')).toBe(true);
  });

  it('ready from 3★; Russian plural of points', () => {
    expect(crewReady(2)).toBe(false);
    expect(crewReady(3)).toBe(true);
    expect([1, 2, 5, 11, 21, 34].map(pointsWord)).toEqual(['очко', 'очка', 'очков', 'очков', 'очко', 'очка']);
    expect(placeLabel(2)).toBe('2-е место');
  });

  it('the story engine waits on a crew node', () => {
    const d: Dialogue = { id: 't', lesson: 0, nodes: [
      { id: 'a', type: 'say', who: 'vika', text: 'Собираем экипажем.' },
      { id: 'b', type: 'crew', mission: 'crew0' },
      { id: 'c', type: 'say', who: 'vika', text: 'Готово.' },
      { id: 'd', type: 'end' },
    ] };
    let s = advance(d, start(d));
    expect(d.nodes[s.index].type).toBe('crew');
    s = advance(d, s);
    expect(d.nodes[s.index].id).toBe('c');
  });
});
