// /#/print/:n — printable materials of a lesson: student's notes, reflection sheet, criteria and rubric.
// Generated from content (lessons, missions); printed from the browser (Ctrl+P → «Сохранить как PDF»).
import { Link, useParams } from 'react-router-dom';
import { TopBar } from '../components/Shell';
import { LESSONS, lessonOrders } from '../content';

export const RUBRIC: [string, number, string][] = [
  ['Функциональность', 50, 'программы заданий проходят испытания (видимые и скрытые)'],
  ['Отладка', 20, 'находит и исправляет ошибки по замечаниям заказчика и сообщениям Python'],
  ['Стиль', 10, 'понятные имена переменных, PEP 8, без лишнего кода'],
  ['Самостоятельность', 10, 'подсказки — только когда нужны; объясняет своё решение'],
  ['Перенос в среду разработки', 10, 'запускает скачанный .py в Thonny / IDLE'],
];
export const GRADES: [number, string][] = [[85, '5'], [70, '4'], [50, '3']];

const KIND_RU: Record<string, string> = {
  regular: 'задание', boss: 'итоговое', bugreport: 'замечание телеметрии', refactor: 'доработка',
  urgent: 'срочное (бонус)', team: 'командное', review: 'разбор кода',
};

const Lines = ({ n }: { n: number }) => <div className="print-lines" aria-hidden="true">{Array.from({ length: n }, (_, i) => <span key={i} />)}</div>;

export function PrintKit() {
  const { n = '0' } = useParams();
  const lesson = LESSONS.find((l) => String(l.number) === n);
  if (!lesson) return <><TopBar /><main className="page">Нет такого занятия.</main></>;
  const orders = lessonOrders(lesson);
  return (
    <>
      <TopBar crumbs={<><Link to="/">«Поехали!»</Link> › <Link to="/teacher">Пульт урока</Link> › <span>Печатные материалы</span></>} />
      <main className="page read print-kit">
        <div className="row no-print">
          <h1>Печатные материалы: занятие {lesson.number}</h1>
          <span className="spacer" />
          <Link className="btn small ghost" to={`/plan/${lesson.number}`}>План урока</Link>
          <button className="btn small primary" onClick={() => window.print()}>Печать / PDF</button>
        </div>
        <nav className="row no-print" aria-label="Другие занятия">
          {LESSONS.map((l) => <Link key={l.number} className="btn small ghost" aria-current={l === lesson ? 'page' : undefined} to={`/print/${l.number}`}>Занятие {l.number}</Link>)}
        </nav>
        <p className="small muted no-print">Каждый лист начинается с новой страницы. В диалоге печати можно выбрать «Сохранить как PDF».</p>

        {/* ---------------- 1. student's notes */}
        <section className="print-sheet" aria-labelledby="ps-notes">
          <header className="print-head"><span>«Поехали!» · Занятие {lesson.number}</span><span>Имя / псевдоним: ____________ Группа: ______</span></header>
          <h2 id="ps-notes">Конспект: {lesson.title}</h2>
          <p><strong>Цель:</strong> {lesson.goal}</p>
          <div className="print-cards">
            {lesson.notebook.map((c) => (
              <article key={c.id} className="print-card">
                <h3>{c.title}</h3>
                <p className="small"><strong>Как пишется:</strong></p>
                <pre className="print-code">{c.syntax}</pre>
                <p className="small"><strong>Пример:</strong></p>
                <pre className="print-code">{c.example}</pre>
                <p className="small"><strong>Частая ошибка:</strong> {c.mistake}</p>
              </article>
            ))}
          </div>
          <h3>Мои заметки</h3>
          <Lines n={6} />
        </section>

        {/* ---------------- 2. reflection */}
        <section className="print-sheet" aria-labelledby="ps-refl">
          <header className="print-head"><span>«Поехали!» · Занятие {lesson.number}</span><span>Имя / псевдоним: ____________ Группа: ______</span></header>
          <h2 id="ps-refl">Лист рефлексии</h2>
          <table className="plan-table print-scale">
            <thead><tr><th scope="col">Я могу…</th><th scope="col">ещё нет</th><th scope="col">с подсказкой</th><th scope="col">сам(а)</th></tr></thead>
            <tbody>
              {[lesson.results.know, lesson.results.can, lesson.results.own].map((r) => (
                <tr key={r}><td>{r}</td><td>☐</td><td>☐</td><td>☐</td></tr>
              ))}
            </tbody>
          </table>
          <ol className="print-questions">
            {lesson.reflection.map((q) => <li key={q}><p>{q}</p><Lines n={2} /></li>)}
          </ol>
          {lesson.homework && <p><strong>Домашнее задание:</strong> {lesson.homework}</p>}
        </section>

        {/* ---------------- 3. criteria and rubric */}
        <section className="print-sheet" aria-labelledby="ps-rubric">
          <header className="print-head"><span>«Поехали!» · Занятие {lesson.number}</span><span>Имя / псевдоним: ____________ Группа: ______</span></header>
          <h2 id="ps-rubric">Критерии и рубрика оценки</h2>
          <p className="small">Оценку ставит преподаватель по рубрике. Игровая премия и надёжность бюро на оценку не влияют.</p>
          <table className="plan-table">
            <thead><tr><th scope="col">Критерий</th><th scope="col">Вес</th><th scope="col">Что смотрим</th><th scope="col">Баллы</th></tr></thead>
            <tbody>
              {RUBRIC.map(([name, w, what]) => <tr key={name}><td>{name}</td><td>{w} %</td><td>{what}</td><td>____</td></tr>)}
              <tr><th scope="row">Итого</th><td>100 %</td><td>{GRADES.map(([p, g]) => `≥ ${p} % — «${g}»`).join(' · ')}</td><td>____</td></tr>
            </tbody>
          </table>
          <h3>Задания занятия</h3>
          <table className="plan-table">
            <thead><tr><th scope="col">№</th><th scope="col">Задание</th><th scope="col">Требования ТЗ</th><th scope="col">★ (1–5)</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.id}</td>
                  <td>{o.title}<br /><span className="small muted">{KIND_RU[o.kind] ?? o.kind}</span></td>
                  <td><ul className="print-reqs">{o.requirements.map((r) => <li key={r.id}>☐ {r.text}</li>)}</ul></td>
                  <td>____</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small">Звёзды задания: балл судьи 0–100 (видимые испытания 40, скрытые 30, стиль 10, самостоятельность 10, точность уточнения 10). Задание принято при 3★ и выше.</p>
        </section>
      </main>
    </>
  );
}

export default PrintKit;
