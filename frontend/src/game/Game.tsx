import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { HotspotId } from '../art/StudioRoom';
import { TitleArt } from '../art/TitleArt';
import { Settings } from '../components/Shell';
import { DIALOGUES, LESSONS, lessonOrders, orderByFile, orderFileId } from '../content';
import { openExhibits } from '../lib/crafts';
import { effectiveStars, orderAllowed, stageAllowed, type Grants } from '../lib/gate';
import { pickLesson, skippedStage, trackLessons, type Track } from '../lib/lessons';
import { bossOf, stageKey } from '../lib/progress';
import { AttentionOverlay, HelpBell, JoinLesson, LessonBadge, PollCard, useLessonSync, WaitPanel } from '../lesson/LessonLayer';
import { activeSession, useLesson } from '../lesson/lessonStore';
import { useGame } from '../store';
import type { Lesson, Stage } from '../types';
import { Hub } from './Hub';
import { OrderFlow } from './OrderFlow';
import { PauseMenu, Phone, PhoneButton, type AppId } from './Phone';
import { InWorldPanel, StoryPlayer } from './StoryPlayer';
import { Toasts, useToasts } from './Toasts';

type G = ReturnType<typeof useGame.getState>;

export function isStageDone(lesson: Lesson, stage: Stage, g: G, grants?: Grants) {
  if (skippedStage(stage.id, g.settings.track)) return true;
  if (stage.orders) {
    const boss = bossOf(lesson);
    if (!boss) return false;
    const id = orderFileId(boss);
    return effectiveStars(g.orders[id]?.bestStars ?? 0, grants, id) >= 3;
  }
  return g.stagesDone.includes(stageKey(lesson, stage.id));
}

export function nextStage(lesson: Lesson, g: G, grants?: Grants) {
  return lesson.stages.find((s) => !isStageDone(lesson, s, g, grants));
}

/** The whole game: no website chrome — title, scenes, bureau hall, phone, pause. */
export function Game() {
  const g = useGame();
  const toast = useToasts((t) => t.push);
  const session = useLesson((s) => activeSession(s));
  const grants = useLesson((s) => s.me?.grants);
  const [phone, setPhone] = useState<{ open: boolean; app: AppId | null }>({ open: false, app: null });
  const [pause, setPause] = useState(false);
  const [queue, setQueue] = useState(false);
  const [wait, setWait] = useState(false);
  // Teacher-led: the session's lesson; solo: the first lesson whose «Конец смены» is not done
  // (in «Знакомство» — only among lessons 0–1).
  const track: Track = session ? 'course' : g.settings.track ?? 'course';
  const lessons = trackLessons(LESSONS, track);
  const lesson = pickLesson(lessons, g.stagesDone, session ? session.lesson : null) ?? LESSONS[0];
  const where = g.where;
  const next = lesson ? nextStage(lesson, g, grants) : undefined;
  const blocked = !!next && !stageAllowed(session, next.id);

  useLessonSync(lesson, next, blocked && where.kind !== 'story');

  // Esc → pause menu (phone handles its own Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || where.kind === 'title' || phone.open) return;
      if (queue) { setQueue(false); return; }
      if (wait) { setWait(false); return; }
      setPause((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [where.kind, phone.open, queue, wait]);

  // The teacher opened the stage we were waiting for: close the panel and start automatic stages.
  // Only on the transition «closed → open», not on every mount of the hall.
  const wasBlocked = useRef(blocked);
  useEffect(() => {
    const opened = wasBlocked.current && !blocked;
    wasBlocked.current = blocked;
    if (!opened || where.kind !== 'hub' || !next) return;
    setWait(false);
    if (next.auto) startStage(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  // New museum exhibits → a notification.
  useEffect(() => {
    if (!g.features.includes('museum')) return;
    const fresh = openExhibits(g, grants).filter((ex) => !g.museumSeen.includes(ex.id));
    if (!fresh.length) return;
    g.seeExhibits(fresh.map((ex) => ex.id));
    if (g.museumSeen.length) toast('Новое в Музее бюро', `Изучи: ${fresh.map((ex) => ex.title).join(', ')}. Заказчики о них спросят.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.stagesDone.length, g.orders, grants, g.features.length]);

  if (!lesson) return <p style={{ padding: 24 }}>Контент не найден.</p>;

  const startStage = (stage: Stage) => {
    if (!stageAllowed(useLesson.getState().mode === 'lesson' ? useLesson.getState().session : null, stage.id)) {
      g.goTo({ kind: 'hub' });
      setWait(true);
      return;
    }
    if (stage.dialogue && DIALOGUES[stage.dialogue]) {
      g.setDialogue(stage.dialogue, { pos: 0, done: false, correct: 0, total: 0 });
      g.goTo({ kind: 'story', dialogue: stage.dialogue, stage: stage.id });
    } else if (stage.orders) setQueue(true);
  };

  const finishStory = (stageId: string) => {
    const stage = lesson.stages.find((s) => s.id === stageId);
    if (!stage) { g.goTo({ kind: 'hub' }); return; }
    g.finishStage(stageKey(lesson, stage.id));
    if (stage.unlocks?.length) g.unlock(stage.unlocks);
    const st = useGame.getState();
    if (stage.id === 'closing') {
      const after = pickLesson(lessons, st.stagesDone, session ? session.lesson : null);
      if (after && after !== lesson) {
        // The next lesson opens: its first scene starts right away (if the teacher allows it).
        toast(`Открыто занятие ${after.number}`, after.title);
        const first = after.stages[0];
        if (first?.auto) { startStage(first); return; }
        g.goTo({ kind: 'hub' });
        return;
      }
      toast('Смена закрыта!', track === 'intro'
        ? 'Знакомство пройдено! Весь курс — 4 занятия и демо: выключи «Знакомство» в настройках, прогресс сохранится.'
        : 'Можно улучшать программы и оснащать зал бюро.');
    }
    const nxt = nextStage(lesson, st, grants);
    if (nxt?.auto) startStage(nxt);
    else g.goTo({ kind: 'hub' });
  };

  const onHotspot = (id: HotspotId) => {
    if (next?.hotspot === id && !next.orders) return startStage(next);
    if (id === 'orders') return stageAllowed(session, 'orders') ? setQueue(true) : setWait(true);
    if (id === 'desk') {
      const active = lessonOrders(lesson).find((o) => { const p = g.orders[orderFileId(o)]; return p && p.stage > 1 && (p.bestStars < 3 || p.needsRevision); });
      if (active && orderAllowed(session, orderFileId(active))) return g.goTo({ kind: 'order', id: orderFileId(active) });
      return toast('Рабочее место', 'Сейчас здесь нечего делать: возьми задание у окна.');
    }
    if (id === 'board') return toast('Класс подготовки', 'Все конспекты инструктажа — в Тетради в телефоне.');
    if (id === 'door') return blocked ? setWait(true) : toast('Рано уходить', 'Смена ещё не закончилась.');
    const app: Record<string, AppId> = { cabinet: 'notebook', mail: 'mail', shop: 'shop', reviews: 'reviews', museum: 'museum', orbit: 'orbit' };
    if (app[id]) setPhone({ open: true, app: app[id] });
  };

  const exitOrder = (nextId?: string) => {
    if (Object.values(useGame.getState().orders).some((o) => o.submissions.length)) {
      const fresh = ['coins', 'reviews', 'mail', 'shop', 'skills', 'orbit'].filter((f) => !useGame.getState().features.includes(f));
      if (fresh.length) { g.unlock(fresh); toast('Новое в телефоне', 'Пневмопочта, Журнал миссий, Навыки, Склад и Карта орбит.'); }
    }
    g.goTo(nextId && orderAllowed(session, nextId) ? { kind: 'order', id: nextId } : { kind: 'hub' });
  };

  const resumeGame = (fresh: boolean) => {
    if (fresh) g.reset();
    const st = useGame.getState();
    const ls = useLesson.getState();
    const led = ls.mode === 'lesson' && ls.session && !ls.session.ended ? ls.session.lesson : null;
    const cur = pickLesson(trackLessons(LESSONS, led === null ? st.settings.track : 'course'), st.stagesDone, led) ?? lesson;
    const nxt = nextStage(cur, st, ls.me?.grants);
    if (fresh || !st.stagesDone.length) { if (nxt) startStage(nxt); else g.goTo({ kind: 'hub' }); }
    else g.goTo({ kind: 'hub' });
  };

  let screen: React.ReactNode;
  if (where.kind === 'title') screen = <TitleScreen onStart={resumeGame} />;
  else if (where.kind === 'story' && DIALOGUES[where.dialogue]) screen = <StoryPlayer key={where.dialogue} dialogue={DIALOGUES[where.dialogue]} onFinish={() => finishStory(where.stage)} />;
  else if (where.kind === 'order' && orderByFile(where.id)) screen = <OrderFlow key={where.id} fileId={where.id} order={orderByFile(where.id)!} onExit={exitOrder} />;
  else screen = <Hub lesson={lesson} next={next} waiting={blocked} onHotspot={onHotspot} onStartNext={() => next && startStage(next)} queueOpen={queue} onCloseQueue={() => setQueue(false)}
    onPickOrder={(id) => { if (!orderAllowed(session, id)) return; setQueue(false); g.goTo({ kind: 'order', id }); }}
    onCrew={() => setPhone({ open: true, app: 'crew' })} />;

  const key = where.kind === 'story' ? where.dialogue : where.kind === 'order' ? `o-${where.id}` : where.kind;
  return (
    <div className={`game${session ? ' in-lesson' : ''}`}>
      <AnimatePresence mode="wait">
        <motion.div key={key} className="game-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {screen}
        </motion.div>
      </AnimatePresence>
      {where.kind !== 'title' && (
        <>
          <button className="pause-btn" onClick={() => setPause(true)} aria-label="Пауза (Esc)"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="3" y="2" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="11" y="2" width="4" height="14" rx="1.5" fill="currentColor" /></svg></button>
          {where.kind === 'hub' || where.kind === 'order' ? <PhoneButton onClick={() => setPhone({ open: true, app: null })} /> : null}
          <HelpBell />
        </>
      )}
      {wait && next && where.kind === 'hub' && <WaitPanel stage={next} onClose={() => setWait(false)} />}
      <Phone open={phone.open} initialApp={phone.app} onClose={() => setPhone({ open: false, app: null })} />
      <PauseMenu open={pause} onClose={() => setPause(false)} onPhone={(app) => { setPause(false); setPhone({ open: true, app: app ?? null }); }}
        onTitle={() => { setPause(false); g.goTo({ kind: 'title' }); }} />
      <Toasts />
      <PollCard />
      <AttentionOverlay />
    </div>
  );
}

type TitlePanel = null | 'settings' | 'confirm' | 'join' | 'joined' | 'intro';

function TitleScreen({ onStart }: { onStart: (fresh: boolean) => void }) {
  const reduce = useReducedMotion();
  const hasSave = useGame((s) => s.stagesDone.length > 0 || Object.keys(s.dialogues).length > 0);
  const inLesson = useLesson((s) => s.mode === 'lesson');
  const track = useGame((s) => s.settings.track);
  const [panel, setPanel] = useState<TitlePanel>(null);
  const close = () => setPanel(null);
  return (
    <div className="title-screen">
      <div className="stage-bg"><TitleArt /></div>
      <div className="title-center">
        <motion.h1 className="title-logo" initial={reduce ? false : { y: -30, opacity: 0, rotate: -3 }} animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 12 }}>Поехали!</motion.h1>
        <motion.p className="title-sub" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.4 }}>
          Курс Python с нуля. Первая работа — в Бюро «Космос»: спутники, задания, запуски.
        </motion.p>
        <motion.nav className="title-menu" aria-label="Главное меню" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : 0.6 }}>
          <LessonBadge />
          {hasSave && <button className="btn primary" onClick={() => onStart(false)} autoFocus>{inLesson ? 'Продолжить урок' : 'Продолжить'}</button>}
          {!inLesson && <button className={`btn ${hasSave ? '' : 'primary'}`} onClick={() => setPanel('join')} autoFocus={!hasSave}>Войти в урок</button>}
          {!inLesson && <button className="btn" onClick={() => (hasSave ? setPanel('confirm') : onStart(true))}>Самостоятельно</button>}
          {inLesson && !hasSave && <button className="btn primary" onClick={() => onStart(true)} autoFocus>Начать урок</button>}
          {inLesson && <button className="btn ghost" onClick={() => useLesson.getState().leave()}>Выйти из урока</button>}
          {!inLesson && track !== 'intro' && <button className="btn ghost" onClick={() => setPanel('intro')}>Знакомство для школьников</button>}
          <button className="btn ghost" onClick={() => setPanel('settings')}>Настройки</button>
          <div className="title-teacher" role="group" aria-label="Для преподавателя и экспертов">
            <span className="small muted">Преподавателю:</span>
            <a className="title-link" href="#/teacher">Пульт урока</a>
            <a className="title-link" href="#/plan/0">План урока</a>
            <a className="title-link" href="#/experts">Экспертам</a>
          </div>
        </motion.nav>
      </div>
      {panel && (
        <div className="world-dim" onClick={close}>
          <div onClick={(e) => e.stopPropagation()}>
            <InWorldPanel label={panel === 'settings' ? 'Настройки' : panel === 'join' ? 'Вход в урок' : 'Начало'}>
              {panel === 'settings' && <><h2>Настройки</h2><Settings /><button className="btn primary" onClick={close}>Готово</button></>}
              {panel === 'join' && <JoinLesson onCancel={close} onJoined={() => (hasSave ? setPanel('joined') : onStart(true))} />}
              {panel === 'joined' && (
                <>
                  <h2>Вы в уроке</h2>
                  <p>В этом браузере уже есть сохранение. Продолжить с него или начать занятие заново?</p>
                  <div className="row"><button className="btn primary" onClick={() => onStart(false)} autoFocus>Продолжить</button>
                    <button className="btn" onClick={() => onStart(true)}>Начать заново</button></div>
                </>
              )}
              {panel === 'intro' && (
                <>
                  <h2>Режим «Знакомство»</h2>
                  <p>Два первых занятия: пропуск в бюро, первые программы и запуск «Искорки». Без входной диагностики, около 30–40 минут на занятие.</p>
                  <p className="small muted">Вернуться к полному курсу можно в настройках — прогресс сохранится.</p>
                  <div className="row">
                    <button className="btn primary" autoFocus onClick={() => { useGame.getState().setSettings({ track: 'intro' }); onStart(!hasSave); }}>
                      {hasSave ? 'Включить и продолжить' : 'Начать знакомство'}</button>
                    <button className="btn ghost" onClick={close}>Отмена</button>
                  </div>
                </>
              )}
              {panel === 'confirm' && (
                <>
                  <h2>Начать заново?</h2>
                  <p>Весь прогресс в этом браузере сотрётся.</p>
                  <div className="row"><button className="btn primary" onClick={() => onStart(true)}>Да, заново</button>
                    <button className="btn ghost" onClick={close} autoFocus>Отмена</button></div>
                </>
              )}
            </InWorldPanel>
          </div>
        </div>
      )}
    </div>
  );
}
