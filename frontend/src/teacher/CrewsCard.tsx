// Pult: crews for the team «Конец смены» and the «Гонка экипажей». The console splits the class by itself when the
// closing stage opens; the teacher can split earlier (the race then runs the whole lesson), move students, accept.
import { useState } from 'react';
import { Avatar, type AvatarId } from '../art/Avatar';
import { RaceBoard } from '../game/CrewMission';
import { starsText } from '../lib/economy';
import type { CrewView, RaceRow } from '../lib/crew';
import type { ClassStudent } from '../lib/gate';
import type { TeacherLesson } from '../lesson/api';

type Act = (body: { action: 'auto' | 'move' | 'clear' | 'accept'; size?: number; student?: number; crew?: number | null }) => void;

export function CrewsCard({ lesson, crews, race, students, onAct }: {
  lesson: TeacherLesson; crews: CrewView[]; race: RaceRow[]; students: ClassStudent[]; onAct: Act;
}) {
  const [size, setSize] = useState(3);
  const [confirm, setConfirm] = useState<'auto' | 'clear' | null>(null);
  if (!lesson.crew) return null;
  const roles = Object.fromEntries(lesson.crew.parts.map((p) => [p.id, p.role]));
  const placed = new Set(crews.flatMap((c) => c.members.map((m) => m.id)));
  const loose = students.filter((st) => !placed.has(st.id));
  const split = () => { onAct({ action: 'auto', size }); setConfirm(null); };

  return (
    <section className="card stack-sm" aria-labelledby="crews-h">
      <h2 id="crews-h">Экипажи и гонка</h2>
      <p className="small muted">
        В «Конце смены» экипажи по 2–3 человека собирают программу «{lesson.crew.title}» из частей ({lesson.crew.parts.map((p) => p.role).join(' → ')}).
        Пульт разобьёт класс сам при открытии этапа; разбейте раньше — и гонка экипажей пойдёт весь урок. Места — только у экипажей, не у учеников.
      </p>
      <div className="row">
        <span className="small">Человек в экипаже:</span>
        <div className="t-seg-row" role="group" aria-label="Размер экипажа">
          {[2, 3, 4].map((n) => <button key={n} className="btn small" aria-pressed={size === n} onClick={() => setSize(n)}>{n}</button>)}
        </div>
        <span className="spacer" />
        {crews.length ? (
          <>
            <button className="btn small" onClick={() => setConfirm('auto')}>Разбить заново…</button>
            <button className="btn small ghost" onClick={() => setConfirm('clear')}>Убрать экипажи…</button>
          </>
        ) : <button className="btn small" onClick={split} disabled={!students.length}>Разбить на экипажи</button>}
      </div>
      {confirm && (
        <div className="alert bad">
          <span>{confirm === 'auto' ? 'Разбить класс заново? Части программ, чаты и очки экипажей обнулятся.' : 'Убрать все экипажи? Части программ и чаты удалятся.'}</span>
          <div className="row">
            <button className="btn" onClick={() => (confirm === 'auto' ? split() : (onAct({ action: 'clear' }), setConfirm(null)))}>
              {confirm === 'auto' ? 'Да, разбить заново' : 'Да, убрать'}</button>
            <button className="btn ghost" onClick={() => setConfirm(null)} autoFocus>Отмена</button>
          </div>
        </div>
      )}
      {!!race.length && <RaceBoard rows={race} />}
      {!!crews.length && (
        <ul className="t-crews">
          {crews.map((c) => (
            <li key={c.id} className={`t-crew${c.launched ? ' done' : ''}`}>
              <div className="row">
                <strong className="t-grow">«{c.name}»</strong>
                <span className="small">{c.stars ? <span className="stars">{starsText(c.stars)}</span> : 'не испытана'}{c.launched ? ' · 🚀 старт' : ''}
                  {c.checks ? ` · испытаний ${c.checks}` : ''}{c.accepted ? ' · зачтено' : ''}</span>
              </div>
              <ul className="t-list">
                {c.members.map((m) => (
                  <li key={m.id} className="row">
                    <Avatar id={m.avatar as AvatarId} size={28} />
                    <span className="t-grow">{m.nick} <span className="small muted">— {m.parts.map((p) => roles[p] ?? p).join(', ') || 'испытатель'}{m.online ? '' : ' · не в сети'}</span></span>
                    <select className="t-input t-select t-move" value="" aria-label={`Переставить ${m.nick} в другой экипаж`}
                      onChange={(e) => { if (e.target.value) onAct({ action: 'move', student: m.id, crew: e.target.value === 'new' ? null : Number(e.target.value) }); }}>
                      <option value="" disabled>Переставить…</option>
                      {crews.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>в «{x.name}»</option>)}
                      <option value="new">в новый экипаж</option>
                    </select>
                  </li>
                ))}
              </ul>
              <div className="row">
                {!c.launched && <button className="btn small ghost" onClick={() => onAct({ action: 'accept', crew: c.id })}>Зачесть программу (3★)</button>}
                {!!c.chat.length && (
                  <details className="t-details t-grow"><summary>Чат экипажа · {c.chat.length}</summary>
                    <ol className="t-chat">{c.chat.slice(-12).map((msg) => <li key={msg.id}><strong>{msg.nick}:</strong> {msg.text}</li>)}</ol>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!!crews.length && loose.length > 0 && (
        <div className="stack-sm">
          <strong>Без экипажа</strong>
          <ul className="t-list">
            {loose.map((st) => (
              <li key={st.id} className="row">
                <span className="t-grow">{st.nick}</span>
                <select className="t-input t-select t-move" value="" aria-label={`Добавить ${st.nick} в экипаж`}
                  onChange={(e) => { if (e.target.value) onAct({ action: 'move', student: st.id, crew: e.target.value === 'new' ? null : Number(e.target.value) }); }}>
                  <option value="" disabled>В экипаж…</option>
                  {crews.map((x) => <option key={x.id} value={x.id}>«{x.name}»</option>)}
                  <option value="new">новый экипаж</option>
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
