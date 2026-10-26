import { Link, useParams } from 'react-router-dom';
import { TopBar } from '../components/Shell';
import { LESSONS, SKILLS, charName, lessonOrders, orderByFile } from '../content';
import { BKT, mastered } from '../lib/bkt';
import { starsText } from '../lib/economy';
import { diagGrowth, signed } from '../lib/diagnostics';
import { lessonStates, pickLesson, trackLessons } from '../lib/lessons';
import { dayUnlocked } from '../lib/progress';
import { activeSession, useLesson } from '../lesson/lessonStore';
import { BADGES, UPGRADES, reputation, useGame } from '../store';


export function ShopApp() {
  const { coins, upgrades, buy } = useGame();
  return (
    <div className="stack">
        <p className="muted small">Премия тратится только на оснащение зала бюро: покупка сразу появится в зале. На уроки и оценку она не влияет.</p>
        <div className="stack">
          <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {UPGRADES.map((u) => {
              const owned = upgrades.includes(u.id);
              return (
                <li key={u.id} className="card flat row" style={{ padding: 'var(--s2) var(--s3)' }}>
                  <span className="stack-sm" style={{ gap: 0, flex: 1, minWidth: 160 }}><strong>{u.title}</strong><span className="small muted">{u.about}</span></span>
                  {owned ? <span className="chip">✓ В зале</span> : (
                    <button className="btn small" disabled={coins < u.price} onClick={() => buy(u.id, u.price)}
                      aria-label={`Получить со склада «${u.title}» за ${u.price} премии`}>
                      <span className="coin" aria-hidden="true" />{u.price}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
    </div>
  );
}

export function ReviewsApp() {
  const { orders } = useGame();
  const subs = Object.entries(orders).flatMap(([id, p]) => p.submissions.map((s) => ({ ...s, id, title: orderByFile(id)?.title ?? id,
    client: orderByFile(id)?.client_id ?? '' }))).sort((a, b) => a.at - b.at);
  // Reputation after each submission (moving average of the last 10).
  const series = subs.map((_, i) => {
    const w = subs.slice(Math.max(0, i - 9), i + 1);
    return Math.round((w.reduce((n, s) => n + s.stars, 0) / w.length) * 20);
  });
  const W = 560, H = 160;
  const pts = series.map((v, i) => `${series.length === 1 ? W / 2 : (i / (series.length - 1)) * (W - 40) + 20},${H - 20 - (v / 100) * (H - 40)}`).join(' ');
  return (
    <div className="stack">
        <p>Надёжность бюро: <strong>{reputation(orders)}%</strong></p>
        {series.length > 0 && (
          <figure className="card flat" style={{ margin: 0, padding: 'var(--s2)' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`График надёжности бюро: ${series.join(', ')}`}>
              {[0, 50, 100].map((v) => <g key={v}><line x1={20} x2={W - 20} y1={H - 20 - (v / 100) * (H - 40)} y2={H - 20 - (v / 100) * (H - 40)}
                stroke="var(--muted)" strokeOpacity={0.3} /><text x={2} y={H - 16 - (v / 100) * (H - 40)} fontSize={11} fill="var(--muted)">{v}</text></g>)}
              <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinejoin="round" />
              {series.map((v, i) => { const [x, y] = pts.split(' ')[i].split(','); return <circle key={i} cx={x} cy={y} r={5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2}><title>{v}</title></circle>; })}
            </svg>
            <figcaption className="small muted">Надёжность после каждой сдачи (среднее последних 10 оценок × 20)</figcaption>
          </figure>
        )}
        <ol className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[...subs].reverse().map((s) => (
            <li key={`${s.id}-${s.at}`} className="card flat" style={{ padding: 'var(--s3)', gap: 'var(--s1)' }}>
              <div className="row"><strong>{s.title}</strong><span className="chip">{s.version}</span><span className="spacer" /><span className="stars" aria-label={`${s.stars} из 5`}>{starsText(s.stars)}</span></div>
              <span>«{s.review}» <span className="muted">— {charName(s.client)}</span></span>
              {s.complaints.length > 1 && <span className="small muted">Ещё замечания: {s.complaints.slice(1).join(' ')}</span>}
            </li>
          ))}
          {!subs.length && <li className="muted">Пока пусто. Сдай первую программу на испытания!</li>}
        </ol>
    </div>
  );
}

export function SkillsApp() {
  const { skills, badges, orders, dialogues, stagesDone, settings } = useGame();
  const session = useLesson((s) => activeSession(s));
  const lessons = trackLessons(LESSONS, session ? 'course' : settings.track);
  const current = pickLesson(lessons, stagesDone, session ? session.lesson : null);
  const unlock = current ? dayUnlocked(current, orders, skills) : null;
  const growth = diagGrowth(dialogues);
  const label = { done: '✓ пройдено', current: '▶ сейчас', closed: '🔒 закрыто' } as const;
  return (
    <div className="stack">
        <section className="stack-sm" aria-labelledby="days-h">
          <h2 id="days-h">Занятия (темы)</h2>
          <div className="order-grid">
            {lessonStates(lessons, stagesDone, current).map(({ lesson: l, state }) => (
              <div key={l.id} className={`card order-card ${state === 'closed' ? 'locked' : ''}`}>
                <span className="chip">Занятие {l.number} · {label[state]}</span><strong>{l.title}</strong><span className="small muted">{l.goal}</span>
                {state === 'current' && unlock && (
                  <span className="small">Итоговое задание: {unlock.bossOk ? '✓ принято' : '✗ ещё нет'} · навыков освоено: {Math.round(unlock.mastery * 100)}%</span>
                )}
                {state === 'closed' && <span className="small muted">Откроется после «Конца смены» предыдущего занятия или по решению преподавателя.</span>}
              </div>
            ))}
          </div>
        </section>
        <section className="stack-sm" aria-labelledby="skills-h">
          <h2 id="skills-h">Навыки</h2>
          <p className="small muted">Оценка освоения по модели BKT: растёт с верными ответами, порог «освоено» — {Math.round(BKT.mastery * 100)}%.</p>
          {(growth.a || growth.b) && (
            <div className="card flat stack-sm" style={{ padding: 'var(--s3)' }}>
              <strong>Входная и итоговая проверка</strong>
              {growth.a && <span className="small">Диагностика A (занятие 0): {growth.a.correct} из {growth.a.total} верно.</span>}
              {growth.b && <span className="small">Диагностика B (занятие 3): {growth.b.correct} из {growth.b.total} верно.</span>}
              {growth.gain !== null && growth.gainPct !== null && (
                <span><strong>Прирост: {signed(growth.gain)}</strong> {Math.abs(growth.gain) % 10 === 1 && Math.abs(growth.gain) % 100 !== 11 ? 'ответ' : 'ответов'} ({signed(growth.gainPct)} п. п.)
                  {growth.gain > 0 ? ' — ты вырос за курс!' : ' — повтори темы в Тетради, где были ошибки.'}</span>
              )}
              {growth.a && !growth.b && <span className="small muted">Итоговая проверка будет в конце занятия 3: те же темы, другие примеры.</span>}
            </div>
          )}
          <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {SKILLS.map((s) => {
              const p = skills[s.id] ?? BKT.pInit;
              return (
                <li key={s.id} className="row">
                  <span style={{ minWidth: 200 }}>{s.title}</span>
                  <span role="meter" aria-label={s.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}
                    style={{ flex: 1, minWidth: 120, height: 14, border: '2px solid var(--ink)', borderRadius: 8, background: 'var(--surface)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${p * 100}%`, background: mastered(p) ? 'var(--ok)' : 'var(--accent)' }} />
                  </span>
                  <span className="small" style={{ minWidth: 90 }}>{Math.round(p * 100)}% {mastered(p) ? '✓ освоено' : ''}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="stack-sm" aria-labelledby="badges-h">
          <h2 id="badges-h">Значки</h2>
          <ul className="row" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {Object.entries(BADGES).map(([id, b]) => {
              const got = badges.includes(id);
              return <li key={id} className={`chip ${got ? '' : 'muted'}`} style={{ opacity: got ? 1 : 0.55 }} title={b.about}>{got ? '🏅' : '○'} {b.title}<span className="sr-only">{got ? ' — получен' : ' — ещё нет'}</span></li>;
            })}
          </ul>
        </section>
    </div>
  );
}

export function MailApp({ onOpen }: { onOpen?: (link: string) => void }) {
  const { letters, readLetter } = useGame();
  return (
    <div className="stack">
        <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {letters.map((l) => (
            <li key={l.id} className="card flat" style={{ padding: 'var(--s3)', gap: 'var(--s1)', borderStyle: l.read ? 'solid' : 'double' }}>
              <div className="row"><strong>{l.title}</strong>{!l.read && <span className="chip">новое</span>}<span className="spacer" /><span className="small muted">от: {l.from}</span></div>
              <p>{l.body}</p>
              <div className="row">
                {!l.read && <button className="btn small" onClick={() => readLetter(l.id)}>Прочитано</button>}
                {l.link && onOpen && <button className="btn small primary" onClick={() => { readLetter(l.id); onOpen(l.link!); }}>Открыть →</button>}
              </div>
            </li>
          ))}
        </ul>
    </div>
  );
}

/** Lesson plan for the teacher, generated from content. */
export function Plan() {
  const { n = '0' } = useParams();
  const lesson = LESSONS.find((l) => String(l.number) === n);
  if (!lesson) return <><TopBar /><main className="page">Нет такого занятия.</main></>;
  const orders = lessonOrders(lesson);
  return (
    <>
      <TopBar crumbs={<><Link to="/">«Поехали!»</Link> › <Link to="/teacher">Пульт урока</Link> › <span>План урока</span></>} />
      <main className="page read plan">
        <div className="row"><h1>План урока: {lesson.title}</h1><span className="spacer" /><Link className="btn small ghost" to={`/print/${lesson.number}`}>Материалы для учеников</Link><button className="btn small" onClick={() => window.print()}>Печать</button></div>
        <table className="plan-table"><tbody>
          <tr><th scope="row">Цель</th><td>{lesson.goal}</td></tr>
          <tr><th scope="row">Результат</th><td>{lesson.result}</td></tr>
          <tr><th scope="row">Знать / уметь / владеть</th><td><p><b>Знать:</b> {lesson.results.know}</p><p><b>Уметь:</b> {lesson.results.can}</p><p><b>Владеть:</b> {lesson.results.own}</p></td></tr>
          <tr><th scope="row">Компетенции</th><td>{lesson.competencies.join(', ')}</td></tr>
          <tr><th scope="row">Строки программы</th><td>{lesson.program_lines.join('; ')}</td></tr>
        </tbody></table>
        {lesson.teacher && <div className="alert hint"><strong>Общее</strong><span>{lesson.teacher.say}</span>{lesson.teacher.stuck && <span>Если не успеваете: {lesson.teacher.stuck}</span>}</div>}
        {lesson.stages.map((s, i) => (
          <section key={s.id} className="card flat">
            <h2>{i + 1}. {s.title} {(s.minutes ?? lesson.timing[i]?.[1]) && <span className="chip">{s.minutes ?? lesson.timing[i]?.[1]} мин</span>}</h2>
            {s.teacher?.say && <p><strong>Что сказать:</strong> {s.teacher.say}</p>}
            {!!s.teacher?.ask?.length && <div><strong>Вопросы классу:</strong><ul>{s.teacher.ask.map((q) => <li key={q}>{q}</li>)}</ul></div>}
            {!!s.teacher?.mistakes?.length && <div><strong>Типовые ошибки:</strong><ul>{s.teacher.mistakes.map((q) => <li key={q}>{q}</li>)}</ul></div>}
            {s.teacher?.stuck && <p><strong>Если класс застрял:</strong> {s.teacher.stuck}</p>}
            {s.orders && <p className="small muted">Задания: {orders.map((o) => `${o.lesson}.${o.order_no || ''} «${o.title}»`).join(', ')}</p>}
          </section>
        ))}
        <section className="card flat"><h2>Рефлексия</h2><ol>{lesson.reflection.map((q) => <li key={q}>{q}</li>)}</ol></section>
        {lesson.homework && <section className="card flat"><h2>Домашнее задание</h2><p>{lesson.homework}</p></section>}
        <p className="small muted">Оценка выставляется по рубрике; игровая премия на оценку не влияет. Этапы в уроке открываются на пульте: #/teacher.</p>
      </main>
    </>
  );
}
