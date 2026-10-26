// Read-only view of a student's programs on the console + a personal comment (arrives as a letter in the game).
import { useEffect, useState } from 'react';
import type { ClassStudent } from '../lib/gate';
import { api, ApiError, type TeacherLesson } from '../lesson/api';

interface CodeEntry { order: string; source: string; at: number; result: { stars: number; passed?: number; total?: number } | null }

const COMMENT_PRESETS = ['Проверь кавычки и скобки', 'Сравни вывод с примером в ТЗ', 'Хорошо! Попробуй убрать лишние строки', 'Подойду через минуту'];

export function CodeViewer({ token, session, student, lesson, onClose, onComment }: {
  token: string; session: number; student: number; lesson: TeacherLesson;
  onClose: () => void; onComment: (text: string, order: string | null) => Promise<void> | void;
}) {
  const [data, setData] = useState<{ student: ClassStudent; code: CodeEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => api<{ student: ClassStudent; code: CodeEntry[] }>(`/api/teacher/sessions/${session}/students/${student}/code`, { token })
      .then((d) => { if (alive) { setData(d); setOrder((o) => o ?? d.code[0]?.order ?? null); } })
      .catch((e) => { if (alive) setError(e instanceof ApiError ? e.message : String(e)); });
    void load();
    const t = window.setInterval(load, 8000);       // the student keeps typing: refresh while the window is open
    return () => { alive = false; window.clearInterval(t); };
  }, [token, session, student]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const entry = data?.code.find((c) => c.order === order) ?? null;
  const title = (file: string) => lesson.orders.find((o) => o.file === file);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onComment(text.trim(), order);
    setText('');
    setSent(true);
  };

  return (
    <div className="t-modal" role="dialog" aria-modal="true" aria-labelledby="code-h" onClick={onClose}>
      <div className="card t-modal-card stack-sm" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 id="code-h">Код: {data?.student.nick ?? '…'}</h2>
          <span className="spacer" />
          <button className="btn small" onClick={onClose} autoFocus>Закрыть</button>
        </div>
        {error && <p className="t-error" role="alert"><span aria-hidden="true">✕ </span>{error}</p>}
        {data && !data.code.length && <p className="muted">Ученик ещё не открывал задания. Код появится через несколько секунд после начала работы.</p>}
        {data && data.code.length > 0 && (
          <>
            <div className="row" role="tablist" aria-label="Задания">
              {data.code.map((c) => (
                <button key={c.order} role="tab" aria-selected={c.order === order} className="btn small ghost" aria-pressed={c.order === order}
                  onClick={() => { setOrder(c.order); setSent(false); }}>{title(c.order)?.id ?? c.order}</button>
              ))}
            </div>
            {entry && (
              <>
                <p className="small muted">
                  «{title(entry.order)?.title ?? entry.order}» · изменено {new Date(entry.at * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  {entry.result ? ` · проверка сервером: ${entry.result.stars}★${entry.result.total ? `, испытаний ${entry.result.passed}/${entry.result.total}` : ''}` : ' · после изменения не проверялся'}
                </p>
                <pre className="t-codeview" aria-label="Код ученика (только чтение)">
                  {entry.source.split('\n').map((line, i) => <span key={i} className="t-codeline"><span className="t-ln" aria-hidden="true">{i + 1}</span>{line || ' '}{'\n'}</span>)}
                </pre>
              </>
            )}
          </>
        )}
        <form className="stack-sm" onSubmit={send}>
          <label className="stack-sm"><span>Комментарий ученику{entry ? ` к заданию ${title(entry.order)?.id ?? ''}` : ''}</span>
            <textarea className="t-input" rows={2} value={text} maxLength={400} onChange={(e) => { setText(e.target.value); setSent(false); }}
              placeholder="Придёт уведомлением и письмом в пневмопочту. Не пишите готовое решение." /></label>
          <div className="row" role="group" aria-label="Готовые фразы">
            {COMMENT_PRESETS.map((c) => <button type="button" key={c} className="btn small ghost" onClick={() => setText(c)}>{c}</button>)}
          </div>
          <div className="row">
            <button className="btn primary" disabled={!text.trim()}>Отправить комментарий</button>
            {sent && <span className="small" role="status">✓ Отправлено</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
