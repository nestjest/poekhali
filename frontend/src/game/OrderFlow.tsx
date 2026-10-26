import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Character, type CharacterId, type Mood } from '../art/Character';
import { MONITOR_RECT, NOTES_RECT } from '../art/Locations';
import { CodeEditor } from '../components/CodeEditor';
import { Parsons } from '../components/Parsons';
import { RichText } from '../components/RichText';
import { TraceView } from '../components/TraceView';
import { CheckView } from '../dialogue/checks/CheckView';
import { LESSONS, REPORT_PHRASES, charName, lessonOrders, orderFileId } from '../content';
import { starsText, tipsDue } from '../lib/economy';
import { MUSEUM_BONUS, museumQuestionDue } from '../lib/museum';
import { moodForStars, orderStatus, reviewText } from '../lib/progress';
import { ApiError, sendCode, serverCheck } from '../lesson/api';
import { useLesson } from '../lesson/lessonStore';
import { py, type PyStatus } from '../py/runner';
import { reputation, useGame, versionLabel, type OrderProgress } from '../store';
import { codeText, type CastMember, type Order, type OrderResult, type RunCodeResult } from '../types';
import { DialogueBox } from './DialogueBox';
import { mapRect, Stage, useBox } from './Stage';
import { MuseumQuestion } from './MuseumQuiz';
import { InWorldPanel } from './StoryPlayer';
import { useToasts } from './Toasts';

type Scaffold = 1 | 2 | 3;
const SCAFFOLD_RU = { 1: 'Собрать из строк', 2: 'Заполнить пропуски', 3: 'Написать сам' } as const;

export function OrderFlow({ fileId, order, onExit }: { fileId: string; order: Order; onExit: (next?: string) => void }) {
  const g = useGame();
  const p = g.order(fileId);
  const patch = (x: Partial<OrderProgress>) => g.patchOrder(fileId, x);
  const [result, setResult] = useState<OrderResult | null>(null);
  // Check results live in memory: after reload continue at the desk.
  useEffect(() => { if (p.stage >= 3) patch({ stage: 2 }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (p.stage === 1) return <CounterIn order={order} onDone={(chosen) => patch({ clarify: chosen, stage: 2, scaffold: order.scaffold_level })} />;
  if (p.stage === 2 || !result) return <Desk order={order} fileId={fileId} p={p} patch={patch} onChecked={(r) => { setResult(r); patch({ stage: 3 }); }} />;
  if (p.stage === 3) return <BuildRun order={order} result={result} onNext={() => patch({ stage: 4 })} onBack={() => patch({ stage: 2 })} />;
  return <CounterOut order={order} fileId={fileId} p={p} result={result}
    onRevise={() => { setResult(null); patch({ stage: 2, version: p.version + 1 }); }} onExit={onExit} />;
}

// ------------------------------------------------------------- ① брифинг у окна заданий
function CounterIn({ order, onDone }: { order: Order; onDone: (chosen: number[]) => void }) {
  const g = useGame();
  const toast = useToasts((t) => t.push);
  const [line, setLine] = useState(0);
  const [asked, setAsked] = useState<number[]>([]);
  const [reply, setReply] = useState<{ text: string; mood: Mood } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const opts = order.clarify?.options ?? [];
  const client = order.client_id;
  const inPitch = line < order.pitch.length;
  const mood: Mood = reply?.mood ?? (line === 0 ? 'joy' : 'neutral');
  const cast: CastMember[] = [{ who: client, pos: 'center', mood: accepting ? 'joy' : mood }];

  const ask = (i: number) => {
    setAsked((a) => [...a, i]);
    setReply({ text: opts[i].reply, mood: opts[i].relevant ? 'joy' : 'puzzled' });
    const req = order.requirements.find((r) => r.id === opts[i].adds_requirement);
    if (req) toast('+ в ТЗ', req.text);
  };
  const scene = { location: 'counter', time: 'day' as const, transition: 'fade' as const, title: line === 0 && !reply ? `Задание ${order.lesson}.${order.order_no || '★'} · ${order.title}` : undefined };

  return (
    <Stage scene={scene} cast={cast} classic={g.settings.classic} shift={!inPitch && !accepting}>
      {inPitch ? (
        <DialogueBox key={`p${line}`} who={charName(client)} text={order.pitch[line]} onNext={() => setLine(line + 1)} />
      ) : accepting ? (
        <DialogueBox key="acc" who={charName(client)} text={order.lines?.accept ?? 'Договорились. Жду программу после испытаний.'}
          onNext={() => onDone(asked)} nextLabel="К рабочему месту" />
      ) : (
        <DialogueBox key={`q${asked.length}`} who={reply ? charName(client) : (g.profile?.nick ?? 'Я')} player={!reply}
          text={reply?.text ?? (order.clarify?.prompt ?? 'Что уточнить?')}
          choices={[
            ...opts.map((o, i) => ({ text: o.text, onPick: () => ask(i), disabled: asked.includes(i) })).filter((c) => !c.disabled),
            { text: asked.length ? 'Всё понятно, берусь!' : 'Мне всё понятно, берусь!', tone: 'primary' as const, onPick: () => setAccepting(true) },
          ]} />
      )}
    </Stage>
  );
}

/** Screen area of the drawn monitor, clamped to the viewport; `full` when too small (phones). */
function monitorRect(box: { w: number; h: number }) {
  const raw = mapRect(MONITOR_RECT, box);
  const monitor = raw && (() => {
    const top = Math.max(raw.top, 8);
    return { ...raw, top, height: Math.min(raw.height - (top - raw.top), box.h - top - 8) };
  })();
  return { monitor, full: !monitor || monitor.height < 420 || monitor.width < 680 };
}

// ------------------------------------------------------------- ② за столом
function Desk({ order, fileId, p, patch, onChecked }: {
  order: Order; fileId: string; p: OrderProgress; patch: (x: Partial<OrderProgress>) => void; onChecked: (r: OrderResult) => void;
}) {
  const g = useGame();
  const { ref, box } = useBox<HTMLDivElement>();
  const [status, setStatus] = useState<PyStatus>(py().status);
  const [run, setRun] = useState<RunCodeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'code' | 'screen' | 'tz'>('code');
  const [trace, setTrace] = useState(false);
  const [vika, setVika] = useState<string | null>(p.version > 0 ? 'Заказчик просит доработку. Посмотри замечания на стикере и поправь код.' : null);
  const [undo, setUndo] = useState<{ code: Record<string, string>; parsons: number[] } | null>(null);
  const [freeHint, setFreeHint] = useState(false);
  const [lastCheck, setLastCheck] = useState<OrderResult | null>(null);
  const [checkedBy, setCheckedBy] = useState<'server' | 'browser' | null>(null);
  const inLesson = useLesson((s) => s.mode === 'lesson' && !!s.token && !s.session?.ended);
  const visible = order.cases.filter((c) => !c.hidden);
  const [stdin, setStdin] = useState((visible[0]?.stdin ?? []).join('\n'));
  useEffect(() => py().onStatus(setStatus), []);

  const levels = ([1, 2, 3] as Scaffold[]).filter((l) =>
    l === 1 ? !!order.parsons_lines?.length : l === 2 ? !!order.fill_code : order.starter_code !== undefined);
  const scaffold: Scaffold = levels.includes(p.scaffold) ? p.scaffold : levels[levels.length - 1];
  const key = { 1: 'parsons', 2: 'fill', 3: 'write' }[scaffold];
  const template = scaffold === 2 ? codeText(order.fill_code) : codeText(order.starter_code);
  const code = p.code[key] ?? template;
  const source = scaffold === 1 ? p.parsons.map((i) => order.parsons_lines![i].code).join('\n') + '\n' : code;
  const ready = status === 'ready';
  // In a lesson the teacher sees the program (read-only): a snapshot after 4 s without typing.
  useEffect(() => {
    if (!inLesson) return;
    const t = window.setTimeout(() => { sendCode(fileId, source).catch(() => undefined); }, 4000);
    return () => window.clearTimeout(t);
  }, [inLesson, fileId, source]);
  const stdinLines = () => { const l = stdin.split('\n'); while (l.length && l[l.length - 1] === '') l.pop(); return l; };

  const doRun = async () => {
    setBusy(true);
    try {
      const r = await py().runCode(source, stdinLines());
      setRun(r);
      setTab('screen');
      if (!g.badges.includes('first_run')) g.award('first_run');
      if (r.error) g.noteErrors([r.error.explain.tag]);
      setVika(r.error ? `${r.error.explain.title} ${r.error.explain.where} ${r.error.explain.check}` : null);
    } finally { setBusy(false); }
  };
  const doCheck = async () => {
    setBusy(true);
    try {
      // In a lesson with a checker service the server checks (hidden cases from the server); otherwise — or if it
      // cannot — the same judge runs here in Pyodide and gives the same result.
      let r: OrderResult | null = null;
      if (inLesson) {
        try { r = await serverCheck<OrderResult>(fileId, source, p.hints, p.clarify ?? null); }
        catch (e) { if (e instanceof ApiError && e.status === 403) { setVika(e.message); return; } r = null; }
      }
      setCheckedBy(r ? 'server' : 'browser');
      if (!r) r = await py().runOrder(source, order, p.hints, p.clarify);
      setLastCheck(r);
      patch({ attempts: (p.attempts ?? 0) + 1 });
      g.noteErrors([...(r.error ? [r.error.explain.tag] : []), ...r.bugs.map((b) => b.tag)]);
      onChecked(r);
    } finally { setBusy(false); }
  };
  const takeHint = () => {
    if (g.useFreeHint()) setFreeHint(true);
    else patch({ hints: Math.min(3, p.hints + 1) });
    const level = Math.min(3, p.hints + (freeHint ? 1 : 0) + 1);
    const ctx = run?.error ? `${run.error.explain.title} ${run.error.explain.where} ` : lastCheck?.bugs[0] ? `${lastCheck.bugs[0].text} ` : '';
    setVika(`${ctx}${order.hints[level - 1] ?? ''}`);
  };
  const shownHints = Math.min(3, p.hints + (freeHint ? 1 : 0));
  const reset = () => {
    setUndo({ code: p.code, parsons: p.parsons });
    patch({ code: { ...p.code, [key]: template }, parsons: [] });
    setTimeout(() => setUndo(null), 12000);
  };
  const download = () => {
    const blob = new Blob([`# ${order.title} — курс «Поехали!», Бюро «Космос»\n${source}`], { type: 'text/x-python' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `order_${order.id.replace('.', '_')}.py`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const { monitor, full } = monitorRect(box);
  const notesRect = full ? null : mapRect(NOTES_RECT, box, 0.98);
  const complaints = lastCheck?.cases.filter((c) => !c.passed && c.reply).map((c) => c.reply as string) ?? [];
  const lastSub = p.submissions[p.submissions.length - 1];
  const revisionNotes = p.version > 0 && lastSub ? lastSub.complaints : [];

  if (order.warmup && !p.warmupDone) {
    return (
      <Stage scene={{ location: 'desk', time: 'day', transition: 'zoom' }} cast={[{ who: 'vika', pos: 'right', mood: 'joy' }]} classic={g.settings.classic} dim>
        <InWorldPanel label="Разминка от Вики">
          <p className="small muted">Вика заглядывает через плечо: «Сначала разомнёмся».</p>
          <CheckView check={order.warmup} classic={g.settings.classic} onDone={(r) => {
            g.recordCheck([...(order.warmup?.requires ?? []), ...(order.warmup?.introduces ?? [])], r.correct);
            g.introduce(order.warmup?.introduces ?? []);
            patch({ warmupDone: true });
          }} />
        </InWorldPanel>
      </Stage>
    );
  }

  const notes = (
    <div className="sticky-notes">
      <div className="sticky">
        <strong>ТЗ · {charName(order.client_id)}</strong>
        <ul>
          {order.requirements.map((r) => {
            const st = lastCheck?.requirements.find((x) => x.id === r.id)?.ok;
            return <li key={r.id}><span aria-hidden="true">{st === true ? '☑' : st === false ? '☒' : '☐'}</span> {r.text}
              <span className="sr-only">{st === true ? ' — выполнено' : st === false ? ' — не выполнено' : ''}</span></li>;
          })}
        </ul>
      </div>
      {order.statement_md && <div className="sticky blue"><RichText text={order.statement_md} /></div>}
      {(revisionNotes.length > 0 || complaints.length > 0) && (
        <div className="sticky pink"><strong>Замечания</strong>{(complaints.length ? complaints : revisionNotes).slice(0, 2).map((c) => <p key={c}>«{c}»</p>)}</div>
      )}
    </div>
  );

  return (
    <div ref={ref} className="desk-root">
      <Stage scene={{ location: 'desk', time: 'day', transition: 'zoom' }} cast={[]} classic={g.settings.classic}>
        <motion.div className={`monitor ${full ? 'full' : ''}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          style={full ? undefined : { left: monitor!.left, top: monitor!.top, width: monitor!.width, height: monitor!.height }}>
          <div className="ide-bar">
            <span className="ide-dots" aria-hidden="true"><i /><i /><i /></span>
            <span className="mono small">order_{order.id.replace('.', '_')}.py — {versionLabel(p.version)}</span>
            <span className="spacer" />
            {!ready && <span className="small" role="status">{status === 'restarting' ? 'Перезапуск среды…' : 'Загрузка Python…'}</span>}
          </div>
          <div className="ide-tabs" role="tablist" aria-label="Панели">
            {(['code', 'screen', ...(full ? ['tz'] : [])] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className="ide-tab" onClick={() => setTab(t as typeof tab)}>
                {{ code: 'Код', screen: 'Пульт заказчика', tz: 'ТЗ' }[t]}
              </button>
            ))}
            {levels.length > 1 && tab === 'code' && (
              <span className="ide-modes" role="group" aria-label="Ступень поддержки">
                {levels.map((l) => <button key={l} className="ide-mode" aria-pressed={scaffold === l} onClick={() => patch({ scaffold: l })}>{SCAFFOLD_RU[l]}</button>)}
              </span>
            )}
          </div>
          <div className="ide-body">
            {tab === 'code' && (scaffold === 1
              ? <Parsons lines={order.parsons_lines!} chosen={p.parsons} onChange={(c) => patch({ parsons: c })} seed={fileId} />
              : <CodeEditor value={code} onChange={(v) => patch({ code: { ...p.code, [key]: v } })} label="Редактор кода"
                  errorLine={run?.error?.line ?? null} onRun={doRun} onCheck={doCheck} />)}
            {tab === 'screen' && (
              <div className="stack-sm">
                <label className="stack-sm"><span className="small">Что введёт оператор (по строке на каждый <code>input()</code>)</span>
                  <textarea className="stdin" value={stdin} onChange={(e) => setStdin(e.target.value)} rows={2} /></label>
                <pre className="terminal" aria-live="polite">{run ? (run.stdout || '(программа ничего не напечатала)') : '$ нажми ▶, чтобы запустить'}
                  {run?.error && `\n✖ ${run.error.type}: ${run.error.message}`}</pre>
              </div>
            )}
            {tab === 'tz' && notes}
          </div>
          <div className="ide-toolbar" role="toolbar" aria-label="Действия">
            <button className="btn primary small" onClick={doRun} disabled={busy || !ready} title="Ctrl+Enter">▶ Запустить</button>
            <button className="btn small" onClick={() => setTrace(true)} disabled={busy || !ready}>Пошагово</button>
            <button className="btn ghost small" onClick={takeHint} disabled={shownHints >= 3}>Подсказка {shownHints}/3</button>
            <button className="btn ghost small" onClick={reset}>Сброс</button>
            <button className="btn ghost small" onClick={download} aria-label="Скачать .py">⬇ .py</button>
            <span className="spacer" />
            {checkedBy === 'server' && <span className="small muted" role="status">✓ проверено сервером урока</span>}
            <button className="btn accent small" onClick={doCheck} disabled={busy || !ready} title="Ctrl+Shift+Enter">🧪 На испытания</button>
          </div>
          {undo && <div className="ide-undo" role="status">Код сброшен. <button className="btn small" onClick={() => { patch(undo); setUndo(null); }}>Отменить</button></div>}
          {trace && (
            <div className="ide-overlay" role="dialog" aria-label="Пошагово">
              <div className="row"><strong>Пошагово</strong><span className="spacer" /><button className="btn small" onClick={() => setTrace(false)}>Закрыть</button></div>
              <TraceView source={source} stdin={stdinLines()} />
            </div>
          )}
        </motion.div>
        {!full && notesRect && (
          // Below the corner buttons (phone, pause): the sticky notes never sit under them.
          <div className="notes-anchor" style={{ left: notesRect.left, top: Math.max(notesRect.top, 76), width: notesRect.width,
            height: notesRect.height - Math.max(0, 76 - notesRect.top) }}>{notes}</div>
        )}
        {!full && !notesRect && <div className="notes-float">{notes}</div>}
        <AnimatePresence>
          {vika && (
            <motion.div className="buddy" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              {!g.settings.classic && <Character id="vika" mood={run?.error ? 'thinking' : 'neutral'} size={84} />}
              <div className="buddy-bubble"><strong>Вика</strong><RichText text={vika} />
                <button className="btn ghost small" onClick={() => setVika(null)}>Понятно</button></div>
            </motion.div>
          )}
        </AnimatePresence>
      </Stage>
    </div>
  );
}

// ------------------------------------------------------------- ③ испытания на стенде
function BuildRun({ order, result, onNext, onBack }: { order: Order; result: OrderResult; onNext: () => void; onBack: () => void }) {
  const g = useGame();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? result.events.length : 0);
  useEffect(() => {
    if (shown >= result.events.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), result.events[shown]?.type === 'case_start' ? 500 : 280);
    return () => clearTimeout(t);
  }, [shown, result.events]);
  const evs = result.events.slice(0, shown);
  const finished = shown >= result.events.length;
  let hidden = 0;
  const log: string[] = [];
  const chat: { ok: boolean; text: string }[] = [];
  for (const e of evs) {
    if (e.type === 'build_start') log.push(`$ стенд испытаний: проверок ${e.total}`);
    if (e.type === 'compile_fail') log.push(`✖ не собралось: ${e.error.explain.title} ${e.error.explain.where}`);
    if (e.type === 'case_pass' || e.type === 'case_fail') {
      const name = e.hidden ? `скрытая проверка ${++hidden}` : `тест ${e.id}`;
      log.push(`${e.type === 'case_pass' ? '✔' : '✖'} ${name}`);
      if (e.reply) chat.push({ ok: e.type === 'case_pass', text: e.reply });
    }
    if (e.type === 'build_end') log.push(`— пройдено ${e.summary.passed} из ${e.summary.total}`);
  }
  const { ref, box } = useBox<HTMLDivElement>();
  const { monitor, full } = monitorRect(box);
  return (
    <div ref={ref} className="desk-root">
    <Stage scene={{ location: 'desk', time: 'day', transition: 'fade' }} cast={[]} classic={g.settings.classic}>
      <div className={full ? 'build-split' : 'build-free'}>
        <div className={`monitor ${full ? 'full static' : ''}`}
          style={full ? undefined : { left: monitor!.left, top: monitor!.top, width: monitor!.width, height: monitor!.height }}>
          <div className="ide-bar"><span className="ide-dots" aria-hidden="true"><i /><i /><i /></span><span className="mono small">испытательный стенд</span></div>
          <pre className="terminal big" aria-live="polite">{log.join('\n')}{!finished && '\n▍'}</pre>
        </div>
        <motion.section className="messenger" aria-label={`Сообщения от ${charName(order.client_id)}`}
          initial={reduce ? false : { x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <header className="row">{!g.settings.classic && <Character id={order.client_id as CharacterId} mood="neutral" size={40} />}<strong>{charName(order.client_id)}</strong>
            {!finished && <span className="small muted">печатает…</span>}</header>
          <ol>
            <AnimatePresence>
              {chat.map((m, i) => (
                <motion.li key={i} className={`msg ${m.ok ? 'ok' : 'bad'}`} initial={reduce ? false : { opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                  <span aria-hidden="true">{m.ok ? '👍' : '😕'}</span> {m.text}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          {finished && (
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn ghost small" onClick={onBack}>← Ещё поправлю</button>
              <button className="btn primary" onClick={onNext} autoFocus>К заказчику →</button>
            </div>
          )}
        </motion.section>
      </div>
    </Stage>
    </div>
  );
}

// ------------------------------------------------------------- ④ запуск: сдача заказчику
function CounterOut({ order, fileId, p, result, onRevise, onExit }: {
  order: Order; fileId: string; p: OrderProgress; result: OrderResult; onRevise: () => void; onExit: (next?: string) => void;
}) {
  const g = useGame();
  const reduce = useReducedMotion();
  const s = result.summary;
  const review = useMemo(() => reviewText(result), [result]);
  const [phase, setPhase] = useState<'review' | 'card' | 'report' | 'bye' | 'museum'>('review');
  const [gain, setGain] = useState<{ tips: number; rep: [number, number] } | null>(null);
  const revision = result.needs_revision;
  const accepted = s.stars >= 3 && !revision;
  const client = order.client_id;
  const did = useMemo(() => REPORT_PHRASES.did.slice(0, 3), []);

  const commit = (said: string) => {
    const before = reputation(g.orders);
    const tips = tipsDue(p.bestStars, s.stars);
    const sub = { version: versionLabel(p.version), stars: s.stars, score: s.score, review: review.text, complaints: review.complaints,
      at: Date.now(), hints: p.hints, report: { did: said ? [said] : [], checked: [], note: '' } };
    g.patchOrder(fileId, { submissions: [...p.submissions, sub], bestStars: Math.max(p.bestStars, s.stars), needsRevision: revision });
    if (tips) g.addCoins(tips);
    g.recordCheck([...order.requires, ...order.introduces], accepted);
    if (accepted) {
      g.introduce(order.introduces);
      if (order.kind === 'bugreport') g.award('bug_hunter');
      if (s.stars === 5) g.award('five_stars');
      if (s.stars === 5 && p.hints === 0) g.award('no_hints');
      if (result.style_report.length === 0) g.award('clean_code');
      if (order.clarify && s.parts.accuracy === 10) g.award('attentive');
      if (p.version > 0) g.award('revised');
      g.mail({ id: `review-${fileId}-${p.version}-${s.stars}`, from: charName(client), title: `Отзыв: «${order.title}» ${starsText(s.stars)}`, body: review.text });
    }
    const after = reputation({ ...g.orders, [fileId]: { ...p, submissions: [...p.submissions, sub] } });
    setGain({ tips, rep: [before, after] });
    setPhase('bye');
  };

  const lesson = LESSONS.find((l) => l.number === order.lesson);
  const next = (lesson ? lessonOrders(lesson) : []).find((o) => orderFileId(o) !== fileId &&
    !['accepted', 'locked'].includes(orderStatus(o, g.orders[orderFileId(o)], g.introduced)));
  const mood = moodForStars(s.stars);
  // The client's museum question: after an accepted mission, once per mission (classic mode has no game layer).
  const museumDue = !g.settings.classic && museumQuestionDue(!!order.museum, accepted, g.museumAnswers[fileId]);

  return (
    <Stage scene={{ location: 'counter', time: 'day', transition: 'fade' }} cast={[{ who: client, pos: 'center', mood }]} classic={g.settings.classic}
      dim={phase === 'card' || phase === 'museum'} shift={phase === 'report' || phase === 'bye'}>
      {phase === 'review' && <DialogueBox who={charName(client)} text={review.text} onNext={() => setPhase('card')} />}
      {phase === 'card' && (
        <InWorldPanel label="Оценка задания">
          <div className="score-card">
            <div className="score-stars" aria-label={`Оценка ${s.stars} из 5`}>
              {Array.from({ length: 5 }, (_, i) => (
                <motion.span key={i} className={i < s.stars ? 'on' : 'off'} initial={reduce ? false : { scale: 0, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }} transition={{ delay: reduce ? 0 : 0.2 + i * 0.15, type: 'spring', stiffness: 400, damping: 14 }}>★</motion.span>
              ))}
            </div>
            <p className="small muted">Балл {s.score} из 100</p>
            <ul className="score-parts small">
              <li>Видимые тесты <b>{s.parts.visible}/40</b></li><li>Скрытые проверки <b>{s.parts.hidden}/30</b></li>
              <li>Стиль кода <b>{s.parts.style}/10</b></li><li>Самостоятельность <b>{s.parts.independence}/10</b></li>
              <li>Точность уточнения <b>{s.parts.accuracy}/10</b></li>
            </ul>
            {revision && <div className="alert bad">Часть скрытых проверок не прошла — заказчик попросит доработку.</div>}
            <button className="btn primary" onClick={() => setPhase('report')} autoFocus>Дальше</button>
          </div>
        </InWorldPanel>
      )}
      {phase === 'report' && (
        <DialogueBox who={g.profile?.nick ?? 'Я'} player text="Что доложу заказчику?"
          choices={[...did.map((d) => ({ text: `«${d}»`, onPick: () => commit(d) })), { text: 'Просто кивнуть', onPick: () => commit('') }]} />
      )}
      {phase === 'bye' && gain && (
        <>
          {!g.settings.classic && gain.tips > 0 && (
            <div className="coin-rain" aria-hidden="true">
              {Array.from({ length: Math.min(10, gain.tips / 3) }, (_, i) => (
                <motion.span key={i} className="coin" style={{ left: `${30 + i * 4}%` }} initial={reduce ? false : { y: -60, opacity: 0 }}
                  animate={{ y: [-60, 220, 600], opacity: [0, 1, 0], x: [0, 0, 300] }} transition={{ duration: 1.6, delay: i * 0.07 }} />
              ))}
            </div>
          )}
          <DialogueBox who={charName(client)}
            text={revision ? (order.lines?.revision ?? 'Почти готово. Поправьте, пожалуйста, — подожду.') : accepted ? (order.lines?.good ?? 'Программа принята. Спасибо за работу!') : 'Пока не то, что нужно. Посмотрите ещё раз?'}
            extra={!g.settings.classic ? <p className="small dlg-gain">Премия +{gain.tips}{gain.tips === 0 ? ' (за эту оценку уже начислена)' : ''} · Надёжность бюро {gain.rep[0]} → {gain.rep[1]}%</p> : undefined}
            choices={[
              ...(museumDue ? [{ text: `Вопрос заказчика по музею (+${MUSEUM_BONUS} премии)`, tone: 'primary' as const, onPick: () => setPhase('museum') }] : []),
              ...((revision || s.stars < 5) ? [{ text: `Доработать (${versionLabel(p.version + 1)})`, tone: (!museumDue && (revision || s.stars < 3) ? 'primary' : 'normal') as 'primary' | 'normal', onPick: onRevise }] : []),
              ...(accepted && next ? [{ text: `Следующее задание: «${next.title}»`, tone: (museumDue ? 'normal' : 'primary') as 'primary' | 'normal', onPick: () => onExit(orderFileId(next)) }] : []),
              { text: 'Вернуться в зал бюро', onPick: () => onExit() },
            ]} />
        </>
      )}
      {phase === 'museum' && order.museum && (
        <InWorldPanel label="Вопрос заказчика по музею">
          <MuseumQuestion fileId={fileId} museumRef={order.museum} ask={order.museum.ask} who={charName(client)} onDone={() => setPhase('bye')} />
        </InWorldPanel>
      )}
    </Stage>
  );
}
