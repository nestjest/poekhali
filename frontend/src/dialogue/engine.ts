// Story engine (pure): walks script nodes, keeps the visual state (location, cast,
// whiteboard), applies flags/jumps/unlocks, keeps snapshots for «Назад», and re-asks
// checks deferred with «Не знаю — объясни» at the end.
import type { CastMember, Dialogue, DialogueNode, SceneInfo } from '../types';

export interface Visual {
  scene: SceneInfo | null;
  cast: CastMember[];
  board: { title?: string; lines: string[] } | null;
}

export interface DialogueState extends Visual {
  index: number;                 // current node index (nodes.length when done)
  history: { index: number; visual: Visual }[];
  deferred: string[];
  retrying: boolean;
  flags: string[];
  unlocked: string[];            // features unlocked during this run (UI persists them)
  done: boolean;
}

/** Nodes that wait for the player. Everything else is applied automatically. */
export const INTERACTIVE = new Set(['say', 'narrate', 'check', 'choice', 'input', 'avatar', 'launch', 'crew', 'quote']);

export function indexOf(d: Dialogue, id: string): number {
  const i = d.nodes.findIndex((n) => n.id === id);
  if (i < 0) throw new Error(`Нет узла ${id} в сценарии ${d.id}`);
  return i;
}

const visualOf = (s: Visual): Visual => ({ scene: s.scene, cast: s.cast, board: s.board });

function applyAuto(s: DialogueState, node: DialogueNode): DialogueState {
  switch (node.type) {
    case 'scene': {
      const cast = (node.cast ?? []).map((c) => ({ who: c.who, pos: c.pos ?? 'center', mood: c.mood ?? 'neutral' }));
      return { ...s, scene: { location: node.location, time: node.time ?? 'day', transition: node.transition ?? 'fade', title: node.title }, cast, board: null };
    }
    case 'enter': {
      const others = s.cast.filter((c) => c.who !== node.who);
      return { ...s, cast: [...others, { who: node.who, pos: node.pos ?? 'center', mood: node.mood ?? 'neutral' }] };
    }
    case 'exit':
      return { ...s, cast: s.cast.filter((c) => c.who !== node.who) };
    case 'board':
      return { ...s, board: node.lines.length ? { title: node.title, lines: node.lines } : null };
    case 'flag':
      return s.flags.includes(node.set) ? s : { ...s, flags: [...s.flags, node.set] };
    case 'unlock':
      return s.unlocked.includes(node.feature) ? s : { ...s, unlocked: [...s.unlocked, node.feature] };
    default:
      return s;
  }
}

/** Speaker mood follows the line: a `say` updates the speaker's mood in the cast. */
function withSpeakerMood(s: DialogueState, node: DialogueNode | undefined): DialogueState {
  if (node?.type !== 'say' || !node.mood) return s;
  if (!s.cast.some((c) => c.who === node.who)) return s;
  return { ...s, cast: s.cast.map((c) => (c.who === node.who ? { ...c, mood: node.mood! } : c)) };
}

function settle(d: Dialogue, s: DialogueState, i: number): DialogueState {
  for (let guard = 0; guard < d.nodes.length + 2; guard++) {
    const node: DialogueNode | undefined = d.nodes[i];
    if (!node || node.type === 'end') return finish(d, s);
    if (node.type === 'jump') { i = indexOf(d, node.next); continue; }
    if (!INTERACTIVE.has(node.type)) {
      s = applyAuto(s, node);
      i = 'next' in node && node.next ? indexOf(d, node.next) : i + 1;
      continue;
    }
    return withSpeakerMood({ ...s, index: i, done: false }, node);
  }
  throw new Error(`Зацикленные переходы в сценарии ${d.id}`);
}

function finish(d: Dialogue, s: DialogueState): DialogueState {
  if (s.deferred.length) {
    const [first, ...rest] = s.deferred;
    return { ...s, index: indexOf(d, first), deferred: rest, retrying: true, done: false };
  }
  return { ...s, index: d.nodes.length, retrying: false, done: true };
}

export function start(d: Dialogue): DialogueState {
  return settle(d, {
    index: 0, history: [], deferred: [], retrying: false, flags: [], unlocked: [], done: false,
    scene: null, cast: [], board: null,
  }, 0);
}

/** Resume at a saved index: replays automatic nodes up to it so the scene is correct. */
export function resume(d: Dialogue, at: number): DialogueState {
  let s = start(d);
  for (let guard = 0; guard < d.nodes.length * 2 && !s.done && s.index < at; guard++) {
    const node = d.nodes[s.index];
    s = node.type === 'choice' ? settle(d, s, s.index + 1) : advance(d, s);
  }
  return { ...s, history: [] };
}

export const current = (d: Dialogue, s: DialogueState): DialogueNode | null =>
  s.done ? null : d.nodes[s.index] ?? null;

/** Next after the current node. `choice` = chosen option index; `defer` for «Не знаю». */
export function advance(d: Dialogue, s: DialogueState, opts: { choice?: number; defer?: boolean } = {}): DialogueState {
  const node = current(d, s);
  if (!node) return s;
  const history = [...s.history, { index: s.index, visual: visualOf(s) }];
  let deferred = s.deferred;
  // A deferred check is re-asked once; «Не знаю» on the second time just moves on.
  if (opts.defer && !s.retrying && node.type === 'check' && !deferred.includes(node.id)) deferred = [...deferred, node.id];
  const base = { ...s, history, deferred };
  if (s.retrying) return finish(d, base);
  if (node.type === 'choice') {
    if (opts.choice === undefined) return s;
    const opt = node.options[opts.choice];
    return settle(d, base, opt?.next ? indexOf(d, opt.next) : s.index + 1);
  }
  const next = 'next' in node && node.next ? indexOf(d, node.next) : s.index + 1;
  return settle(d, base, next);
}

/** Back to the previous line (say/narrate), restoring what was on screen. */
export function back(d: Dialogue, s: DialogueState): DialogueState {
  const history = [...s.history];
  while (history.length) {
    const h = history.pop()!;
    const t = d.nodes[h.index]?.type;
    if (t === 'say' || t === 'narrate') return { ...s, ...h.visual, index: h.index, history, done: false };
  }
  return s;
}

export const progress = (d: Dialogue, s: DialogueState) => (s.done ? 1 : s.index / Math.max(1, d.nodes.length));
