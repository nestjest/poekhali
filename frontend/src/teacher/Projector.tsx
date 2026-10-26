// /#/present?s=<id> — screen for the projector: lesson code, current stage, class progress and the poll.
// Only aggregates: no pseudonyms on the big screen (nobody is singled out in front of the class).
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RaceBoard } from '../game/CrewMission';
import { api, type TeacherLesson } from '../lesson/api';
import { Login, PollBars, read, SESSION_KEY, studentDone, TOKEN_KEY, useClass, useStudentUrl } from './TeacherConsole';
import './teacher.css';

export function Projector() {
  const [params] = useSearchParams();
  const [token, setToken] = useState<string | null>(() => read(TOKEN_KEY));
  const id = Number(params.get('s') ?? read(SESSION_KEY)) || null;
  const lost = useCallback(() => setToken(null), []);
  if (!token) {
    return <main className="page teacher-page"><Login onToken={(t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } setToken(t); }} /></main>;
  }
  if (!id) return <main className="page teacher-page"><p>Сначала откройте урок на <Link to="/teacher">пульте</Link>, затем нажмите «Проектор».</p></main>;
  return <Screen token={token} id={id} onAuthLost={lost} />;
}

function Screen({ token, id, onAuthLost }: { token: string; id: number; onAuthLost: () => void }) {
  const { view, error } = useClass(token, id, onAuthLost);
  const studentUrl = useStudentUrl();
  const [lesson, setLesson] = useState<TeacherLesson | null>(null);
  useEffect(() => {
    if (view?.session.lesson === undefined) return;
    api<TeacherLesson[]>('/api/teacher/lessons', { token }).then((ls) => setLesson(ls.find((l) => l.number === view.session.lesson) ?? null))
      .catch(() => undefined);
  }, [token, view?.session.lesson]);

  if (!view || !lesson) return <p className="present-wait" role="status">{error ?? 'Подключаемся к уроку…'}</p>;
  const s = view.session;
  const opened = lesson.stages.filter((st) => s.mode === 'free' || s.open_stages.includes(st.id));
  const current = opened[opened.length - 1];
  const n = view.students.length;
  const online = view.students.filter((st) => st.online).length;
  const missionStage = lesson.stages.find((st) => st.orders.length && (s.mode === 'free' || s.open_stages.includes(st.id)));

  return (
    <div className="present">
      <header className="present-head">
        <span className="present-brand">«Поехали!» · Занятие {s.lesson}. {lesson.title}</span>
        <span className="present-join">Вход: <span className="mono">{studentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span> · код <strong>{s.code}</strong></span>
      </header>

      {s.attention.on ? (
        <section className="present-attention" role="status">
          <span className="present-bang" aria-hidden="true">!</span>
          <h1>Внимание!</h1>
          <p>{s.attention.text}</p>
        </section>
      ) : s.poll ? (
        <section className="present-poll" aria-labelledby="pp-q">
          <p className="present-kicker">{s.poll.open ? 'Вопрос классу — ответьте на своём экране' : 'Итог опроса'}</p>
          <h1 id="pp-q">{s.poll.question}</h1>
          <PollBars poll={s.poll} big />
          <p className="present-meta">Ответили: {s.poll.total} из {online}</p>
        </section>
      ) : (
        <section className="present-main">
          <div className="present-stage">
            <p className="present-kicker">Сейчас</p>
            <h1>{current ? current.title : 'Ждём начала урока'}</h1>
            <ol className="present-steps" aria-label="Этапы урока">
              {lesson.stages.map((st, i) => {
                const open = opened.includes(st);
                return <li key={st.id} className={`${open ? 'open' : ''}${st === current ? ' now' : ''}`}>
                  <span aria-hidden="true">{open ? '✓' : i + 1}</span> {st.title}<span className="sr-only">{open ? ' — открыт' : ' — закрыт'}</span></li>;
              })}
            </ol>
          </div>
          <div className="present-class">
            {!!view.race?.length && (
              <div className="present-race">
                <p className="present-kicker">Гонка экипажей</p>
                <RaceBoard rows={view.race} />
              </div>
            )}
            <p className="present-kicker">Класс</p>
            <p className="present-big">{online}<span> в сети из {n}</span></p>
            {missionStage && (
              <ol className="present-missions" aria-label="Задания: сколько учеников сдали">
                {lesson.orders.map((o) => {
                  const done = view.students.filter((st) => studentDone(st, o.file)).length;
                  return (
                    <li key={o.file}>
                      <span className="present-m-title">{o.id} «{o.title}»</span>
                      <span className="poll-bar-track" aria-hidden="true"><span className="poll-bar-fill" style={{ transform: `scaleX(${n ? done / n : 0})` }} /></span>
                      <span className="present-m-num">{done}/{n}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      )}
      {s.message && !s.attention.on && <footer className="present-msg">✉ {s.message.text}</footer>}
    </div>
  );
}

export default Projector;
