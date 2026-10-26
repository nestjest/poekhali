import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { Character, type CharacterId } from '../art/Character';
import { HOTSPOT_ANCHORS, StudioRoom, type HotspotId } from '../art/StudioRoom';
import { KIND_RU, charName, lessonOrders, orderFileId } from '../content';
import { placeLabel, pointsWord } from '../lib/crew';
import { starsText } from '../lib/economy';
import { effectiveStars, orderAllowed } from '../lib/gate';
import { STATUS_RU, missingSkills, orderStatus } from '../lib/progress';
import { activeSession, useLesson } from '../lesson/lessonStore';
import { useGame } from '../store';
import type { Lesson, Stage } from '../types';
import { InWorldPanel } from './StoryPlayer';

export const LABELS: Record<HotspotId, string> = {
  orders: 'Окно заданий', desk: 'Рабочее место', board: 'Класс подготовки', cabinet: 'Архив', mail: 'Пневмопочта',
  shop: 'Склад', reviews: 'Журнал миссий', door: 'Выход', museum: 'Музей бюро', orbit: 'Карта орбит',
};

export const OBJECTIVE: Record<string, string> = {
  konspekt: 'В класс подготовки: Ольга проведёт инструктаж',
  diagnostic: 'Короткий тест у Ольги: что улеглось после инструктажа',
  briefing: 'Планёрка в классе: Вика и Макс уже ждут',
  orders: 'К окну заданий: Зоя Андреевна принесла первое задание',
  review: 'Разбор полётов за твоим рабочим местом',
  diagnostic_b: 'Итоговая проверка: Ольга ждёт в классе подготовки',
  closing: 'Конец смены — к выходу: экипаж собирает стартовую программу',
};

const FEATURE_OF: Partial<Record<HotspotId, string>> = {
  orders: 'orders', cabinet: 'notebook', mail: 'mail', shop: 'shop', reviews: 'reviews', museum: 'museum', orbit: 'orbit',
};

export function Hub({ lesson, next, waiting: waitingFor, onHotspot, onStartNext, queueOpen, onCloseQueue, onPickOrder, onCrew }: {
  lesson: Lesson; next: Stage | undefined; waiting: boolean; onHotspot: (id: HotspotId) => void; onStartNext: () => void;
  queueOpen: boolean; onCloseQueue: () => void; onPickOrder: (fileId: string) => void; onCrew?: () => void;
}) {
  const g = useGame();
  const session = useLesson((s) => activeSession(s));
  const grants = useLesson((s) => s.me?.grants);
  const crew = useLesson((s) => (session ? s.crew : null));
  const crewRow = useLesson((s) => (crew ? s.race.find((r) => r.id === crew.id) : undefined));
  const reduce = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const enabled = (Object.keys(LABELS) as HotspotId[]).filter((h) =>
    h === next?.hotspot || (FEATURE_OF[h] && g.features.includes(FEATURE_OF[h]!)) ||
    (h === 'desk' && g.features.includes('orders')) || (h === 'board' && g.features.includes('board')));
  const highlight = waitingFor ? undefined : next?.hotspot as HotspotId | undefined;
  const orders = lessonOrders(lesson);
  // A mission the teacher accepted counts as done (even without a passing submission).
  const statusOf = (fileId: string, o: (typeof orders)[number]) =>
    grants?.accepted?.includes(fileId) ? 'accepted' as const : orderStatus(o, g.orders[fileId], g.introduced);
  // One primary button on the screen: the first mission that is open and not done yet.
  const firstOpen = orders.map((o) => orderFileId(o))
    .find((id, i) => orderAllowed(session, id) && ['new', 'progress', 'revision'].includes(statusOf(id, orders[i])));
  const queued = orders.filter((o) => ['new', 'progress', 'revision'].includes(statusOf(orderFileId(o), o))).length;

  let objective = next && (OBJECTIVE[next.id] ?? `Дальше: «${next.title}»`);
  if (next?.id === 'orders') objective = `К окну заданий: ${charName(lesson.client_id)} ждёт с первым заданием`;
  if (next?.id === 'orders' && orders.some((o) => g.orders[orderFileId(o)]?.submissions.length)) {
    objective = `Окно заданий: ждут ${queued}. Финал смены — «${orders[orders.length - 1].title}» на 3★`;
  }
  if (waitingFor && next) objective = `Ждём команду ЦУП: этап «${next.title}» откроет преподаватель`;

  return (
    <div className="hub" onPointerMove={(e) => {
      if (reduce) return;
      setTilt({ x: (e.clientX / window.innerWidth - 0.5) * 2, y: (e.clientY / window.innerHeight - 0.5) * 2 });
    }}>
      <div className="hub-room">
        <StudioRoom upgrades={g.upgrades} onHotspot={onHotspot} labels={LABELS} tilt={tilt} enabled={enabled} highlight={highlight}
          satellites={g.launched.length}
          badges={{ orders: g.features.includes('orders') ? queued : 0, mail: g.features.includes('mail') ? g.letters.filter((l) => !l.read).length : 0 }} />
        {enabled.map((id) => (
          <span key={id} className={`hotspot-label ${id === highlight ? 'goal' : ''}`} aria-hidden="true"
            style={{ left: `${(HOTSPOT_ANCHORS[id].x / 1200) * 100}%`, top: `${(HOTSPOT_ANCHORS[id].y / 700) * 100}%` }}>{LABELS[id]}</span>
        ))}
      </div>
      {/* Narrow screens: the hall is small, so the same objects are also big buttons (touch targets ≥ 44 px). */}
      <nav className="hub-nav" aria-label="Объекты зала">
        {enabled.map((id) => (
          <button key={id} className={`btn small${id === highlight ? ' primary' : ''}`} onClick={() => onHotspot(id)}>
            {LABELS[id]}{id === 'orders' && queued > 0 && <span className="badge-dot">{queued}</span>}
          </button>
        ))}
      </nav>
      {crew && crewRow && onCrew && (
        <button className="btn small race-chip" onClick={onCrew} aria-label={`Гонка экипажей: «${crew.name}», ${placeLabel(crewRow.rank)}, ${crewRow.points} ${pointsWord(crewRow.points)}`}>
          <span aria-hidden="true">🏁</span> «{crew.name}»: {placeLabel(crewRow.rank)} · {crewRow.points} {pointsWord(crewRow.points)}
        </button>
      )}
      {objective && (
        <motion.div key={`${next?.id}-${waitingFor}`} className={`objective${waitingFor ? ' wait' : ''}`} role="status"
          initial={reduce ? false : { y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <span className="objective-pin" aria-hidden="true">{waitingFor ? '⏸' : '📌'}</span> {objective}
          {highlight && <button className="btn small primary" onClick={() => onHotspot(highlight)}>Идти</button>}
          {!highlight && !waitingFor && next && <button className="btn small primary" onClick={onStartNext}>Начать</button>}
        </motion.div>
      )}
      <AnimatePresence>
        {queueOpen && (
          <div className="world-dim" onClick={onCloseQueue}>
            <div onClick={(e) => e.stopPropagation()}>
              <InWorldPanel label="Окно заданий">
                <div className="row"><h2 style={{ fontSize: 'var(--fs-h3)' }}>Задания у окна</h2><span className="spacer" />
                  <button className="btn ghost small" onClick={onCloseQueue} aria-label="Закрыть">✕</button></div>
                <ul className="queue">
                  {orders.map((o) => {
                    const id = orderFileId(o);
                    const st = statusOf(id, o);
                    const closed = !orderAllowed(session, id);
                    const best = effectiveStars(g.orders[id]?.bestStars ?? 0, grants, id);
                    const byTeacher = !!grants?.accepted?.includes(id) && (g.orders[id]?.bestStars ?? 0) < 3;
                    return (
                      <li key={id} className={`queue-item ${closed ? 'locked' : st}`}>
                        {!g.settings.classic && <Character id={o.client_id as CharacterId} mood={st === 'locked' || closed ? 'thinking' : 'joy'} size={56} />}
                        <span className="stack-sm" style={{ gap: 2, flex: 1, minWidth: 0 }}>
                          <strong>{o.title}</strong>
                          <span className="small muted">{charName(o.client_id)} · {KIND_RU[o.kind]} · {closed ? 'Закрыто преподавателем' : STATUS_RU[st]}
                            {best ? ` · ${starsText(best)}` : ''}{byTeacher ? ' · зачтено преподавателем' : ''}</span>
                          {st === 'locked' && !closed && <span className="small">Сначала нужно: {missingSkills(o, g.introduced).join(', ')}</span>}
                        </span>
                        {st !== 'locked' && !closed && <button className={`btn small ${id === firstOpen ? 'primary' : ''}`} onClick={() => onPickOrder(id)}>
                          {st === 'accepted' ? 'Улучшить' : st === 'revision' ? 'Доработать' : st === 'progress' ? 'Продолжить' : 'Взять'}</button>}
                      </li>
                    );
                  })}
                </ul>
              </InWorldPanel>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
