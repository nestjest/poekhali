// Which lesson the player is in. In a lesson led by the teacher — the session's lesson;
// otherwise the first lesson whose «Конец смены» (closing) is not done yet (lessons go in order).
import type { Lesson } from '../types';

export const doneKey = (lesson: Pick<Lesson, 'id'>) => `${lesson.id}:closing`;

/** «Курс» — all lessons; «Знакомство» — a short track for school students: lessons 0–1 without diagnostics. */
export type Track = 'course' | 'intro';
export const INTRO_LAST_LESSON = 1;

export const trackLessons = <L extends Pick<Lesson, 'number'>>(lessons: L[], track: Track | undefined): L[] =>
  track === 'intro' ? lessons.filter((l) => l.number <= INTRO_LAST_LESSON) : lessons;

/** Stages the track skips (diagnostic tests are for the course's research, not for a short acquaintance). */
export const skippedStage = (stageId: string, track: Track | undefined): boolean =>
  track === 'intro' && stageId.startsWith('diagnostic');

export const lessonDone = (lesson: Pick<Lesson, 'id'>, stagesDone: string[]) => stagesDone.includes(doneKey(lesson));

export function pickLesson<L extends Pick<Lesson, 'id' | 'number'>>(lessons: L[], stagesDone: string[], sessionLesson: number | null): L | undefined {
  const sorted = [...lessons].sort((a, b) => a.number - b.number);
  if (sessionLesson !== null) {
    const led = sorted.find((l) => l.number === sessionLesson);
    if (led) return led;
  }
  return sorted.find((l) => !lessonDone(l, stagesDone)) ?? sorted[sorted.length - 1];
}

/** Lesson cards for the «Навыки» app: done / current / closed. */
export function lessonStates<L extends Pick<Lesson, 'id' | 'number'>>(lessons: L[], stagesDone: string[], current: L | undefined) {
  return [...lessons].sort((a, b) => a.number - b.number).map((l) => ({
    lesson: l,
    state: lessonDone(l, stagesDone) ? 'done' as const : l === current ? 'current' as const : 'closed' as const,
  }));
}
