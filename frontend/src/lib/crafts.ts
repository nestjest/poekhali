// The bureau's own spacecraft (docs/world.md §5): one per lesson, launched in «Конец смены».
import { MUSEUM, LESSONS, lessonOrders, orderFileId } from '../content';
import type { Exhibit } from '../types';
import { effectiveStars, type Grants } from './gate';
import { stageKey } from './progress';

export interface Craft { id: string; name: string; orbit: 'leo' | 'sso' | 'meo' | 'geo'; lesson: number; about: string }

export const CRAFTS: Craft[] = [
  { id: 'iskorka', name: 'Искорка', orbit: 'sso', lesson: 0, about: 'школьный кубсат кружка «Юный космонавт»' },
  { id: 'oblachko', name: 'Облачко', orbit: 'sso', lesson: 1, about: 'метеоспутник для метеостанции' },
  { id: 'severok', name: 'Северок', orbit: 'meo', lesson: 2, about: 'связь для северного посёлка' },
  { id: 'dozor', name: 'Дозор', orbit: 'leo', lesson: 3, about: 'поиск лесных пожаров' },
];

interface ProgressLike {
  stagesDone: string[];
  orders: Record<string, { bestStars: number }>;
}

/** Exhibit is open from the start, after a stage, or after a mission is accepted (incl. by the teacher). */
export function exhibitOpen(ex: Exhibit, g: ProgressLike, grants?: Grants): boolean {
  if (ex.unlock === 'start') return true;
  const { stage, order, lesson = 0 } = ex.unlock;
  if (stage) {
    const l = LESSONS.find((x) => x.number === lesson);
    return !!l && g.stagesDone.includes(stageKey(l, stage));
  }
  if (order) return effectiveStars(g.orders[order]?.bestStars ?? 0, grants, order) >= 3;
  return false;
}

export const openExhibits = (g: ProgressLike, grants?: Grants): Exhibit[] => MUSEUM.filter((ex) => exhibitOpen(ex, g, grants));

/** Missions of a lesson that count as done (for «Искорка собрана на N из M»). */
export function assembled(lessonNo: number, g: ProgressLike, grants?: Grants): [number, number] {
  const lesson = LESSONS.find((l) => l.number === lessonNo);
  if (!lesson) return [0, 0];
  const orders = lessonOrders(lesson);
  const done = orders.filter((o) => effectiveStars(g.orders[orderFileId(o)]?.bestStars ?? 0, grants, orderFileId(o)) >= 3);
  return [done.length, orders.length];
}
