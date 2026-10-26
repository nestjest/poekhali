// Client side of the Python worker: request/response, wall-clock timeout and restart.
// The judge itself stops infinite loops deterministically (line budget); the 5 s
// timeout is a safety net for pathological code.
import type { CrewMission, CrewResult, Order, OrderResult, RunCodeResult, RunError, TraceResult } from '../types';

export type PyStatus = 'loading' | 'ready' | 'restarting' | 'failed';
type Listener = (s: PyStatus) => void;

const TIMEOUT_MS = 5000;
const ORDER_TIMEOUT_MS = 15000;

export class TimeoutError extends Error {}

export const TIMEOUT_ERROR: RunError = {
  type: 'Timeout', message: 'Время вышло', line: null, col: null,
  explain: {
    title: 'Программа работает слишком долго.', where: '',
    check: 'Скорее всего, цикл не заканчивается. Меняется ли условие внутри цикла?', tag: 'infinite_loop',
  },
};

class PyRunner {
  private worker!: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();
  private listeners = new Set<Listener>();
  status: PyStatus = 'loading';

  constructor() {
    this.spawn();
  }

  private setStatus(s: PyStatus) {
    this.status = s;
    this.listeners.forEach((l) => l(s));
  }

  onStatus(l: Listener): () => void {
    this.listeners.add(l);
    l(this.status);
    return () => this.listeners.delete(l);
  }

  private spawn() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.kind === 'ready') this.setStatus('ready');
      else if (msg.kind === 'fatal') this.setStatus('failed');
      else {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.kind === 'result') p.resolve(msg.json);
        else p.reject(new Error(msg.message));
      }
    };
  }

  private restart() {
    this.worker.terminate();
    this.pending.forEach((p) => p.reject(new TimeoutError('timeout')));
    this.pending.clear();
    this.setStatus('restarting');
    this.spawn();
  }

  private call<T>(payload: Record<string, unknown>, timeoutMs = TIMEOUT_MS): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const arm = () => {
        const timer = setTimeout(() => this.restart(), timeoutMs);
        this.pending.set(id, {
          resolve: (v) => { clearTimeout(timer); resolve(JSON.parse(v) as T); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        });
        this.worker.postMessage({ ...payload, id });
      };
      if (this.status === 'ready') arm();
      else {
        const off = this.onStatus((s) => {
          if (s === 'ready') { queueMicrotask(() => off()); arm(); }
          else if (s === 'failed') { queueMicrotask(() => off()); reject(new Error('Не удалось загрузить Python')); }
        });
      }
    });
  }

  runCode(source: string, stdin: string[] = []): Promise<RunCodeResult> {
    return this.call<RunCodeResult>({ kind: 'run_code', source, stdin }).catch((e) => {
      if (e instanceof TimeoutError) return { stdout: '', error: TIMEOUT_ERROR, prompts: [], steps: 0 };
      throw e;
    });
  }

  runOrder(source: string, order: Order, hints: number, clarify: number[] | null): Promise<OrderResult> {
    return this.call<OrderResult>({ kind: 'run_order', source, order, hints, clarify }, ORDER_TIMEOUT_MS);
  }

  /** Crew program: the judge joins the parts in the mission's order and checks the whole. */
  runCrew(mission: CrewMission, sources: Record<string, string>, hints: number): Promise<CrewResult> {
    return this.call<CrewResult>({ kind: 'run_crew', mission, sources, hints }, ORDER_TIMEOUT_MS);
  }

  trace(source: string, stdin: string[] = []): Promise<TraceResult> {
    return this.call<TraceResult>({ kind: 'trace', source, stdin }).catch((e) => {
      if (e instanceof TimeoutError) return { steps: [], error: TIMEOUT_ERROR, truncated: true };
      throw e;
    });
  }
}

let instance: PyRunner | null = null;
export const py = (): PyRunner => (instance ??= new PyRunner());
