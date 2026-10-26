// Lesson gating: what the teacher has opened. Pure functions, shared by the game and the teacher console.

export interface PublicSession {
  id: number;
  code: string;
  lesson: number;
  mode: 'sync' | 'free';
  group: string;
  open_stages: string[];
  closed_orders: string[];
  attention: { on: boolean; text: string };
  message: { text: string; at: number } | null;
  poll?: PublicPoll | null;
  ended: boolean;
}
/** Class poll: answers are anonymous, only counts per option. */
export interface PublicPoll { id: number; question: string; options: string[]; open: boolean; counts: number[]; total: number }
export interface TeacherComment { id: number; text: string; order: string | null; at: number }
export interface Grants {
  accepted?: string[];
  /** Best stars from the server check (/api/check) per mission file. */
  checked?: Record<string, number>;
  comments?: TeacherComment[];
}

/** Without a lesson (solo), after it ended, or in free mode everything follows the usual order. */
const free = (s: PublicSession | null): boolean => !s || s.ended || s.mode === 'free';

export const stageAllowed = (s: PublicSession | null, stageId: string): boolean =>
  free(s) || (s as PublicSession).open_stages.includes(stageId);

export const orderAllowed = (s: PublicSession | null, fileId: string): boolean =>
  !s || s.ended || !s.closed_orders.includes(fileId);

export const teacherAccepted = (g: Grants | undefined, fileId: string): boolean =>
  !!g?.accepted?.includes(fileId);

/** Stars that count for progress: the best of the browser and the server check; a teacher's acceptance counts as 3★. */
export const effectiveStars = (best: number, g: Grants | undefined, fileId: string): number =>
  Math.max(best, g?.checked?.[fileId] ?? 0, teacherAccepted(g, fileId) ? 3 : 0);

export const attentionOn = (s: PublicSession | null): boolean => !!s && !s.ended && s.attention.on;

// ------------------------------------------------------------------ teacher panel
export interface OrderStat { stars: number; attempts: number; hints: number; revision?: boolean }
export interface StudentProgress {
  stage?: string | null; where?: string; order?: string | null; waiting?: boolean;
  done_stages?: string[]; orders?: Record<string, OrderStat>;
  checks?: { correct?: number; total?: number }; errors?: Record<string, number>; at?: number;
}
export interface ClassStudent {
  id: number; nick: string; avatar: string; online: boolean; help: number | null;
  last_seen: number; joined: number; progress: StudentProgress; grants: Grants;
}

export type StudentStatus = 'help' | 'stuck' | 'waiting' | 'working' | 'done' | 'offline';

export const STATUS_LABEL: Record<StudentStatus, { text: string; icon: string }> = {
  help: { text: 'Зовёт', icon: '🔔' },
  stuck: { text: 'Застрял', icon: '!' },
  waiting: { text: 'Ждёт этап', icon: '⏸' },
  working: { text: 'В работе', icon: '▶' },
  done: { text: 'Сдал итог', icon: '✓' },
  offline: { text: 'Не в сети', icon: '○' },
};

export const STUCK_ATTEMPTS = 3;
export const IDLE_SECONDS = 300;

/** Status chip for the class panel. Order matters: a call for help beats everything else. */
export function studentStatus(st: ClassStudent, bossFile: string | undefined, now: number): StudentStatus {
  if (!st.online) return 'offline';
  if (st.help) return 'help';
  const p = st.progress ?? {};
  if (bossFile && effectiveStars(p.orders?.[bossFile]?.stars ?? 0, st.grants, bossFile) >= 3) return 'done';
  if (p.waiting) return 'waiting';
  const cur = p.order ? p.orders?.[p.order] : undefined;
  if (cur && cur.attempts >= STUCK_ATTEMPTS && effectiveStars(cur.stars, st.grants, p.order as string) < 3) return 'stuck';
  if (p.at && now - p.at > IDLE_SECONDS && (p.where === 'order' || p.where === 'story')) return 'stuck';
  return 'working';
}

/** Most frequent error tags across the class: [tag, total count, students]. */
export function commonErrors(students: ClassStudent[], top = 5): [string, number, number][] {
  const total = new Map<string, number>();
  const who = new Map<string, number>();
  for (const st of students) {
    for (const [tag, n] of Object.entries(st.progress?.errors ?? {})) {
      total.set(tag, (total.get(tag) ?? 0) + n);
      who.set(tag, (who.get(tag) ?? 0) + 1);
    }
  }
  return [...total.entries()].map(([t, n]) => [t, n, who.get(t) ?? 0] as [string, number, number])
    .sort((a, b) => b[2] - a[2] || b[1] - a[1]).slice(0, top);
}
