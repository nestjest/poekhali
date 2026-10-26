// Team «Конец смены»: the crew assembles one program from parts (input → calculation → report).
// In a lesson every member writes their own part and sees the others live; chat + the «Гонка экипажей» board.
// Solo (no lesson, or no crew): the player writes every part. Checking — the same judge (packages/judge).
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, type AvatarId } from '../art/Avatar';
import { Character } from '../art/Character';
import { CodeEditor } from '../components/CodeEditor';
import { RichText } from '../components/RichText';
import { charName } from '../content';
import { crewReady, crewSources, myParts, ownerOf, partWritten, placeLabel, pointsWord, QUICK_PHRASES, type CrewView, type RaceRow } from '../lib/crew';
import { starsText } from '../lib/economy';
import { ApiError, crewChat, crewCheck, crewPart, crewQuiz, crewResult } from '../lesson/api';
import { useLesson } from '../lesson/lessonStore';
import { py, type PyStatus } from '../py/runner';
import { useGame } from '../store';
import type { CrewMission as Mission, CrewResult, RunCodeResult } from '../types';
import { CREW_QUIZ_COINS, CREW_QUIZ_POINTS, quizOf } from '../lib/museum';
import { exhibitById } from '../content';
import { CrewQuiz, type CrewQuizAnswerView } from './MuseumQuiz';
import { useToasts } from './Toasts';

type Pane = 'mine' | 'all' | 'chat' | 'race';

export function CrewMission({ mission, onDone }: { mission: Mission; onDone: () => void }) {
  const g = useGame();
  const toast = useToasts((t) => t.push);
  const reduce = useReducedMotion();
  const inLesson = useLesson((s) => s.mode === 'lesson' && !!s.token && !!s.session && !s.session.ended);
  const lessonCrew = useLesson((s) => s.crew);
  const race = useLesson((s) => s.race);
  const me = useLesson((s) => s.me?.id ?? null);
  const [solo, setSolo] = useState(false);
  const crew: CrewView | null = inLesson && !solo && lessonCrew?.mission === mission.id ? lessonCrew : null;
  const saved = g.crews[mission.id];

  if (inLesson && !solo && !crew) return <WaitCrew onSolo={() => setSolo(true)} />;

  return <CrewDesk key={crew ? `crew-${crew.id}` : 'solo'} mission={mission} crew={crew} me={me} race={crew ? race : []}
    savedSolo={saved?.parts ?? {}} soloStars={saved?.stars ?? 0} onDone={onDone} toast={toast} reduce={!!reduce} />;
}

function WaitCrew({ onSolo }: { onSolo: () => void }) {
  return (
    <div className="world-panel crew-wait" role="status">
      <div className="wait-row">
        <span className="wait-art"><Character id="vika" mood="thinking" size={96} /></span>
        <div className="stack-sm">
          <strong>Ждём экипаж</strong>
          <p>ЦУП распределяет экипажи: преподаватель разобьёт класс на пульте, и твой экипаж появится здесь сам.</p>
        </div>
      </div>
      <div className="row"><button className="btn" onClick={onSolo}>Собрать программу одному</button></div>
    </div>
  );
}

function CrewDesk({ mission, crew, me, race, savedSolo, soloStars, onDone, toast, reduce }: {
  mission: Mission; crew: CrewView | null; me: number | null; race: RaceRow[]; savedSolo: Record<string, string>; soloStars: number;
  onDone: () => void; toast: (title: string, text?: string) => void; reduce: boolean;
}) {
  const g = useGame();
  const mine = myParts(mission, crew, me);
  const [active, setActive] = useState(mine[0] ?? mission.parts[0].id);
  const [pane, setPane] = useState<Pane>('mine');
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(mine.map((pid) => [pid, crew?.parts[pid]?.source ?? savedSolo[pid]]).filter(([, v]) => v !== undefined)) as Record<string, string>);
  const serverSaved = useMemo(() => Object.fromEntries(Object.entries(crew?.parts ?? {}).map(([k, v]) => [k, v.source])), [crew?.parts]);
  const sources = crewSources(mission, crew ? serverSaved : savedSolo, drafts);
  const joined = mission.parts.map((p) => sources[p.id].replace(/\n+$/, '')).filter((x) => x.trim()).join('\n') + '\n';
  const [status, setStatus] = useState<PyStatus>(py().status);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<RunCodeResult | null>(null);
  const [result, setResult] = useState<CrewResult | null>(null);
  const [hints, setHints] = useState(0);
  const [vika, setVika] = useState<string | null>(null);
  const [stdin, setStdin] = useState((mission.cases.find((c) => !c.hidden)?.stdin ?? []).join('\n'));
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const quiz = mission.quiz ?? [];
  const soloQuiz = g.crews[mission.id]?.quiz ?? {};
  const rightAnswer = (exhibit: string, choice: number) => {
    const ref = quiz.find((x) => x.exhibit === exhibit);
    return !!ref && quizOf(exhibitById(exhibit), ref.question)?.answer === choice;
  };
  const quizAnswers: Record<string, CrewQuizAnswerView> = crew
    ? Object.fromEntries(Object.entries(crew.quiz ?? {}).map(([k, a]) => [k, { answer: a.answer, correct: a.correct, nick: a.nick }]))
    : Object.fromEntries(Object.entries(soloQuiz).map(([k, choice]) => [k, { answer: choice, correct: rightAnswer(k, choice) }]));
  const quizDone = quiz.filter((x) => quizAnswers[x.exhibit]).length;
  const myNick = crew?.members.find((m) => m.id === me)?.nick ?? null;
  const answerQuiz = async (exhibit: string, answer: number) => {
    if (quizAnswers[exhibit]) return;
    if (!crew) {
      g.patchCrew(mission.id, { quiz: { ...soloQuiz, [exhibit]: answer } });
      if (rightAnswer(exhibit, answer)) g.addCoins(CREW_QUIZ_COINS);
      return;
    }
    setQuizBusy(true);
    try { await crewQuiz(exhibit, answer); }
    catch (e) { setVika(e instanceof ApiError ? e.message : 'Ответ не отправился. Попробуй ещё раз.'); }
    finally { setQuizBusy(false); }
  };
  useEffect(() => py().onStatus(setStatus), []);
  const ready = status === 'ready';
  const stars = crew ? crew.stars : soloStars;
  const done = crewReady(stars);
  const myRank = crew ? race.find((r) => r.id === crew.id) : undefined;

  // Own part → the server (debounced): the crew sees it while it is being typed.
  const pending = useRef<Record<string, string>>({});
  const timer = useRef<number | undefined>(undefined);
  const flush = async () => {
    window.clearTimeout(timer.current);
    const batch = pending.current;
    pending.current = {};
    for (const [pid, src] of Object.entries(batch)) await crewPart(pid, src).catch(() => undefined);
  };
  useEffect(() => () => { void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const edit = (pid: string, src: string) => {
    setDrafts((d) => ({ ...d, [pid]: src }));
    if (crew) {
      pending.current[pid] = src;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { void flush(); }, 1200);
    } else {
      g.patchCrew(mission.id, { parts: { ...useGame.getState().crews[mission.id]?.parts, [pid]: src } });
    }
  };

  // The crew became ready (maybe a teammate ran the check): say it once.
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) toast('Экипаж готов к старту!', `${mission.title}: ${starsText(stars)}`);
    wasDone.current = done;
  }, [done, stars, mission.title, toast]);

  const ranges = useMemo(() => {
    let line = 1;
    return mission.parts.map((p) => {
      const n = sources[p.id].replace(/\n+$/, '').trim() ? sources[p.id].replace(/\n+$/, '').split('\n').length : 0;
      const r = { id: p.id, first: line, last: line + n - 1 };
      line += n;
      return r;
    });
  }, [mission.parts, sources]);
  const partOfLine = (line: number | null) => (line ? ranges.find((r) => r.first <= line && line <= r.last)?.id : undefined);
  const who = (pid: string | undefined) => {
    if (!pid) return '';
    const part = mission.parts.find((p) => p.id === pid);
    const owner = ownerOf(crew, pid);
    return `${part?.role ?? pid}${owner ? ` (${owner.id === me ? 'это ты' : owner.nick})` : ''}`;
  };

  const doRun = async () => {
    setBusy(true);
    try {
      const lines = stdin.split('\n');
      while (lines.length && lines[lines.length - 1] === '') lines.pop();
      const r = await py().runCode(joined, lines);
      setRun(r);
      if (r.error) {
        g.noteErrors([r.error.explain.tag]);
        const pid = partOfLine(r.error.line);
        setVika(`${r.error.explain.title} ${pid ? `Ошибка в части «${who(pid)}». ` : ''}${r.error.explain.check}`);
      }
    } finally { setBusy(false); }
  };

  const doCheck = async () => {
    setBusy(true);
    try {
      let r: CrewResult | null = null;
      if (crew) {
        await flush();
        try { r = await crewCheck(hints); } catch (e) { if (e instanceof ApiError && e.status === 403) { setVika(e.message); return; } r = null; }
        if (!r) {
          r = await py().runCrew(mission, sources, hints);
          await crewResult({ stars: r.summary.stars, score: r.summary.score, passed: r.summary.passed, total: r.summary.total }).catch(() => undefined);
        }
      } else {
        r = await py().runCrew(mission, sources, hints);
        g.patchCrew(mission.id, { stars: Math.max(soloStars, r.summary.stars) });
      }
      setResult(r);
      setPane('all');
      g.noteErrors([...(r.error ? [r.error.explain.tag] : []), ...r.bugs.map((b) => b.tag)]);
      const failed = r.cases.find((c) => !c.passed);
      if (r.error || failed?.error) {
        const err = r.error ?? failed?.error;
        setVika(`${err?.explain.title ?? ''} ${r.error_part ? `Ищите в части «${who(r.error_part)}». ` : ''}${err?.explain.check ?? ''}`);
      } else if (failed) setVika(failed.reply ?? 'Одно из испытаний не прошло. Сравните вывод с ТЗ.');
      else setVika(null);
    } finally { setBusy(false); }
  };

  const takeHint = () => {
    const n = Math.min(3, hints + 1);
    setHints(n);
    setVika(mission.hints[n - 1] ?? null);
  };

  const part = mission.parts.find((p) => p.id === active) ?? mission.parts[0];
  const tabs: { id: Pane; label: string }[] = [
    { id: 'mine', label: mine.length > 1 ? 'Мои части' : 'Моя часть' }, { id: 'all', label: 'Вся программа' },
    ...(crew ? [{ id: 'chat' as Pane, label: `Чат${crew.chat.length ? ` · ${crew.chat.length}` : ''}` }, { id: 'race' as Pane, label: 'Табло' }] : []),
  ];

  return (
    <motion.section className="crew-room" aria-label={`Командная программа: ${mission.title}`}
      initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 26 }}>
      <header className="crew-head">
        <div className="crew-title">
          <span className="crew-kicker">{crew ? `Экипаж «${crew.name}»` : 'Экипаж: ты, Вика и Макс на подхвате'} · командная программа</span>
          <h2>{mission.title}</h2>
        </div>
        {crew ? (
          <ul className="crew-members" aria-label="Состав экипажа">
            {crew.members.map((m) => {
              const written = m.parts.every((pid) => partWritten(mission, pid, sources[pid]));
              return (
                <li key={m.id} className={`crew-member${m.id === me ? ' me' : ''}`}>
                  <Avatar id={(m.avatar as AvatarId) ?? 'a1'} size={32} />
                  <span className="crew-member-text"><strong>{m.id === me ? `${m.nick} (ты)` : m.nick}</strong>
                    <span className="small">{m.parts.map((pid) => mission.parts.find((p) => p.id === pid)?.role).join(', ') || 'испытатель'}</span></span>
                  <span className={`crew-mark${written ? ' ok' : ''}`} aria-label={written ? 'часть написана' : 'часть ещё пишется'}>{written ? '✓' : '…'}</span>
                  {!m.online && <span className="sr-only">не в сети</span>}
                </li>
              );
            })}
          </ul>
        ) : null}
        {myRank && <span className="chip crew-rank">🏁 {placeLabel(myRank.rank)} · {myRank.points} {pointsWord(myRank.points)}</span>}
      </header>

      {quizOpen ? (
        <section className="crew-quiz-pane" aria-label="Музейный опрос экипажа">
          <h3>Музейный опрос</h3>
          <CrewQuiz quiz={quiz} answers={quizAnswers} me={myNick} busy={quizBusy} onAnswer={(x, i) => { void answerQuiz(x, i); }}
            points={crew ? `Каждый верный ответ — +${CREW_QUIZ_POINTS} ${pointsWord(CREW_QUIZ_POINTS)} в «Гонке экипажей».` : `Каждый верный ответ — +${CREW_QUIZ_COINS} премии.`} />
        </section>
      ) : (<>
      <div className="crew-tabs" role="tablist" aria-label="Разделы">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={pane === t.id} className="crew-tab" onClick={() => setPane(t.id)}>{t.label}</button>)}
      </div>

      <div className={`crew-grid${crew ? '' : ' solo'}`}>
        <section className="crew-pane crew-mine" data-active={pane === 'mine'} aria-label="Моя часть программы">
          <p className="crew-brief">{mission.brief.join(' ')} <span className="muted">Заказчик — {charName(mission.client_id)}.</span></p>
          {mine.length > 1 && (
            <div className="crew-parts-tabs" role="group" aria-label="Мои части">
              {mine.map((pid) => {
                const p = mission.parts.find((x) => x.id === pid)!;
                return <button key={pid} className="btn small" aria-pressed={active === pid} onClick={() => setActive(pid)}>{p.role}</button>;
              })}
            </div>
          )}
          {mine.includes(part.id) ? (
            <>
              <div className="crew-role">{mine.length === 1 && <span className="chip">{part.role}</span>}<strong>{part.title}</strong></div>
              <div className="crew-task"><RichText text={part.task} /></div>
              {(!!part.uses?.length || !!part.gives?.length) && (
                <dl className="crew-io">
                  {!!part.uses?.length && <><dt>Получаешь</dt><dd>{part.uses.join('; ')}</dd></>}
                  {!!part.gives?.length && <><dt>Передаёшь дальше</dt><dd>{part.gives.join('; ')}</dd></>}
                </dl>
              )}
              <CodeEditor key={part.id} value={sources[part.id]} onChange={(v) => edit(part.id, v)} label={`Код части «${part.role}»`}
                onRun={doRun} onCheck={doCheck} />
              {crew && <p className="small muted">Экипаж видит твою часть сразу. Имена переменных согласуйте в чате.</p>}
            </>
          ) : <p className="muted">В этом экипаже у тебя нет своей части: ты испытатель. Запускай программу и помогай в чате.</p>}
        </section>

        <section className="crew-pane crew-all" data-active={pane === 'all'} aria-label="Программа экипажа целиком">
          {result && <Results result={result} who={who} />}
          <ol className="crew-program">
            {mission.parts.map((p) => {
              const r = ranges.find((x) => x.id === p.id)!;
              const owner = ownerOf(crew, p.id);
              const lines = sources[p.id].replace(/\n+$/, '').split('\n');
              const bad = result?.error_part === p.id;
              return (
                <li key={p.id} className={`crew-block${bad ? ' bad' : ''}`}>
                  <div className="crew-block-head">
                    <strong>{p.role}</strong>
                    <span className="small">{owner ? (owner.id === me ? 'ты' : owner.nick) : crew ? 'никто' : 'ты'}</span>
                    <span className={`crew-mark${partWritten(mission, p.id, sources[p.id]) ? ' ok' : ''}`} aria-hidden="true">
                      {partWritten(mission, p.id, sources[p.id]) ? '✓' : '…'}</span>
                    {bad && <span className="crew-flag">здесь ошибка</span>}
                  </div>
                  <pre className="crew-code" aria-label={`Код части «${p.role}»`}>{lines.map((ln, i) => (
                    <span key={i} className="crew-line"><span className="crew-ln" aria-hidden="true">{r.first + i}</span>{ln || ' '}</span>
                  ))}</pre>
                </li>
              );
            })}
          </ol>
          <label className="stack-sm"><span className="small">Что введёт оператор (по строке на каждый <code>input()</code>)</span>
            <textarea className="stdin" rows={2} value={stdin} onChange={(e) => setStdin(e.target.value)} /></label>
          <pre className="terminal" aria-live="polite">{run ? (run.stdout || '(программа ничего не напечатала)') : '$ нажми ▶, чтобы запустить программу экипажа'}
            {run?.error && `\n✖ ${run.error.type}: ${run.error.message}`}</pre>
        </section>

        {crew && (
          <section className="crew-pane crew-side" data-active={pane === 'chat' || pane === 'race'} data-pane={pane} aria-label="Чат и табло">
            <CrewChat crew={crew} me={me} />
            <div className="crew-race-box">
              <h3>Гонка экипажей</h3>
              <RaceBoard rows={race} mine={crew.id} />
            </div>
          </section>
        )}
      </div>
      </>)}

      <AnimatePresence>
        {vika && (
          <motion.div className="crew-vika" role="status" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <strong>Вика</strong><span className="crew-vika-text"><RichText text={vika} /></span>
            <button className="btn ghost small" onClick={() => setVika(null)}>Понятно</button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="crew-bar" role="toolbar" aria-label="Действия экипажа">
        <button className="btn ghost small" onClick={takeHint} disabled={hints >= 3 || quizOpen}>Подсказка {hints}/3</button>
        {quiz.length > 0 && (
          <button className="btn small" onClick={() => setQuizOpen((v) => !v)} aria-pressed={quizOpen}>
            {quizOpen ? '← К программе' : <><span aria-hidden="true">🏛</span> Музейный опрос {quizDone}/{quiz.length}</>}
          </button>
        )}
        <button className="btn small" onClick={doRun} disabled={busy || !ready} title="Ctrl+Enter">▶ Запустить</button>
        <span className="spacer" />
        {!ready && <span className="small muted" role="status">{status === 'restarting' ? 'Перезапуск среды…' : 'Загрузка Python…'}</span>}
        {stars > 0 && <span className="chip" aria-label={`Лучшая оценка экипажа ${stars} из 5`}><span className="stars">{starsText(stars)}</span></span>}
        <button className={`btn ${done ? '' : 'primary'}`} onClick={doCheck} disabled={busy || !ready} title="Ctrl+Shift+Enter">
          🧪 Испытать программу экипажа</button>
        {done && <button className="btn primary" onClick={() => { void flush(); onDone(); }} autoFocus>На старт →</button>}
      </footer>
    </motion.section>
  );
}

function Results({ result, who }: { result: CrewResult; who: (pid: string | undefined) => string }) {
  let hidden = 0;
  const s = result.summary;
  return (
    <div className={`alert ${s.stars >= 3 ? 'ok' : 'bad'} crew-results`} aria-live="polite">
      <strong>{s.stars >= 3 ? `Испытания пройдены: ${s.passed} из ${s.total}` : `Пройдено ${s.passed} из ${s.total}`} · <span className="stars">{starsText(s.stars)}</span></strong>
      {result.error && <span>✖ Программа не собралась: {result.error.explain.title}{result.error_part ? ` Часть «${who(result.error_part)}».` : ''}</span>}
      <ul className="crew-cases">
        {result.cases.map((c) => (
          <li key={c.id}><span aria-hidden="true">{c.passed ? '✔' : '✖'}</span> {c.hidden ? `скрытая проверка ${++hidden}` : `тест ${c.id}`}
            <span className="sr-only">{c.passed ? ' — пройден' : ' — не пройден'}</span>
            {c.reply && <span className="small"> — «{c.reply}»</span>}</li>
        ))}
      </ul>
    </div>
  );
}

function CrewChat({ crew, me }: { crew: CrewView; me: number | null }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [crew.chat.length]);
  const send = async (t: string) => {
    if (!t.trim()) return;
    try { await crewChat(t.trim()); setText(''); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Не отправилось. Попробуй ещё раз.'); }
  };
  return (
    <div className="crew-chat">
      <h3>Чат экипажа</h3>
      <ol className="crew-msgs" ref={list} aria-live="polite">
        {!crew.chat.length && <li className="muted small">Пока тихо. Начните с имён переменных: кто что создаёт?</li>}
        {crew.chat.map((m) => (
          <li key={m.id} className={`crew-msg${m.by === me ? ' me' : ''}`}><strong>{m.by === me ? 'Ты' : m.nick}</strong> {m.text}</li>
        ))}
      </ol>
      <div className="crew-quick" role="group" aria-label="Быстрые фразы">
        {QUICK_PHRASES.map((q) => <button key={q} className="btn ghost small" onClick={() => send(q)}>{q}</button>)}
      </div>
      <form className="crew-send" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <input className="pass-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="Сообщение экипажу" aria-label="Сообщение экипажу" />
        <button className="btn" disabled={!text.trim()}>Отправить</button>
      </form>
      {error && <p className="join-error" role="alert">{error}</p>}
    </div>
  );
}

/** «Гонка экипажей»: only crews are ranked, never individual students. Not colour alone: place, points and a rocket. */
export function RaceBoard({ rows, mine }: { rows: RaceRow[]; mine?: number | null }) {
  if (!rows.length) return <p className="small muted">Экипажи ещё не распределены.</p>;
  const max = Math.max(1, ...rows.map((r) => r.points));
  return (
    <ol className="race">
      {rows.map((r) => (
        <li key={r.id} className={`race-row${r.id === mine ? ' mine' : ''}${r.rank === 1 ? ' first' : ''}`}>
          <span className="race-place" aria-label={placeLabel(r.rank)}>{r.rank}</span>
          <span className="race-name"><strong>«{r.name}»</strong>{r.id === mine && <span className="small"> — твой экипаж</span>}
            <span className="small race-parts">★ {r.parts.missions} · программа {r.parts.team}{r.parts.quiz ? ` · музей +${r.parts.quiz}` : ''}{r.parts.start ? ` · старт +${r.parts.start}` : ''}</span></span>
          <span className="race-track" aria-hidden="true"><span className="race-fill" style={{ transform: `scaleX(${r.points / max})` }} /></span>
          <span className="race-points">{r.start_place ? <span aria-label="запущен">🚀 </span> : null}{r.points}</span>
        </li>
      ))}
    </ol>
  );
}
