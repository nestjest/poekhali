// «Тетрадь инженера»: only topics the player has already met. A card opens once its skill is introduced
// (a check or a mission with `introduces`) or once the lesson's instruction (konspekt) is over.
import type { Lesson, NotebookCard } from '../types';

export const cardSkills = (card: NotebookCard): string[] => card.skills ?? [card.id];

/** The stage after which the whole lesson's notebook is open: the instruction, or the first stage if there is none. */
export const notebookStage = (lesson: Pick<Lesson, 'stages'>): string | undefined =>
  lesson.stages.find((s) => s.id === 'konspekt')?.id ?? lesson.stages[0]?.id;

export function cardOpen(lesson: Pick<Lesson, 'id' | 'stages'>, card: NotebookCard, introduced: string[], stagesDone: string[]): boolean {
  const stage = notebookStage(lesson);
  if (stage && stagesDone.includes(`${lesson.id}:${stage}`)) return true;
  return cardSkills(card).some((s) => introduced.includes(s));
}

export interface NotebookPage extends NotebookCard { lesson: number }

/** Open cards in course order and how many are still closed. */
export function notebookPages(lessons: Lesson[], introduced: string[], stagesDone: string[]): { open: NotebookPage[]; closed: number } {
  const open: NotebookPage[] = [];
  let closed = 0;
  for (const l of [...lessons].sort((a, b) => a.number - b.number)) {
    for (const c of l.notebook) {
      if (cardOpen(l, c, introduced, stagesDone)) open.push({ ...c, lesson: l.number });
      else closed++;
    }
  }
  return { open, closed };
}

/** «страница / страницы / страниц». */
export const pagesWord = (n: number) => {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return 'страница';
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 'страницы';
  return 'страниц';
};
