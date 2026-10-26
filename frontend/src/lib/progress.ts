// Derived progress: mission status, stage status, customer review text.
import { lessonOrders, orderFileId, skillTitle } from '../content';
import type { OrderProgress } from '../store';
import type { Lesson, Order, OrderResult } from '../types';
import { mastered } from './bkt';

export type OrderStatus = 'locked' | 'new' | 'progress' | 'revision' | 'accepted';

export function orderStatus(o: Order, p: OrderProgress | undefined, introduced: string[]): OrderStatus {
  if (p && p.bestStars >= 3 && !p.needsRevision) return 'accepted';
  if (p?.needsRevision) return 'revision';
  if (o.requires.some((s) => !introduced.includes(s))) return 'locked';
  return p && (p.stage > 1 || p.clarify) ? 'progress' : 'new';
}

export const missingSkills = (o: Order, introduced: string[]) =>
  o.requires.filter((s) => !introduced.includes(s)).map(skillTitle);

export const STATUS_RU: Record<OrderStatus, string> = {
  locked: 'Закрыто', new: 'Новое', progress: 'В работе', revision: 'Нужна доработка', accepted: 'На орбите',
};

export function stageKey(lesson: Lesson, stageId: string) {
  return `${lesson.id}:${stageId}`;
}

/** The boss order of a lesson (last `boss` kind). */
export const bossOf = (lesson: Lesson) => lessonOrders(lesson).filter((o) => o.kind === 'boss').pop();

export function dayUnlocked(lesson: Lesson, orders: Record<string, OrderProgress>, skills: Record<string, number>) {
  const boss = bossOf(lesson);
  const bossOk = !!boss && (orders[orderFileId(boss)]?.bestStars ?? 0) >= 3;
  const tags = [...new Set(lessonOrders(lesson).flatMap((o) => [...o.requires, ...o.introduces]))];
  const mastery = tags.length ? tags.filter((t) => mastered(skills[t])).length / tags.length : 0;
  return { bossOk, mastery, open: bossOk && mastery >= 0.7 };
}

/** Client review assembled from test replies (praise for passed, complaint for the first failures). */
export function reviewText(result: OrderResult): { text: string; complaints: string[] } {
  const praise = result.cases.filter((c) => c.passed && c.reply).map((c) => c.reply as string);
  const complaints = result.cases.filter((c) => !c.passed && c.reply).map((c) => c.reply as string);
  const parts: string[] = [];
  if (praise.length) parts.push(praise[0]);
  if (complaints.length) parts.push(complaints[0]);
  if (!parts.length) parts.push(result.error ? 'Программа на стенде даже не запустилась…' : 'Принято, изучу телеметрию.');
  return { text: parts.join(' '), complaints };
}

export const moodForStars = (stars: number) => (stars >= 4 ? 'joy' : stars === 3 ? 'neutral' : stars === 2 ? 'puzzled' : 'annoyed') as
  'joy' | 'neutral' | 'puzzled' | 'annoyed';
