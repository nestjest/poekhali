import { describe, expect, it } from 'vitest';
import {
  attentionOn, commonErrors, effectiveStars, orderAllowed, stageAllowed, studentStatus,
  type ClassStudent, type PublicSession,
} from './gate';

const session = (over: Partial<PublicSession> = {}): PublicSession => ({
  id: 1, code: 'КЕДР-42', lesson: 0, mode: 'sync', group: 'ИСП-21', open_stages: ['intro'],
  closed_orders: ['o0-boss'], attention: { on: false, text: '' }, message: null, ended: false, ...over,
});

const student = (over: Partial<ClassStudent> = {}): ClassStudent => ({
  id: 1, nick: 'Лис', avatar: 'a1', online: true, help: null, last_seen: 1000, joined: 900,
  progress: { at: 1000, where: 'hub', orders: {} }, grants: {}, ...over,
});

describe('gating', () => {
  it('solo play is never blocked', () => {
    expect(stageAllowed(null, 'orders')).toBe(true);
    expect(orderAllowed(null, 'o0-boss')).toBe(true);
  });
  it('sync lesson opens only the stages the teacher opened', () => {
    expect(stageAllowed(session(), 'intro')).toBe(true);
    expect(stageAllowed(session(), 'konspekt')).toBe(false);
  });
  it('free mode and an ended lesson do not block', () => {
    expect(stageAllowed(session({ mode: 'free' }), 'closing')).toBe(true);
    expect(stageAllowed(session({ ended: true }), 'closing')).toBe(true);
    expect(orderAllowed(session({ ended: true }), 'o0-boss')).toBe(true);
  });
  it('closed missions stay closed even in free mode', () => {
    expect(orderAllowed(session({ mode: 'free' }), 'o0-boss')).toBe(false);
    expect(orderAllowed(session(), 'o0-1')).toBe(true);
  });
  it('attention only while the lesson runs', () => {
    expect(attentionOn(session({ attention: { on: true, text: 'Смотрим на доску' } }))).toBe(true);
    expect(attentionOn(session({ attention: { on: true, text: '' }, ended: true }))).toBe(false);
    expect(attentionOn(null)).toBe(false);
  });
  it('teacher acceptance counts as 3 stars but never lowers', () => {
    expect(effectiveStars(1, { accepted: ['o0-1'] }, 'o0-1')).toBe(3);
    expect(effectiveStars(5, { accepted: ['o0-1'] }, 'o0-1')).toBe(5);
    expect(effectiveStars(2, {}, 'o0-1')).toBe(2);
  });
});

describe('class panel status', () => {
  it('priorities: offline → help → done → waiting → stuck → working', () => {
    expect(studentStatus(student({ online: false, help: 5 }), 'o0-boss', 1000)).toBe('offline');
    expect(studentStatus(student({ help: 5 }), 'o0-boss', 1000)).toBe('help');
    const boss = { orders: { 'o0-boss': { stars: 4, attempts: 1, hints: 0 } } };
    expect(studentStatus(student({ progress: { ...boss, waiting: true } }), 'o0-boss', 1000)).toBe('done');
    expect(studentStatus(student({ progress: { waiting: true } }), 'o0-boss', 1000)).toBe('waiting');
  });
  it('stuck after 3 failed attempts on the current mission, unless the teacher accepted it', () => {
    const p = { order: 'o0-3', where: 'order', at: 1000, orders: { 'o0-3': { stars: 2, attempts: 3, hints: 2 } } };
    expect(studentStatus(student({ progress: p }), 'o0-boss', 1000)).toBe('stuck');
    expect(studentStatus(student({ progress: p, grants: { accepted: ['o0-3'] } }), 'o0-boss', 1000)).toBe('working');
  });
  it('stuck when idle for 5 minutes inside a mission', () => {
    const p = { order: 'o0-1', where: 'order', at: 1000, orders: {} };
    expect(studentStatus(student({ progress: p }), 'o0-boss', 1000 + 301)).toBe('stuck');
    expect(studentStatus(student({ progress: { ...p, where: 'hub' } }), 'o0-boss', 1000 + 301)).toBe('working');
  });
  it('common errors are ranked by how many students hit them', () => {
    const a = student({ id: 1, progress: { errors: { input_without_int: 5 } } });
    const b = student({ id: 2, progress: { errors: { NameError: 1, input_without_int: 1 } } });
    const c = student({ id: 3, progress: { errors: { NameError: 2 } } });
    expect(commonErrors([a, b, c])).toEqual([['input_without_int', 6, 2], ['NameError', 3, 2]]);
  });
});
