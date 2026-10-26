// Museum questions in the work: the client's question after an accepted mission, the crew quiz of «Конец смены»
// and «Цитата дня» at the end of the shift. Exhibits and quotes are content (content/museum.json, content/quotes.json).
import { useState } from 'react';
import { ExhibitArt, type ExhibitArtId, EXHIBIT_ART_IDS } from '../art/Museum';
import { Modal } from '../components/Shell';
import { exhibitById } from '../content';
import { MUSEUM_BONUS, quizOf, type MuseumAnswer } from '../lib/museum';
import { useGame } from '../store';
import type { Exhibit, ExhibitQuiz, MuseumRef, Quote } from '../types';
import { MuseumApp } from './BureauApps';

const artId = (id: string | undefined): ExhibitArtId =>
  (EXHIBIT_ART_IDS as string[]).includes(id ?? '') ? (id as ExhibitArtId) : 'sputnik';

/** Answer options: before the answer — buttons; after — ✓ on the right one, ✗ on a wrong choice (not colour alone). */
function Options({ q, chosen, disabled, onPick }: { q: ExhibitQuiz; chosen: number | undefined; disabled: boolean; onPick: (i: number) => void }) {
  const done = chosen !== undefined;
  return (
    <div className="quiz-options" role="group" aria-label="Варианты ответа">
      {q.options.map((o, i) => {
        const mark = done && i === q.answer ? 'ok' : done && i === chosen ? 'bad' : '';
        return (
          <button key={o} className={`btn quiz-option${mark ? ` ${mark}` : ''}`} disabled={disabled || done} onClick={() => onPick(i)}
            aria-pressed={chosen === i}>
            <span className="quiz-mark" aria-hidden="true">{mark === 'ok' ? '✓' : mark === 'bad' ? '✗' : String.fromCharCode(1040 + i)}</span>
            <span className="quiz-text">{o}</span>
            {mark === 'ok' && <span className="sr-only"> — верный ответ</span>}
            {mark === 'bad' && <span className="sr-only"> — твой ответ, неверный</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The exhibit the question is about: studied → ✓; not yet → «Открыть в музее» (the answer waits for the study). */
function ExhibitLink({ exhibit, studied, onOpen }: { exhibit: Exhibit; studied: boolean; onOpen: () => void }) {
  return (
    <div className="quiz-exhibit">
      <span className="museum-art" aria-hidden="true"><ExhibitArt id={artId(exhibit.art)} size={44} /></span>
      <span className="quiz-exhibit-text"><span className="small muted">Экспонат музея</span><strong>{exhibit.title}</strong></span>
      {studied ? <span className="chip museum-done"><span aria-hidden="true">✓</span> Изучено</span>
        : <button className="btn small" onClick={onOpen}>Открыть в музее</button>}
    </div>
  );
}

/** The client's museum question after an accepted mission: study the exhibit, answer once, a right answer adds premium. */
export function MuseumQuestion({ fileId, museumRef: mref, ask, who, onDone }: {
  fileId: string; museumRef: MuseumRef; ask: string; who: string; onDone: () => void;
}) {
  const g = useGame();
  const [museum, setMuseum] = useState(false);
  const exhibit = exhibitById(mref.exhibit);
  const q = quizOf(exhibit, mref.question);
  const answered: MuseumAnswer | undefined = g.museumAnswers[fileId];
  if (!exhibit || !q) return null;
  const studied = g.museumStudied.includes(exhibit.id);
  const pick = (choice: number) => {
    const correct = choice === q.answer;
    g.answerMuseum(fileId, { exhibit: exhibit.id, choice, correct });
    if (correct) g.addCoins(MUSEUM_BONUS);
  };
  return (
    <div className="museum-quiz">
      <span className="quiz-kicker">Вопрос заказчика · +{MUSEUM_BONUS} премии за верный ответ</span>
      <p className="quiz-ask"><strong>{who}:</strong> «{ask}»</p>
      <ExhibitLink exhibit={exhibit} studied={studied} onOpen={() => setMuseum(true)} />
      <h3 className="quiz-question">{q.question}</h3>
      {!studied && !answered && <p className="small muted">Сначала изучи экспонат в музее: вопрос откроется сразу после этого.</p>}
      <Options q={q} chosen={answered?.choice} disabled={!studied} onPick={pick} />
      {answered && (
        <div className={`alert ${answered.correct ? 'ok' : 'bad'}`} role="status">
          <span>{answered.correct ? `✓ Верно! Премия +${MUSEUM_BONUS}.`
            : `✗ Не совсем. Верный ответ: «${q.options[q.answer]}». Загляни в музей ещё раз — пригодится.`}</span>
        </div>
      )}
      <div className="row quiz-actions">
        {answered ? <button className="btn primary" onClick={onDone} autoFocus>Дальше</button>
          : <button className="btn ghost" onClick={onDone}>Не сейчас</button>}
      </div>
      <Modal open={museum} onClose={() => setMuseum(false)} title="Музей бюро"><MuseumApp focus={exhibit.id} /></Modal>
    </div>
  );
}

export interface CrewQuizAnswerView { answer: number; correct: boolean; nick?: string }

/** Museum quiz of the crew: one answer per question for the whole crew (in a lesson the server checks it). */
export function CrewQuiz({ quiz, answers, me, points, onAnswer, busy }: {
  quiz: MuseumRef[]; answers: Record<string, CrewQuizAnswerView>; me: string | null; points: string; busy: boolean;
  onAnswer: (exhibit: string, answer: number) => void;
}) {
  const right = quiz.filter((x) => answers[x.exhibit]?.correct).length;
  const done = quiz.filter((x) => answers[x.exhibit]).length;
  return (
    <div className="crew-quiz">
      <p className="small">Вопросы по экспонатам «Музея бюро». Один ответ на весь экипаж — сначала обсудите в чате.
        Верно {right} из {quiz.length}{done < quiz.length ? `, осталось ${quiz.length - done}` : ''}. {points}</p>
      <ol className="crew-quiz-list">
        {quiz.map((x, n) => {
          const exhibit = exhibitById(x.exhibit);
          const q = quizOf(exhibit, x.question);
          if (!exhibit || !q) return null;
          const a = answers[x.exhibit];
          return (
            <li key={x.exhibit} className="crew-quiz-item">
              <span className="small muted">Вопрос {n + 1} · экспонат «{exhibit.title}»</span>
              <strong className="quiz-question">{q.question}</strong>
              <Options q={q} chosen={a?.answer} disabled={busy} onPick={(i) => onAnswer(x.exhibit, i)} />
              {a && (
                <span className="small" role="status">
                  {a.correct ? '✓ Верно' : `✗ Неверно, правильно: «${q.options[q.answer]}»`}
                  {a.nick ? ` · ${a.nick === me ? 'твой ответ' : `ответ от ${a.nick}`}` : ''}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** «Цитата дня»: a documented quote of a figure of our cosmonautics with full name, years and what they did. */
export function QuoteCard({ quote, onDone }: { quote: Quote; onDone: () => void }) {
  return (
    <figure className="quote-card">
      <span className="quiz-kicker">Цитата дня</span>
      <blockquote className="quote-text">«{quote.quote}»</blockquote>
      <figcaption className="quote-who">
        <strong>{quote.name}</strong>
        <span className="small muted">{quote.years}</span>
        <span>{quote.role}</span>
      </figcaption>
      <p>{quote.about}</p>
      <p className="small muted">{quote.context} Источник: {quote.source}.</p>
      <div className="row quiz-actions"><button className="btn primary" onClick={onDone} autoFocus>Записать в музей и домой</button></div>
    </figure>
  );
}
