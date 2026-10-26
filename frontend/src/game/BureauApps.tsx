// Phone apps of the bureau: «Музей бюро» (real facts, docs/space-facts.md), «Карта орбит», «Экипаж» (crew + race).
import { ExhibitArt, type ExhibitArtId, EXHIBIT_ART_IDS } from '../art/Museum';
import { OrbitMap } from '../art/OrbitMap';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { CREWS, LESSONS, MUSEUM, QUOTES } from '../content';
import { placeLabel, pointsWord } from '../lib/crew';
import { assembled, CRAFTS, exhibitOpen } from '../lib/crafts';
import { activeSession, useLesson } from '../lesson/lessonStore';
import { pickLesson, trackLessons } from '../lib/lessons';
import { useGame } from '../store';
import { RaceBoard } from './CrewMission';

const artId = (id: string | undefined): ExhibitArtId =>
  (EXHIBIT_ART_IDS as string[]).includes(id ?? '') ? (id as ExhibitArtId) : 'sputnik';

/** «Музей бюро»: an open exhibit shows its title; the text appears after «Изучить» (clients ask about studied exhibits). */
export function MuseumApp({ focus }: { focus?: string }) {
  const g = useGame();
  const reduce = useReducedMotion();
  const grants = useLesson((s) => s.me?.grants);
  const open = MUSEUM.filter((ex) => exhibitOpen(ex, g, grants));
  const studied = open.filter((ex) => g.museumStudied.includes(ex.id)).length;
  const focused = useRef<HTMLLIElement>(null);
  useEffect(() => { focused.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); }, [focus, reduce]);
  const quotes = g.quotesSeen.map((id) => QUOTES[id]).filter(Boolean);
  return (
    <div className="stack">
      <p className="small muted">Настоящие факты о нашей космонавтике. Открыто {open.length} из {MUSEUM.length}, изучено {studied}.
        Заказчики спрашивают про экспонаты и доплачивают за верный ответ.</p>
      <ul className="museum">
        {MUSEUM.map((ex) => {
          const ok = exhibitOpen(ex, g, grants);
          const known = ok && g.museumStudied.includes(ex.id);
          return (
            <li key={ex.id} ref={ex.id === focus ? focused : undefined}
              className={`museum-item${ok ? '' : ' locked'}${ex.id === focus ? ' focus' : ''}`}>
              <span className="museum-art" aria-hidden="true">{ok ? <ExhibitArt id={artId(ex.art)} size={60} /> : <span className="museum-q">?</span>}</span>
              <span className="stack-sm museum-body">
                <span className="museum-title">
                  <strong>{ok ? ex.title : 'Экспонат скоро появится'}</strong>
                  {known && <span className="chip museum-done"><span aria-hidden="true">✓</span> Изучено</span>}
                </span>
                {!ok && <span className="small muted">Откроется, когда продвинешься дальше.</span>}
                {ok && ex.year && <span className="small muted">{ex.year}</span>}
                {known && (
                  <motion.span initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>{ex.text}</motion.span>
                )}
                {ok && !known && (
                  <span className="museum-study">
                    <span className="small">Новый экспонат: прочитай табличку, заказчики о нём спросят.</span>
                    <button className="btn small" onClick={() => g.studyExhibit(ex.id)}>Изучить</button>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {quotes.length > 0 && (
        <section className="stack-sm" aria-label="Цитаты дня">
          <h3>Цитаты дня</h3>
          <ul className="museum">
            {quotes.map((q) => (
              <li key={q.id} className="museum-item museum-quote">
                <span className="stack-sm museum-body">
                  <span>«{q.quote}»</span>
                  <span className="small"><strong>{q.name}</strong> ({q.years}) — {q.role.toLowerCase()}.</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function OrbitApp() {
  const g = useGame();
  const grants = useLesson((s) => s.me?.grants);
  const crafts = CRAFTS.map((c) => ({ id: c.id, name: c.name, orbit: c.orbit, launched: g.launched.includes(c.name) }));
  const session = useLesson((s) => activeSession(s));
  const lesson = pickLesson(trackLessons(LESSONS, session ? 'course' : g.settings.track), g.stagesDone, session ? session.lesson : null);
  const building = CRAFTS.find((c) => c.lesson === lesson?.number && !g.launched.includes(c.name));
  const [done, total] = assembled(lesson?.number ?? 0, g, grants);
  const flying = CRAFTS.filter((c) => g.launched.includes(c.name));
  return (
    <div className="stack">
      <div className="orbit-map"><OrbitMap crafts={crafts} /></div>
      {flying.length > 0 && (
        <ul className="stack-sm">
          {flying.map((c) => <li key={c.id}><strong>«{c.name}»</strong> — {c.about}. <span aria-hidden="true">✓</span> На орбите.</li>)}
        </ul>
      )}
      {building && (
        <p>«{building.name}» ({building.about}) собран на {done} из {total}: программы принимаются после испытаний, а запуск — в конце смены.</p>
      )}
      {!flying.length && !building && <p>Пока на орбите пусто.</p>}
    </div>
  );
}

/** «Экипаж»: the student's crew for the team «Конец смены» and the «Гонка экипажей». */
export function CrewApp() {
  const crew = useLesson((s) => s.crew);
  const race = useLesson((s) => s.race);
  const me = useLesson((s) => s.me?.id);
  const mission = crew?.mission ? CREWS[crew.mission] : undefined;
  const row = crew ? race.find((r) => r.id === crew.id) : undefined;
  if (!crew) return <p>Экипажи распределяет преподаватель на уроке. В самостоятельной игре твой экипаж — ты, Вика и Макс.</p>;
  return (
    <div className="stack">
      <div className="stack-sm">
        <strong>Экипаж «{crew.name}»{row ? ` · ${placeLabel(row.rank)}, ${row.points} ${pointsWord(row.points)}` : ''}</strong>
        <ul className="stack-sm">
          {crew.members.map((m) => (
            <li key={m.id}>{m.id === me ? `${m.nick} (ты)` : m.nick} — {m.parts.map((pid) => mission?.parts.find((p) => p.id === pid)?.role ?? pid).join(', ') || 'испытатель'}</li>
          ))}
        </ul>
        {mission && <p className="small muted">В конце смены экипаж собирает программу «{mission.title}». Очки: звёзды за задания дня, командная программа и бонус за первые старты.</p>}
      </div>
      <RaceBoard rows={race} mine={crew.id} />
    </div>
  );
}
