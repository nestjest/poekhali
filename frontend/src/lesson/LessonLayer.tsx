// The lesson layer inside the game: live sync with the teacher, «Внимание!», waiting for a stage, help bell, join.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Avatar, AVATAR_IDS, type AvatarId } from '../art/Avatar';
import { Character } from '../art/Character';
import { lessonOrders, orderByFile, orderFileId } from '../content';
import { DIAG_A, DIAG_B } from '../lib/diagnostics';
import { attentionOn, type PublicPoll } from '../lib/gate';
import { stageKey } from '../lib/progress';
import { useGame } from '../store';
import type { Lesson, Stage } from '../types';
import { useToasts } from '../game/Toasts';
import { answerPoll, ApiError, connectLesson, joinLesson, sendProgress, setHelp } from './api';
import { activeSession, useLesson } from './lessonStore';

type G = ReturnType<typeof useGame.getState>;

/** What the teacher's class panel needs to know about this student. */
export function buildProgress(g: G, lesson: Lesson, next: Stage | undefined, waiting: boolean) {
  const where = g.where.kind;
  const orders: Record<string, { stars: number; attempts: number; hints: number; revision: boolean }> = {};
  for (const o of lessonOrders(lesson)) {
    const id = orderFileId(o);
    const p = g.orders[id];
    if (p) orders[id] = { stars: p.bestStars, attempts: p.attempts ?? p.submissions.length, hints: p.hints, revision: p.needsRevision };
  }
  const dl = Object.values(g.dialogues);
  return {
    stage: g.where.kind === 'story' ? g.where.stage : next?.id ?? null,
    where,
    order: g.where.kind === 'order' ? g.where.id : null,
    waiting,
    done_stages: lesson.stages.filter((s) => g.stagesDone.includes(stageKey(lesson, s.id))).map((s) => s.id),
    orders,
    checks: { correct: dl.reduce((n, d) => n + d.correct, 0), total: dl.reduce((n, d) => n + d.total, 0) },
    errors: Object.fromEntries(Object.entries(g.errors ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 20)),
    // Entry / final tests for the lesson report (gain B − A).
    diag: Object.fromEntries(([['a', DIAG_A], ['b', DIAG_B]] as const).flatMap(([k, id]) => {
      const d = g.dialogues[id];
      return d?.done ? [[k, d.correct], [`${k}_total`, d.total]] : [];
    })),
  };
}

/** Connects to the lesson, turns teacher actions into in-game notifications, reports progress. */
export function useLessonSync(lesson: Lesson, next: Stage | undefined, waiting: boolean) {
  const mode = useLesson((s) => s.mode);
  const token = useLesson((s) => s.token);
  const session = useLesson((s) => s.session);
  const comments = useLesson((s) => s.me?.grants.comments);
  const crewKey = useLesson((s) => (s.crew ? `${s.crew.id}:${s.crew.name}` : null));
  const toast = useToasts((t) => t.push);
  const seenCrew = useRef<string | null>(null);

  // The teacher split the class into crews (or moved the student): tell once, open the «Экипаж» app.
  useEffect(() => {
    if (!crewKey || seenCrew.current === crewKey) return;
    const first = seenCrew.current === null;
    seenCrew.current = crewKey;
    const crew = useLesson.getState().crew;
    if (!crew) return;
    const g = useGame.getState();
    if (!g.features.includes('crew')) g.unlock(['crew']);
    const mates = crew.members.filter((m) => m.id !== useLesson.getState().me?.id).map((m) => m.nick);
    if (!first || !g.features.includes('crew')) toast(`Ты в экипаже «${crew.name}»`, mates.length ? `С тобой: ${mates.join(', ')}. Табло гонки — в телефоне.` : 'Табло гонки — в телефоне.');
  }, [crewKey, toast]);
  const prev = useRef(session);
  const seenComments = useRef<Set<number> | null>(null);

  // Teacher's personal comments → notification + a letter in the pneumatic mail (each comment once).
  useEffect(() => {
    if (!comments) return;
    if (seenComments.current === null) {
      // First view after (re)connecting: letters are deduplicated by id, only brand-new ones get a toast.
      const known = new Set(useGame.getState().letters.map((l) => l.id));
      seenComments.current = new Set(comments.filter((c) => known.has(`comment-${c.id}`)).map((c) => c.id));
    }
    for (const c of comments) {
      if (seenComments.current.has(c.id)) continue;
      seenComments.current.add(c.id);
      const about = c.order ? orderByFile(c.order)?.title : undefined;
      toast('Преподаватель посмотрел твой код', c.text);
      useGame.getState().mail({ id: `comment-${c.id}`, from: 'Преподаватель', title: about ? `Комментарий: «${about}»` : 'Комментарий к коду', body: c.text });
    }
  }, [comments, toast]);

  useEffect(() => {
    if (mode !== 'lesson' || !token) return;
    return connectLesson((reason) => {
      useLesson.getState().leave();
      toast('Урок закрыт', `${reason} Продолжаем самостоятельно — прогресс сохранён.`);
    });
  }, [mode, token, toast]);

  // Teacher actions → diegetic notifications.
  useEffect(() => {
    const was = prev.current;
    prev.current = session;
    if (!session || !was || was.id !== session.id) return;
    const opened = session.open_stages.filter((id) => !was.open_stages.includes(id));
    for (const id of opened) {
      const st = lesson.stages.find((s) => s.id === id);
      if (st) toast('ЦУП: этап открыт', `«${st.title}» — можно продолжать.`);
    }
    if (session.mode !== was.mode) toast(session.mode === 'free' ? 'Свободный режим' : 'Идём вместе с классом',
      session.mode === 'free' ? 'Преподаватель разрешил идти в своём темпе.' : 'Следующие этапы откроет преподаватель.');
    if (session.message && session.message.at !== was.message?.at) {
      toast('Сообщение преподавателя', session.message.text);
      useGame.getState().mail({ id: `teacher-${session.message.at}`, from: 'Преподаватель', title: 'Сообщение классу', body: session.message.text });
    }
    if (session.ended && !was.ended) {
      toast('Урок завершён', 'Можно продолжать самостоятельно — прогресс сохранён.');
      useLesson.getState().leave();
    }
  }, [session, lesson, toast]);

  // Progress → teacher, debounced; also on a timer so «застрял» and online stay fresh.
  useEffect(() => {
    if (mode !== 'lesson' || !token) return;
    let timer: number | undefined;
    const push = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void sendProgress(buildProgress(useGame.getState(), lesson, next, waiting)).catch(() => undefined);
      }, 1500);
    };
    push();
    const unsub = useGame.subscribe(push);
    return () => { unsub(); window.clearTimeout(timer); };
  }, [mode, token, lesson, next, waiting]);
}

/** «Внимание!»: dims every screen and blocks input until the teacher lifts it. */
export function AttentionOverlay() {
  const session = useLesson((s) => activeSession(s));
  const on = attentionOn(session);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!on) return;
    const block = (e: KeyboardEvent) => { e.stopPropagation(); e.preventDefault(); };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [on]);
  return (
    <AnimatePresence>
      {on && session && (
        <motion.div className="attention" role="alertdialog" aria-modal="true" aria-labelledby="attention-title"
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}>
          <motion.div className="attention-card" initial={reduce ? false : { scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}>
            <span className="attention-icon" aria-hidden="true">!</span>
            <h2 id="attention-title">Внимание!</h2>
            <p className="attention-text" aria-live="assertive">{session.attention.text}</p>
            <p className="small muted">Экран вернётся, когда преподаватель снимет «Внимание».</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** In-world «Ждём команду ЦУП» while the teacher hasn't opened the next stage. */
export function WaitPanel({ stage, onClose }: { stage: Stage; onClose: () => void }) {
  return (
    // Appears after the screen transition (0.35 s), so it never sits on top of the leaving title screen.
    <motion.div className="world-dim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.2 }}>
      <div onClick={(e) => e.stopPropagation()}>
        <motion.section className="world-panel wait-panel" aria-label="Ожидание этапа" role="dialog" aria-modal="true"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
          <div className="wait-row">
            <div className="wait-art" aria-hidden="true"><Character id="vika" mood="thinking" size={120} /></div>
            <div className="stack-sm">
              <p className="pass-head">ЖДЁМ КОМАНДУ ЦУП</p>
              <h2>Следующий этап: «{stage.title}»</h2>
              <p>Его откроет преподаватель, когда класс будет готов. А пока можно заглянуть в Тетрадь или Музей бюро.</p>
            </div>
          </div>
          <div className="row"><button className="btn primary" onClick={onClose} autoFocus>Понятно, жду</button></div>
        </motion.section>
      </div>
    </motion.div>
  );
}

/** Corner bell «Позвать преподавателя» (lesson mode only). */
export function HelpBell() {
  const me = useLesson((s) => s.me);
  const mode = useLesson((s) => s.mode);
  const link = useLesson((s) => s.link);
  const toast = useToasts((t) => t.push);
  const [busy, setBusy] = useState(false);
  if (mode !== 'lesson' || !me) return null;
  const on = me.help;
  const toggle = async () => {
    setBusy(true);
    try {
      await setHelp(!on);
      toast(on ? 'Вызов отменён' : 'Преподаватель увидит вызов', on ? 'Хорошо, продолжаем.' : 'Можно продолжать работу, пока он подходит.');
    } catch (e) {
      toast('Не получилось', e instanceof ApiError ? e.message : 'Попробуйте ещё раз.');
    } finally { setBusy(false); }
  };
  return (
    <button className={`help-btn${on ? ' on' : ''}`} onClick={toggle} disabled={busy} aria-pressed={on}
      aria-label={on ? 'Отменить вызов преподавателя' : 'Позвать преподавателя'}
      title={link === 'offline' ? 'Нет связи с сервером урока' : undefined}>
      <span aria-hidden="true">🔔</span>
      <span className="help-label">{on ? 'Зову…' : 'Позвать'}</span>
      {link === 'offline' && <span className="help-off" aria-hidden="true">✕</span>}
    </button>
  );
}

/** Join by lesson code on the title screen. */
export function JoinLesson({ onJoined, onCancel }: { onJoined: () => void; onCancel: () => void }) {
  const profile = useGame((s) => s.profile);
  const [code, setCode] = useState('');
  const [nick, setNick] = useState(profile?.nick ?? '');
  const [avatar, setAvatar] = useState<AvatarId>(profile?.avatar ?? 'a1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !nick.trim()) { setError('Нужны код урока и псевдоним.'); return; }
    setBusy(true); setError(null);
    try {
      await joinLesson(code, nick.trim(), avatar);
      useGame.getState().setProfile({ nick: nick.trim(), avatar });
      onJoined();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не получилось войти. Попробуйте ещё раз.');
    } finally { setBusy(false); }
  };
  return (
    <form className="pass" onSubmit={submit} aria-label="Вход в урок">
      <p className="pass-head">ПРОПУСК НА УРОК</p>
      <label className="stack-sm">
        <span>Код урока — на доске или экране преподавателя</span>
        <input className="pass-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Например, КЕДР-42"
          autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus aria-invalid={!!error} />
      </label>
      <label className="stack-sm">
        <span>Псевдоним (не ФИО): так вас увидит преподаватель</span>
        <input className="pass-input" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={24} autoComplete="nickname" />
      </label>
      <div className="stack-sm">
        <span id="join-avatar">Фото на пропуск</span>
        <div className="row" role="radiogroup" aria-labelledby="join-avatar">
          {AVATAR_IDS.map((a) => (
            <button type="button" key={a} className="btn ghost avatar-pick" role="radio" aria-checked={avatar === a}
              aria-label={`Фото ${a.slice(1)}`} onClick={() => setAvatar(a)}><Avatar id={a} size={52} /></button>
          ))}
        </div>
      </div>
      {error && <p className="join-error" role="alert"><span aria-hidden="true">✕ </span>{error}</p>}
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Входим…' : 'Войти в урок'}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

/** Small status line on the title / pause: which lesson we are in. */
export function LessonBadge() {
  const session = useLesson((s) => activeSession(s));
  const link = useLesson((s) => s.link);
  if (!session) return null;
  const linkText = link === 'online' ? 'на связи' : link === 'connecting' ? 'подключаемся…' : 'нет связи, пробуем снова';
  return (
    <p className="lesson-badge" role="status">
      <span aria-hidden="true">{link === 'online' ? '●' : '○'}</span> Урок {session.code}{session.group ? ` · ${session.group}` : ''} — {linkText}
    </p>
  );
}

/** Class poll from the projector: one tap answers, the answer can be changed until the teacher closes it. */
export function PollCard() {
  const session = useLesson((s) => activeSession(s));
  const answer = useLesson((s) => s.me?.poll_answer ?? null);
  const toast = useToasts((t) => t.push);
  const reduce = useReducedMotion();
  const [hidden, setHidden] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const poll = session && !session.ended ? session.poll ?? null : null;
  const show = !!poll && hidden !== poll.id && (poll.open || answer !== null);
  const choose = async (p: PublicPoll, i: number) => {
    setBusy(true);
    try { await answerPoll(p.id, i); }
    catch (e) { toast('Ответ не принят', e instanceof ApiError ? e.message : 'Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  };
  return (
    <AnimatePresence>
      {show && poll && (
        // A question to the whole class: centred over the dimmed scene (it never covers the dialogue box).
        <motion.div key={poll.id} className="poll-dim" onClick={() => setHidden(poll.id)}
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}>
        <motion.section className="poll-card" role="dialog" aria-modal="true" aria-labelledby="poll-q" onClick={(e) => e.stopPropagation()}
          initial={reduce ? false : { y: 24 }} animate={{ y: 0 }} exit={reduce ? undefined : { y: 24 }}>
          <p className="pass-head">{poll.open ? 'ВОПРОС КЛАССУ' : 'ИТОГ ОПРОСА'}</p>
          <h2 id="poll-q">{poll.question}</h2>
          <div className="poll-options" role="radiogroup" aria-labelledby="poll-q">
            {poll.options.map((o, i) => {
              const share = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
              return (
                <button key={o} className="poll-option" role="radio" aria-checked={answer === i} disabled={busy || !poll.open}
                  onClick={() => void choose(poll, i)}>
                  <span className="poll-key" aria-hidden="true">{answer === i ? '✓' : String.fromCharCode(1040 + i)}</span>
                  <span className="poll-text">{o}</span>
                  {!poll.open && <span className="poll-share">{share}%</span>}
                </button>
              );
            })}
          </div>
          <div className="row">
            <span className="small muted" role="status">{poll.open ? (answer === null ? 'Ответы анонимны: преподаватель видит только итог.' : 'Ответ принят. Можно передумать, пока опрос открыт.') : `Ответили: ${poll.total}`}</span>
            <span className="spacer" />
            <button className="btn ghost small" onClick={() => setHidden(poll.id)}>Скрыть</button>
          </div>
        </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
