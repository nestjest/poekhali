// «Пульт урока» — the teacher page (/#/teacher). Not part of the game: a working tool for the lesson.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, type AvatarId } from '../art/Avatar';
import { LESSONS } from '../content';
import { commonErrors, STATUS_LABEL, studentStatus, type ClassStudent, type PublicPoll, type StudentStatus } from '../lib/gate';
import { api, ApiError, POLL_FAST_MS, WS_GIVE_UP, wsUrl, type ClassView, type SessionSummary, type TeacherLesson } from '../lesson/api';
import { CodeViewer } from './CodeViewer';
import { CrewsCard } from './CrewsCard';
import { errorTagRu } from './errorTags';
import './teacher.css';

export const TOKEN_KEY = 'bureau-teacher-token';
export const SESSION_KEY = 'bureau-teacher-session';
export const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };

const ATTENTION_PRESETS = ['Все смотрим на доску', 'Руки от клавиатуры — слушаем', 'Перерыв 5 минут', 'Подводим итоги'];

export function TeacherConsole() {
  const [token, setToken] = useState<string | null>(() => read(TOKEN_KEY));
  const [sessionId, setSessionId] = useState<number | null>(() => Number(read(SESSION_KEY)) || null);
  const logout = useCallback(() => { write(TOKEN_KEY, null); setToken(null); }, []);
  const choose = (id: number | null) => { write(SESSION_KEY, id ? String(id) : null); setSessionId(id); };

  return (
    <div className="teacher">
      <header className="topbar">
        <Link to="/" className="brand"><span aria-hidden="true">🚀</span><span>«Поехали!»</span></Link>
        <span className="crumbs">Пульт урока</span>
        <span className="spacer" />
        <Link className="btn ghost small" to="/plan/0">План урока</Link>
        {token && sessionId && <button className="btn ghost small" onClick={() => choose(null)}>Все уроки</button>}
        {token && <button className="btn ghost small" onClick={logout}>Выйти</button>}
      </header>
      <main className="page teacher-page">
        {!token ? <Login onToken={(t) => { write(TOKEN_KEY, t); setToken(t); }} />
          : sessionId ? <Console token={token} id={sessionId} onAuthLost={logout} onClose={() => choose(null)} />
            : <Sessions token={token} onAuthLost={logout} onOpen={choose} />}
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ login
export function Login({ onToken }: { onToken: (t: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onToken((await api<{ token: string }>('/api/teacher/login', { body: { password } })).token); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Не получилось войти.'); }
    finally { setBusy(false); }
  };
  return (
    <form className="card read stack" onSubmit={submit} aria-labelledby="login-h">
      <h1 id="login-h">Пульт урока</h1>
      <p>Отсюда вы открываете ученикам этапы урока, видите класс и включаете «Внимание!». Пароль печатается в окне запуска сервера урока.</p>
      <label className="stack-sm"><span>Пароль преподавателя</span>
        <input className="t-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
      </label>
      {error && <p className="t-error" role="alert"><span aria-hidden="true">✕ </span>{error}</p>}
      <div className="row"><button className="btn primary" disabled={busy || !password}>{busy ? 'Входим…' : 'Войти'}</button></div>
      <details className="t-details"><summary>Как запустить сервер урока</summary>
        <ol className="small">
          <li>На компьютере преподавателя: <code>cd frontend</code>, <code>npm run build</code>.</li>
          <li>Затем <code>cd server</code>, <code>python -m bureau_server</code>.</li>
          <li>В окне появятся адреса для учеников и пароль преподавателя.</li>
        </ol>
      </details>
    </form>
  );
}

// ------------------------------------------------------------------ sessions
function Sessions({ token, onOpen, onAuthLost }: { token: string; onOpen: (id: number) => void; onAuthLost: () => void }) {
  const [list, setList] = useState<SessionSummary[] | null>(null);
  const [lesson, setLesson] = useState(LESSONS[0]?.number ?? 0);
  const [group, setGroup] = useState('');
  const [mode, setMode] = useState<'sync' | 'free'>('sync');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<SessionSummary[]>('/api/teacher/sessions', { token }).then(setList).catch((e) => {
      if (e instanceof ApiError && e.status === 401) onAuthLost(); else setError(e instanceof ApiError ? e.message : String(e));
    });
  }, [token, onAuthLost]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try { onOpen((await api<ClassView>('/api/teacher/sessions', { body: { lesson, group, mode }, token })).session.id); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Не получилось создать урок.'); }
  };
  return (
    <div className="stack">
      <form className="card stack" onSubmit={create} aria-labelledby="new-h">
        <h1 id="new-h">Новый урок</h1>
        <div className="t-form">
          <label className="stack-sm"><span>Занятие</span>
            <select className="t-input" value={lesson} onChange={(e) => setLesson(Number(e.target.value))}>
              {LESSONS.map((l) => <option key={l.number} value={l.number}>Занятие {l.number}. {l.title}</option>)}
            </select></label>
          <label className="stack-sm"><span>Группа (необязательно)</span>
            <input className="t-input" value={group} onChange={(e) => setGroup(e.target.value)} maxLength={40} placeholder="Например, ИСП-21" /></label>
        </div>
        <fieldset className="t-seg" aria-label="Режим урока">
          <legend className="small muted">Режим</legend>
          <label><input type="radio" name="mode" checked={mode === 'sync'} onChange={() => setMode('sync')} /> Вместе с классом — этапы открываю я</label>
          <label><input type="radio" name="mode" checked={mode === 'free'} onChange={() => setMode('free')} /> Свободный темп — я только наблюдаю</label>
        </fieldset>
        {error && <p className="t-error" role="alert"><span aria-hidden="true">✕ </span>{error}</p>}
        <div className="row"><button className="btn primary">Начать урок и получить код</button></div>
      </form>
      <section className="card flat stack-sm" aria-labelledby="active-h">
        <h2 id="active-h">Идущие уроки</h2>
        {list === null ? <p className="muted">Загрузка…</p> : !list.length ? <p className="muted">Пока нет.</p> : (
          <ul className="t-list">
            {list.map((s) => (
              <li key={s.id} className="row">
                <strong className="t-code-sm">{s.code}</strong>
                <span>Занятие {s.lesson}{s.group ? ` · ${s.group}` : ''} · учеников: {s.students}</span>
                <span className="spacer" />
                <button className="btn small" onClick={() => onOpen(s.id)}>Открыть пульт</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ console
export function useClass(token: string, id: number, onAuthLost: () => void) {
  const [view, setView] = useState<ClassView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const load = useCallback(async () => {
    try { setView(await api<ClassView>(`/api/teacher/sessions/${id}`, { token })); setError(null); }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthLost();
      else setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [token, id, onAuthLost]);
  useEffect(() => {
    void load();
    let ws: WebSocket | null = null;
    let stopped = false;
    let timer: number | undefined;
    let fails = 0;
    let everOpen = false;
    let last = Date.now();
    const open = () => {
      ws = new WebSocket(wsUrl(`role=teacher&token=${encodeURIComponent(token)}&session=${id}`));
      ws.onopen = () => { everOpen = true; fails = 0; setLive(true); };
      ws.onmessage = (ev) => {
        try { const m = JSON.parse(String(ev.data)) as { type: string } & ClassView; if (m.type === 'class') setView(m); } catch { /* ignore */ }
      };
      ws.onclose = () => {
        setLive(false);
        fails += 1;
        // Serverless hosting (Vercel) has no WebSockets: after a few failures the console lives on polling.
        if (!stopped && (everOpen || fails < WS_GIVE_UP)) timer = window.setTimeout(open, 3000);
      };
    };
    open();
    // Polling: every 15 s next to a live socket, every 3 s without it (the class panel stays current).
    const poll = window.setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN && Date.now() - last < 15_000) return;
      last = Date.now();
      void load();
    }, POLL_FAST_MS);
    return () => { stopped = true; window.clearInterval(poll); window.clearTimeout(timer); ws?.close(); };
  }, [token, id, load]);
  return { view, setView, error, setError, live };
}

function Console({ token, id, onAuthLost, onClose }: { token: string; id: number; onAuthLost: () => void; onClose: () => void }) {
  const { view, setView, error, setError, live } = useClass(token, id, onAuthLost);
  const [lessonInfo, setLessonInfo] = useState<TeacherLesson | null>(null);
  const [projector, setProjector] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now() / 1000), 10_000); return () => window.clearInterval(t); }, []);
  const studentUrl = useStudentUrl();
  useEffect(() => {
    api<TeacherLesson[]>('/api/teacher/lessons', { token }).then((ls) => setLessonInfo(ls.find((l) => l.number === view?.session.lesson) ?? ls[0] ?? null))
      .catch(() => undefined);
  }, [token, view?.session.lesson]);

  const act = async (path: string, body?: unknown) => {
    try { setView(await api<ClassView>(`/api/teacher/sessions/${id}/${path}`, { body: body ?? {}, token })); }
    catch (e) { if (e instanceof ApiError && e.status === 401) onAuthLost(); else setError(e instanceof ApiError ? e.message : String(e)); }
  };

  if (!view || !lessonInfo) return <p role="status">{error ?? 'Загрузка пульта…'}</p>;
  const s = view.session;
  const stages = lessonInfo.stages;
  const firstClosed = stages.find((st) => !s.open_stages.includes(st.id));
  const bossFile = [...lessonInfo.orders].reverse().find((o) => o.kind === 'boss')?.file;
  const statuses = view.students.map((st) => ({ st, status: studentStatus(st, bossFile, Math.max(view.now, now)) }));
  const helpQueue = statuses.filter((x) => x.status === 'help').sort((a, b) => (a.st.help ?? 0) - (b.st.help ?? 0));
  const atStage = (stageId: string) => view.students.filter((st) => st.progress?.stage === stageId).length;

  if (s.ended) {
    return (
      <div className="card read stack">
        <h1>Урок {s.code} завершён</h1>
        <p>Ученики продолжают самостоятельно, их прогресс сохранён в браузерах.</p>
        <div className="row">
          <button className="btn primary" onClick={() => downloadReport(token, id, s.lesson).catch((e) => setError(e instanceof Error ? e.message : String(e)))}>
            <span aria-hidden="true">⬇</span> Отчёт урока (CSV)</button>
          <button className="btn" onClick={onClose}>К списку уроков</button>
        </div>
        {error && <p className="t-error" role="alert"><span aria-hidden="true">✕ </span>{error}</p>}
      </div>
    );
  }

  return (
    <div className="console">
      {s.attention.on && (
        <div className="t-attention-on" role="status"><span aria-hidden="true">!</span> У всех на экранах «Внимание!»: «{s.attention.text}»
          <button className="btn small" onClick={() => act('attention', { on: false, text: '' })}>Снять</button></div>
      )}
      {error && <p className="t-error" role="alert"><span aria-hidden="true">✕ </span>{error}</p>}

      <section className="card t-head" aria-label="Код урока">
        <div className="stack-sm">
          <span className="small muted">Код урока — продиктуйте или покажите на проекторе</span>
          <strong className="t-code">{s.code}</strong>
          <span className="small">Ученикам: <span className="mono">{studentUrl}</span> → «Войти в урок»</span>
        </div>
        <div className="t-head-side stack-sm">
          <span className={`chip ${live ? 't-live' : ''}`}><span aria-hidden="true">{live ? '●' : '○'}</span> {live ? 'На связи' : 'Переподключаемся…'}</span>
          <span className="small">Занятие {s.lesson}{s.group ? ` · ${s.group}` : ''} · учеников: {view.students.length}</span>
          <div className="row">
            <button className="btn small" onClick={() => setProjector(true)}>Код на весь экран</button>
            <a className="btn small" href={`#/present?s=${s.id}`} target="_blank" rel="noopener">Проектор ↗</a>
          </div>
        </div>
      </section>

      <div className="console-grid">
        <div className="stack">
          <section className="card stack-sm" aria-labelledby="stages-h">
            <div className="row"><h2 id="stages-h">Этапы урока</h2>
              <Link className="btn ghost small" to={`/plan/${s.lesson}`}>План занятия {s.lesson}</Link><span className="spacer" />
              <div className="t-seg-row" role="group" aria-label="Режим">
                <button className="btn small" aria-pressed={s.mode === 'sync'} onClick={() => act('mode', { mode: 'sync' })}>Вместе</button>
                <button className="btn small" aria-pressed={s.mode === 'free'} onClick={() => act('mode', { mode: 'free' })}>Свободно</button>
              </div>
            </div>
            <p className="small muted">{s.mode === 'sync' ? 'Ученик не пройдёт дальше закрытого этапа: увидит «Ждём команду ЦУП».' : 'Свободный темп: все этапы доступны, вы наблюдаете.'}</p>
            {s.mode === 'sync' && firstClosed && (
              <button className="btn primary t-next" onClick={() => act('stage', { stage: firstClosed.id, open: true })}>
                Открыть этап «{firstClosed.title}»</button>
            )}
            {s.mode === 'sync' && !firstClosed && <p className="alert ok"><span><span aria-hidden="true">✓ </span>Все этапы открыты.</span></p>}
            <ol className="t-stages">
              {stages.map((st, i) => {
                const open = s.mode === 'free' || s.open_stages.includes(st.id);
                return (
                  <li key={st.id} className={`t-stage${open ? ' open' : ''}`}>
                    <div className="row">
                      <span className="t-num" aria-hidden="true">{i + 1}</span>
                      <span className="stack-sm t-stage-title"><strong>{st.title}</strong>
                        <span className="small muted">{st.minutes ? `${st.minutes} мин · ` : ''}{open ? '✓ открыт' : '🔒 закрыт'} · сейчас здесь: {atStage(st.id)}</span></span>
                      {s.mode === 'sync' && (
                        <button className="btn small" onClick={() => act('stage', { stage: st.id, open: !open })}
                          aria-label={`${open ? 'Закрыть' : 'Открыть'} этап «${st.title}»`}>{open ? 'Закрыть' : 'Открыть'}</button>
                      )}
                    </div>
                    {(st.teacher.say || st.teacher.ask?.length || st.teacher.mistakes?.length || st.teacher.stuck) && (
                      <details className="t-details"><summary>Подсказки к этапу</summary>
                        {st.teacher.say && <p><strong>Что сказать:</strong> {st.teacher.say}</p>}
                        {!!st.teacher.ask?.length && <p><strong>Вопросы классу:</strong> {st.teacher.ask.join(' · ')}</p>}
                        {!!st.teacher.mistakes?.length && <p><strong>Типичные ошибки:</strong> {st.teacher.mistakes.join(' · ')}</p>}
                        {st.teacher.stuck && <p><strong>Если застряли:</strong> {st.teacher.stuck}</p>}
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="card stack-sm" aria-labelledby="missions-h">
            <h2 id="missions-h">Задания</h2>
            <p className="small muted">Закрытое задание ученики видят в очереди с пометкой «Закрыто преподавателем».</p>
            <ul className="t-list">
              {lessonInfo.orders.map((o) => {
                const closed = s.closed_orders.includes(o.file);
                const done = view.students.filter((st) => studentDone(st, o.file)).length;
                return (
                  <li key={o.file} className="row">
                    <span className="stack-sm t-grow"><strong>{o.id} «{o.title}»</strong>
                      <span className="small muted">{closed ? '🔒 закрыто' : '✓ доступно'} · приняли: {done} из {view.students.length}</span></span>
                    <button className="btn small" onClick={() => act('order', { order: o.file, open: closed })}>{closed ? 'Открыть' : 'Закрыть'}</button>
                  </li>
                );
              })}
            </ul>
          </section>

          <AttentionCard on={s.attention.on} onSet={(on, text) => act('attention', { on, text })} />
          <PollControl poll={s.poll ?? null} asks={stages.find((st) => st.id === firstClosed?.id)?.teacher.ask ?? stages.flatMap((st) => st.teacher.ask ?? [])}
            onAct={(body) => act('poll', body)} />
          <MessageCard current={s.message?.text ?? ''} onSend={(text) => act('message', { text })} />

          <section className="card flat stack-sm">
            <h2>Отчёт и завершение</h2>
            <p className="small muted">Отчёт для журнала: этапы, звёзды и проверки по каждому заданию, ответы, вызовы. Игровая премия на оценку не влияет.</p>
            <div className="row"><button className="btn" onClick={() => downloadReport(token, id, s.lesson).catch((e) => setError(e instanceof Error ? e.message : String(e)))}>
              <span aria-hidden="true">⬇</span> Отчёт урока (CSV)</button></div>
            {!confirmEnd ? <div className="row"><button className="btn" onClick={() => setConfirmEnd(true)}>Завершить урок…</button></div> : (
              <div className="alert bad">
                <span>Завершить урок {s.code}? Ученики продолжат самостоятельно, вход по коду закроется.</span>
                <div className="row"><button className="btn" onClick={() => act('end')}>Да, завершить</button>
                  <button className="btn ghost" onClick={() => setConfirmEnd(false)} autoFocus>Отмена</button></div>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          {helpQueue.length > 0 && (
            <section className="card t-help stack-sm" aria-labelledby="help-h">
              <h2 id="help-h"><span aria-hidden="true">🔔 </span>Зовут ({helpQueue.length})</h2>
              <ol className="t-list">
                {helpQueue.map(({ st }) => (
                  <li key={st.id} className="row"><Avatar id={st.avatar as AvatarId} size={32} /><strong>{st.nick}</strong>
                    <span className="small muted">{stageTitle(stages, st)}</span><span className="spacer" />
                    <button className="btn small" onClick={() => act(`students/${st.id}/help`)}>Подошёл</button></li>
                ))}
              </ol>
            </section>
          )}
          <CrewsCard lesson={lessonInfo} crews={view.crews ?? []} race={view.race ?? []} students={view.students}
            onAct={(body) => act('crews', body)} />
          <ClassPanel statuses={statuses} lesson={lessonInfo} onAccept={(stid, order) => act(`students/${stid}/accept`, { order })}
            onCode={setViewing} />
          <ErrorsCard students={view.students} />
        </div>
      </div>

      {viewing !== null && (
        <CodeViewer token={token} session={id} student={viewing} lesson={lessonInfo} onClose={() => setViewing(null)}
          onComment={(text, order) => act(`students/${viewing}/comment`, { text, order })} />
      )}
      {projector && (
        <div className="t-projector" role="dialog" aria-modal="true" aria-label="Код урока на весь экран" onClick={() => setProjector(false)}>
          <span className="t-projector-label">«Поехали!» · вход в урок</span>
          <strong className="t-projector-code">{s.code}</strong>
          <span className="t-projector-url">{studentUrl} → «Войти в урок»</span>
          <button className="btn" onClick={() => setProjector(false)} autoFocus>Закрыть</button>
        </div>
      )}
    </div>
  );
}

/**
 * The address students type. A teacher who opened the console on localhost (often with Docker) must not dictate
 * «localhost» to the class: the server reports its LAN address or BUREAU_PUBLIC_URL; otherwise a hint.
 */
export function useStudentUrl(): string {
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  const [url, setUrl] = useState(local ? `http://<адрес этого компьютера>:${location.port || '80'}/` : `${location.origin}/`);
  useEffect(() => {
    if (!local) return;
    api<{ student_url?: string | null }>('/api/health').then((h) => { if (h.student_url) setUrl(h.student_url); }).catch(() => undefined);
  }, [local]);
  return url;
}

/** The CSV needs the teacher's token, so it is fetched and saved as a file (no token in the URL). */
async function downloadReport(token: string, id: number, lesson: number) {
  const res = await fetch(`/api/teacher/sessions/${id}/report.csv`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Не получилось скачать отчёт. Проверьте связь с сервером урока.');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `otchet-zanyatie-${lesson}-urok-${id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Mission accepted: 3★ in the browser or on the server check, or accepted by the teacher. */
export const studentDone = (st: ClassStudent, file: string): boolean =>
  Math.max(st.progress?.orders?.[file]?.stars ?? 0, st.grants?.checked?.[file] ?? 0) >= 3 || !!st.grants?.accepted?.includes(file);

const stageTitle = (stages: TeacherLesson['stages'], st: ClassStudent) =>
  stages.find((x) => x.id === st.progress?.stage)?.title ?? (st.progress?.where === 'title' ? 'на титуле' : '—');

function AttentionCard({ on, onSet }: { on: boolean; onSet: (on: boolean, text: string) => void }) {
  const [text, setText] = useState(ATTENTION_PRESETS[0]);
  return (
    <section className="card stack-sm" aria-labelledby="att-h">
      <h2 id="att-h">«Внимание!»</h2>
      <p className="small muted">Затемняет экраны учеников и показывает ваше сообщение. Ввод в игре блокируется, пока вы не снимете.</p>
      <div className="row" role="group" aria-label="Готовые фразы">
        {ATTENTION_PRESETS.map((p) => <button key={p} className="btn small ghost" aria-pressed={text === p} onClick={() => setText(p)}>{p}</button>)}
      </div>
      <input className="t-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} aria-label="Текст «Внимание!»" />
      <div className="row">
        {on ? <button className="btn" onClick={() => onSet(false, '')}>Снять «Внимание!»</button>
          : <button className="btn accent" onClick={() => onSet(true, text)}><span aria-hidden="true">!</span> Включить «Внимание!»</button>}
      </div>
    </section>
  );
}

const POLL_TEMPLATES: { q: string; options: string[] }[] = [
  { q: 'Как идёт задание?', options: ['Всё понятно', 'Есть вопросы', 'Застрял(а)'] },
  { q: 'Готовы идти дальше?', options: ['Да', 'Нужно ещё 5 минут'] },
];

/** Class poll: shown on the projector (#/present) and as a card on every student screen. */
function PollControl({ poll, asks, onAct }: { poll: PublicPoll | null; asks: string[]; onAct: (body: unknown) => void }) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const ready = q.trim() && options.filter((o) => o.trim()).length >= 2;
  return (
    <section className="card stack-sm" aria-labelledby="poll-h">
      <h2 id="poll-h">Опрос класса</h2>
      {poll ? (
        <>
          <p><strong>{poll.question}</strong> <span className="small muted">· {poll.open ? 'идёт' : 'закрыт'} · ответили: {poll.total}</span></p>
          <PollBars poll={poll} />
          <div className="row">
            {poll.open && <button className="btn" onClick={() => onAct({ action: 'close' })}>Закрыть приём ответов</button>}
            <button className="btn ghost" onClick={() => onAct({ action: 'clear' })}>Убрать опрос</button>
          </div>
        </>
      ) : (
        <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); if (ready) { onAct({ action: 'start', question: q.trim(), options: options.filter((o) => o.trim()) }); setQ(''); setOptions(['', '']); } }}>
          <p className="small muted">Ответы анонимны: на проекторе и у вас — только итог.</p>
          <div className="row" role="group" aria-label="Шаблоны">
            {POLL_TEMPLATES.map((tpl) => <button type="button" key={tpl.q} className="btn small ghost" onClick={() => { setQ(tpl.q); setOptions(tpl.options); }}>{tpl.q}</button>)}
            {asks.slice(0, 2).map((a) => <button type="button" key={a} className="btn small ghost" onClick={() => setQ(a)}>{a.length > 40 ? `${a.slice(0, 40)}…` : a}</button>)}
          </div>
          <input className="t-input" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="Вопрос" aria-label="Вопрос опроса" />
          {options.map((o, i) => (
            <div key={i} className="row">
              <input className="t-input t-grow" value={o} onChange={(e) => setOpt(i, e.target.value)} maxLength={80}
                placeholder={`Вариант ${String.fromCharCode(1040 + i)}`} aria-label={`Вариант ${i + 1}`} />
              {options.length > 2 && <button type="button" className="btn small ghost" onClick={() => setOptions((x) => x.filter((_, j) => j !== i))} aria-label={`Убрать вариант ${i + 1}`}>✕</button>}
            </div>
          ))}
          <div className="row">
            {options.length < 6 && <button type="button" className="btn small ghost" onClick={() => setOptions((x) => [...x, ''])}>+ вариант</button>}
            <span className="spacer" />
            <button className="btn" disabled={!ready}>Запустить опрос</button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Horizontal bars with numbers and percents (not colour alone). */
export function PollBars({ poll, big = false }: { poll: PublicPoll; big?: boolean }) {
  const max = Math.max(1, ...poll.counts);
  return (
    <ol className={`poll-bars${big ? ' big' : ''}`}>
      {poll.options.map((o, i) => {
        const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
        return (
          <li key={o} className="poll-bar">
            <span className="poll-bar-label"><b>{String.fromCharCode(1040 + i)}.</b> {o}</span>
            <span className="poll-bar-track" aria-hidden="true"><span className="poll-bar-fill" style={{ transform: `scaleX(${poll.counts[i] / max})` }} /></span>
            <span className="poll-bar-num">{poll.counts[i]} · {pct}%</span>
          </li>
        );
      })}
    </ol>
  );
}

function MessageCard({ current, onSend }: { current: string; onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <form className="card stack-sm" onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSend(text.trim()); setText(''); } }} aria-labelledby="msg-h">
      <h2 id="msg-h">Сообщение классу</h2>
      <p className="small muted">Придёт уведомлением и письмом в пневмопочту, работу не прерывает.</p>
      <input className="t-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Например: через 5 минут разбор полётов" aria-label="Текст сообщения" />
      <div className="row"><button className="btn" disabled={!text.trim()}>Отправить</button>
        {current && <span className="small muted">Последнее: «{current}»</span>}</div>
    </form>
  );
}

const ORDER_OF: StudentStatus[] = ['help', 'stuck', 'working', 'waiting', 'done', 'offline'];

function ClassPanel({ statuses, lesson, onAccept, onCode }: {
  statuses: { st: ClassStudent; status: StudentStatus }[]; lesson: TeacherLesson; onAccept: (studentId: number, order: string) => void;
  onCode: (studentId: number) => void;
}) {
  const [filter, setFilter] = useState<StudentStatus | 'all'>('all');
  const [accepting, setAccepting] = useState<number | null>(null);
  const counts = useMemo(() => {
    const c: Partial<Record<StudentStatus, number>> = {};
    for (const x of statuses) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [statuses]);
  const shown = statuses.filter((x) => filter === 'all' || x.status === filter)
    .sort((a, b) => ORDER_OF.indexOf(a.status) - ORDER_OF.indexOf(b.status) || a.st.nick.localeCompare(b.st.nick, 'ru'));
  return (
    <section className="card stack-sm" aria-labelledby="class-h">
      <h2 id="class-h">Класс</h2>
      <div className="row" role="group" aria-label="Фильтр">
        <button className="btn small ghost" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Все {statuses.length}</button>
        {ORDER_OF.filter((k) => counts[k]).map((k) => (
          <button key={k} className="btn small ghost" aria-pressed={filter === k} onClick={() => setFilter(k)}>
            <span aria-hidden="true">{STATUS_LABEL[k].icon}</span> {STATUS_LABEL[k].text} {counts[k]}</button>
        ))}
      </div>
      {!statuses.length && <p className="muted">Пока никто не вошёл. Покажите код урока на проекторе.</p>}
      <ul className="t-class">
        {shown.map(({ st, status }) => {
          const checks = st.progress?.checks;
          return (
            <li key={st.id} className={`t-student s-${status}`}>
              <div className="row t-student-head">
                <Avatar id={st.avatar as AvatarId} size={36} />
                <strong className="t-grow t-nick">{st.nick}</strong>
                <span className={`t-status s-${status}`}><span aria-hidden="true">{STATUS_LABEL[status].icon}</span> {STATUS_LABEL[status].text}</span>
              </div>
              <span className="small muted">Этап: {stageTitle(lesson.stages, st)}{checks?.total ? ` · вопросы ${checks.correct ?? 0}/${checks.total}` : ''}</span>
              <ul className="t-dots" aria-label="Задания">
                {lesson.orders.map((o) => {
                  const os = st.progress?.orders?.[o.file];
                  const byTeacher = st.grants?.accepted?.includes(o.file);
                  const stars = Math.max(os?.stars ?? 0, st.grants?.checked?.[o.file] ?? 0);
                  const state = stars >= 3 || byTeacher ? 'ok' : os ? 'try' : 'none';
                  const label = `${o.id}: ${state === 'ok' ? (byTeacher && stars < 3 ? 'зачтено' : `${stars}★`) : os ? `попыток ${os.attempts}` : 'не начато'}`;
                  return <li key={o.file} className={`t-dot ${state}`} title={label}><span aria-hidden="true">{state === 'ok' ? '✓' : state === 'try' ? os?.attempts ?? '·' : '·'}</span><span className="sr-only">{label}</span></li>;
                })}
              </ul>
              {accepting === st.id ? (
                <div className="row">
                  <select className="t-input t-select" defaultValue="" aria-label={`Зачесть задание ученику ${st.nick}`}
                    onChange={(e) => { if (e.target.value) { onAccept(st.id, e.target.value); setAccepting(null); } }}>
                    <option value="" disabled>Какое задание зачесть?</option>
                    {lesson.orders.map((o) => <option key={o.file} value={o.file}>{o.id} «{o.title}»</option>)}
                  </select>
                  <button className="btn small ghost" onClick={() => setAccepting(null)}>Отмена</button>
                </div>
              ) : (
                <div className="row">
                  <button className="btn small ghost" onClick={() => onCode(st.id)} aria-label={`Код ученика ${st.nick}`}>Код</button>
                  <button className="btn small ghost" onClick={() => setAccepting(st.id)}>Зачесть задание…</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ErrorsCard({ students }: { students: ClassStudent[] }) {
  const top = commonErrors(students);
  if (!top.length) return null;
  return (
    <section className="card flat stack-sm" aria-labelledby="err-h">
      <h2 id="err-h">Частые ошибки класса</h2>
      <ol className="t-list">
        {top.map(([tag, n, who]) => <li key={tag} className="row"><span className="t-grow">{errorTagRu(tag)}</span><span className="small muted">у {who} уч. · {n} раз</span></li>)}
      </ol>
      <p className="small muted">Хороший повод для разбора у доски.</p>
    </section>
  );
}

export default TeacherConsole;
