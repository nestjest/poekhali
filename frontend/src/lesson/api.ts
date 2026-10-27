// HTTP + WebSocket client for the lesson server (server/bureau_server). Same origin; Vite proxies in dev.
import type { CrewView, RaceRow } from '../lib/crew';
import type { ClassStudent, PublicSession } from '../lib/gate';
import type { CrewResult } from '../types';
import { useLesson, type StudentView } from './lessonStore';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

const OFFLINE = 'Сервер урока недоступен. Проверьте адрес у преподавателя или играйте самостоятельно.';
const API_TIMEOUT_MS = 20_000;

export async function api<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      cache: 'no-store',   // live lesson state: never from the HTTP cache
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers: {
        ...(opts.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      // A dropped connection (a VPN, a lost network) must end with a message, not an endless «Входим…».
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(OFFLINE, 0);
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new ApiError(OFFLINE, res.status || 0);
  const data: unknown = await res.json();
  if (!res.ok) {
    const detail = (data as { detail?: unknown }).detail;
    throw new ApiError(typeof detail === 'string' ? detail : 'Не получилось. Попробуйте ещё раз.', res.status);
  }
  return data as T;
}

export const wsUrl = (query: string) =>
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?${query}`;

// ------------------------------------------------------------------ student
export async function joinLesson(code: string, nick: string, avatar: string): Promise<void> {
  const r = await api<StudentView & { token: string }>('/api/join', { body: { code, nick, avatar } });
  useLesson.getState().joined(r.token, r);
}

export async function setHelp(on: boolean): Promise<void> {
  const { token, setView } = useLesson.getState();
  setView(await api<StudentView>('/api/help', { body: { on }, token }));
}

export async function sendProgress(body: unknown): Promise<void> {
  const { token } = useLesson.getState();
  if (!token) return;
  await api('/api/progress', { body, token });
}

/** Snapshot of the program for the teacher's read-only view (sent with a pause, not on every key). */
export async function sendCode(order: string, source: string): Promise<void> {
  const { token } = useLesson.getState();
  if (!token) return;
  await api('/api/code', { body: { order, source }, token });
}

/**
 * Server check in a lesson: the same judge in an isolated process with the server's hidden cases.
 * Returns null when there is no lesson; throws ApiError when the server cannot check (the caller falls back).
 */
let serverCheckOff = false;   // the server has no checker service: stop asking, the browser checks

export async function serverCheck<T>(order: string, source: string, hints: number, clarify: number[] | null): Promise<T | null> {
  const { token, mode } = useLesson.getState();
  if (!token || mode !== 'lesson' || serverCheckOff) return null;
  try {
    return await api<T>('/api/check', { body: { order, source, hints: Math.min(hints, 3), clarify }, token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) { serverCheckOff = true; return null; }
    throw e;
  }
}

// ------------------------------------------------------------------ crew (team «Конец смены»)
const token = () => useLesson.getState().token;

/** Save the student's own part of the crew program (the crew sees it live). */
export async function crewPart(part: string, source: string): Promise<void> {
  await api('/api/crew/part', { body: { part, source }, token: token() });
}

export async function crewChat(text: string): Promise<void> {
  await api('/api/crew/chat', { body: { text }, token: token() });
}

/**
 * Check the crew program: on the server (checker service) when it can, otherwise null — the browser judges and
 * reports the summary with crewResult().
 */
let crewServerOff = false;
export async function crewCheck(hints: number): Promise<CrewResult | null> {
  if (crewServerOff) return null;
  try {
    return await api<CrewResult>('/api/crew/check', { body: { hints: Math.min(hints, 3) }, token: token() });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 503 || e.status === 502)) { crewServerOff = e.status === 503; return null; }
    throw e;
  }
}

/** The crew's answer to a museum quiz question (checked and counted by the server, one answer per crew). */
export async function crewQuiz(exhibit: string, answer: number): Promise<{ correct: boolean; answer: number }> {
  return api('/api/crew/quiz', { body: { exhibit, answer }, token: token() });
}

export async function crewResult(summary: { stars: number; score: number; passed: number; total: number }): Promise<void> {
  await api('/api/crew/result', { body: summary, token: token() });
}

export async function answerPoll(poll: number, option: number): Promise<void> {
  const { token, setView } = useLesson.getState();
  setView(await api<StudentView>('/api/poll', { body: { poll, option }, token }));
}

/**
 * Keep the lesson state live: WebSocket with reconnect, plus polling /api/state as a fallback — every 20 s while
 * the socket is open, every 3 s without it (school networks block WebSockets; serverless hosting such as Vercel has
 * none: after a few failed attempts the socket is not retried). Returns a cleanup function.
 */
export const POLL_FAST_MS = 3_000;
export const POLL_SLOW_MS = 20_000;
export const WS_GIVE_UP = 3;
export function connectLesson(onLost: (reason: string) => void): () => void {
  let ws: WebSocket | null = null;
  let stopped = false;
  let retry = 0;
  let everOpen = false;
  let lastPollOk = 0;
  let lastPoll = 0;
  let reconnectTimer: number | undefined;
  const lesson = useLesson.getState;

  const lost = (status: number) => {
    if (status === 401 || status === 404) { stopped = true; onLost('Урок не найден на сервере.'); }
  };
  const poll = async () => {
    const token = lesson().token;
    if (!token || stopped) return;
    lastPoll = Date.now();
    try {
      lesson().setView(await api<StudentView>('/api/state', { token }));
      lastPollOk = Date.now();
      if (!ws || ws.readyState !== WebSocket.OPEN) lesson().setLink('online'); // reachable by polling
    } catch (e) {
      if (e instanceof ApiError) { lost(e.status); if (e.status === 0) lesson().setLink('offline'); }
    }
  };
  const open = () => {
    const token = lesson().token;
    if (!token || stopped) return;
    lesson().setLink('connecting');
    try { ws = new WebSocket(wsUrl(`token=${encodeURIComponent(token)}`)); } catch { ws = null; return; }
    ws.onopen = () => { retry = 0; everOpen = true; lesson().setLink('online'); };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type: string } & Partial<StudentView>;
        if (msg.type === 'session' && msg.session && msg.me) lesson().setView({ session: msg.session, me: msg.me, crew: msg.crew ?? null, race: msg.race ?? [] });
      } catch { /* ignore malformed */ }
    };
    ws.onclose = (ev) => {
      ws = null;
      if (stopped) return;
      if (ev.code === 4401) { void poll(); return; }
      if (Date.now() - lastPollOk > 2 * POLL_FAST_MS) lesson().setLink('offline');
      retry = Math.min(retry + 1, 6);
      if (!everOpen && retry >= WS_GIVE_UP) return;   // no WebSockets here: polling only
      reconnectTimer = window.setTimeout(open, 1000 * 2 ** Math.min(retry, 4));
    };
  };

  void poll();
  open();
  const pollTimer = window.setInterval(() => {
    const live = ws?.readyState === WebSocket.OPEN;
    if (!live || Date.now() - lastPoll >= POLL_SLOW_MS) void poll();
  }, POLL_FAST_MS);
  const pingTimer = window.setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}'); }, 25_000);
  return () => {
    stopped = true;
    window.clearInterval(pollTimer);
    window.clearInterval(pingTimer);
    window.clearTimeout(reconnectTimer);
    ws?.close();
    lesson().setLink('off');
  };
}

// ------------------------------------------------------------------ teacher
export interface TeacherStage { id: string; title: string; minutes?: number; orders: string[];
  teacher: { say?: string; ask?: string[]; mistakes?: string[]; stuck?: string } }
export interface TeacherLesson { number: number; title: string; goal: string; stages: TeacherStage[];
  orders: { file: string; id: string; title: string; kind: string }[];
  crew?: { id: string; title: string; craft: string; parts: { id: string; role: string; title: string }[] } | null }
export interface ClassView { session: PublicSession; students: ClassStudent[]; now: number; crews?: CrewView[]; race?: RaceRow[] }
export type SessionSummary = PublicSession & { students: number };
