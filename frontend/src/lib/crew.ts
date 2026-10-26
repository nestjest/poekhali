// Crews of the team «Конец смены» and the «Гонка экипажей» (shapes of the server's views + pure helpers).
// Points are computed by the lesson server (server/bureau_server/crews.py); here — only display.
import { codeText, type CrewMission } from '../types';

export interface CrewMember { id: number; nick: string; avatar: string; online: boolean; parts: string[] }
export interface CrewChatMsg { id: number; by: number; nick: string; text: string; at: number }
export interface CrewPartState { source: string; by: number; at: number }
export interface CrewView {
  id: number; name: string; mission: string | null; members: CrewMember[];
  parts: Record<string, CrewPartState>;
  result: { stars: number; score: number; passed: number; total: number; at: number; by: number; verified: boolean } | null;
  stars: number; accepted: boolean; launched: boolean; start_place: number | null; checks: number; chat: CrewChatMsg[];
  /** Museum quiz: exhibit id → the crew's answer (one per question). */
  quiz?: Record<string, CrewQuizAnswer>;
}
export interface CrewQuizAnswer { answer: number; correct: boolean; by: number; nick: string; at: number }
export interface RaceRow {
  id: number; name: string; size: number; points: number; rank: number; stars_avg: number; team_stars: number;
  start_place: number | null; parts: { missions: number; team: number; start: number; quiz?: number };
}

/** The crew program is accepted from 3★ (as any mission). */
export const CREW_READY_STARS = 3;
export const crewReady = (stars: number) => stars >= CREW_READY_STARS;

/** Parts of the student in the crew; in solo play — all parts. */
export const myParts = (mission: CrewMission, crew: CrewView | null, me: number | null): string[] =>
  crew && me !== null ? crew.members.find((m) => m.id === me)?.parts ?? [] : mission.parts.map((p) => p.id);

export const ownerOf = (crew: CrewView | null, partId: string): CrewMember | undefined =>
  crew?.members.find((m) => m.parts.includes(partId));

/** Source of every part: own drafts first, then what the crew saved on the server, then the template. */
export function crewSources(mission: CrewMission, saved: Record<string, string | undefined>, drafts: Record<string, string> = {}) {
  return Object.fromEntries(mission.parts.map((p) => [p.id, drafts[p.id] ?? saved[p.id] ?? codeText(p.template)])) as Record<string, string>;
}

/** A part counts as written when it differs from the template and has no blanks left. */
export const partWritten = (mission: CrewMission, partId: string, source: string | undefined): boolean => {
  const part = mission.parts.find((p) => p.id === partId);
  if (!part || source === undefined) return false;
  return source.trim() !== codeText(part.template).trim() && !source.includes('___');
};

/** «1-е место», «2-е место»… */
export const placeLabel = (rank: number) => `${rank}-е место`;

export const pointsWord = (n: number) => {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return 'очко';
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'очка';
  return 'очков';
};

export const QUICK_PHRASES = [
  'Моя часть готова ✓',
  'Как ты назвал переменную?',
  'Проверь, пожалуйста, свою часть',
  'Запускаю испытания!',
  'Не понимаю, помогите',
];
