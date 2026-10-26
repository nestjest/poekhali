// «Музей бюро» as part of the work: an exhibit is studied by opening its card; clients ask museum questions
// after an accepted mission (extra premium), the crew answers a museum quiz in «Конец смены».
// Points of the crew quiz in a lesson are counted by the server (server/bureau_server/crews.py).
import type { Exhibit, ExhibitQuiz } from '../types';

/** Extra premium for a right answer to the client's museum question. */
export const MUSEUM_BONUS = 10;
/** Premium per right answer of the crew quiz in solo play (in a lesson — race points, see QUIZ_POINTS on the server). */
export const CREW_QUIZ_COINS = 5;
export const CREW_QUIZ_POINTS = 2;

export interface MuseumAnswer { exhibit: string; choice: number; correct: boolean }

export const quizOf = (exhibit: Exhibit | undefined, question: number): ExhibitQuiz | undefined => exhibit?.quiz?.[question];

/** The museum question of a mission waits for an answer: the mission is accepted and not answered yet. */
export const museumQuestionDue = (hasQuestion: boolean, accepted: boolean, answered: MuseumAnswer | undefined): boolean =>
  hasQuestion && accepted && !answered;

/** Right answers of a quiz (crew or solo): exhibit id → chosen option. */
export function quizScore(quiz: { exhibit: string; question: number }[], exhibits: Exhibit[], chosen: Record<string, number>): number {
  return quiz.filter((x) => {
    const q = quizOf(exhibits.find((e) => e.id === x.exhibit), x.question);
    return q !== undefined && chosen[x.exhibit] === q.answer;
  }).length;
}
