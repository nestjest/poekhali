import Fuse from 'fuse.js';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../art/Avatar';
import { GLOSSARY, LESSONS } from '../content';
import { notebookPages, pagesWord } from '../lib/notebook';
import { stemText } from '../lib/stem';
import { reputation, useGame } from '../store';
import { RichText } from './RichText';

/** Applies theme / text scale / readable font to <html>. */
export function useApplySettings() {
  const s = useGame((st) => st.settings);
  useEffect(() => {
    const root = document.documentElement;
    if (s.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', s.theme);
    root.style.setProperty('--text-scale', String(s.textScale));
    root.classList.toggle('readable', s.readableFont);
  }, [s]);
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" onClose={onClose} aria-labelledby="modal-title">
      <div className="stack">
        <div className="row">
          <h2 id="modal-title">{title}</h2>
          <span className="spacer" />
          <button className="btn ghost small" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}

export function Settings() {
  const { settings, setSettings } = useGame();
  const scale = (d: number) => setSettings({ textScale: Math.min(2, Math.max(0.9, Math.round((settings.textScale + d) * 10) / 10)) });
  const themes = [['auto', 'Авто', 'Как в системе'], ['light', 'Светлая', 'Светлая'], ['dark', 'Тёмная', 'Тёмная']] as const;
  return (
    <div className="settings">
      <div className="set-row">
        <span className="set-label" id="set-size">Размер текста</span>
        <div className="set-group" role="group" aria-labelledby="set-size">
          <button className="btn small" onClick={() => scale(-0.1)} aria-label="Уменьшить текст" disabled={settings.textScale <= 0.9}>A−</button>
          <span className="set-value" aria-live="polite">{Math.round(settings.textScale * 100)}%</span>
          <button className="btn small" onClick={() => scale(0.1)} aria-label="Увеличить текст" disabled={settings.textScale >= 2}>A+</button>
        </div>
      </div>
      <div className="set-row">
        <span className="set-label" id="set-theme">Тема</span>
        <div className="seg" role="radiogroup" aria-labelledby="set-theme">
          {themes.map(([t, label, full]) => (
            <button key={t} className="seg-btn" role="radio" aria-checked={settings.theme === t} aria-label={full} title={full}
              onClick={() => setSettings({ theme: t })}>{label}</button>
          ))}
        </div>
      </div>
      <label className="set-check">
        <input type="checkbox" checked={settings.readableFont} onChange={(e) => setSettings({ readableFont: e.target.checked })} />
        <span className="set-check-text"><strong>Читаемый шрифт</strong><span className="small muted">Lexend и Golos Text — буквы шире и спокойнее</span></span>
      </label>
      <label className="set-check">
        <input type="checkbox" checked={settings.classic} onChange={(e) => setSettings({ classic: e.target.checked })} />
        <span className="set-check-text"><strong>Режим «Классика»</strong><span className="small muted">Без сюжета, персонажей и премий</span></span>
      </label>
      <label className="set-check">
        <input type="checkbox" checked={settings.track === 'intro'} onChange={(e) => setSettings({ track: e.target.checked ? 'intro' : 'course' })} />
        <span className="set-check-text"><strong>Режим «Знакомство»</strong><span className="small muted">Два первых занятия без диагностики: для школьников и дней открытых дверей</span></span>
      </label>
      <p className="muted small">Звуков в игре нет. Анимации отключаются, если в системе включено «уменьшение движения».</p>
    </div>
  );
}

const QUICK = [
  { q: 'Не запускается', a: 'Прочитай сообщение под редактором: там написано, что случилось и в какой строке. Чаще всего это кавычки, скобки или двоеточие.' },
  { q: 'Не тот результат', a: 'Нажми «Пошагово» и посмотри, какие значения лежат в переменных. Сравни свой вывод с тем, что просит заказчик, строчка за строчкой.' },
  { q: 'Не понимаю ТЗ', a: 'Вернись к чек-листу требований слева. Каждый пункт — одна проверка. Делай по одному пункту и запускай.' },
  { q: 'Повтори объяснение', a: 'Открой «Тетрадь»: там короткие карточки по каждой теме. Или найди слово в поиске ниже.' },
];

export function AskVika() {
  const [answer, setAnswer] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const fuse = useMemo(() => new Fuse(
    GLOSSARY.map((g) => ({ ...g, key: stemText([g.term, ...(g.forms ?? []), g.simple].join(' ')) })),
    { keys: ['key', 'term'], threshold: 0.4, ignoreLocation: true },
  ), []);
  const found = query.trim() ? fuse.search(stemText(query)).slice(0, 4).map((r) => r.item) : [];
  return (
    <div className="stack">
      <p className="muted small">Помощник Вика — это система подсказок на правилах, без искусственного интеллекта.</p>
      <div className="row">
        {QUICK.map((x) => <button key={x.q} className="btn small" onClick={() => setAnswer(x.a)}>{x.q}</button>)}
      </div>
      {answer && <div className="alert hint" aria-live="polite">{answer}</div>}
      <label className="stack-sm">
        <span>Или спроси словами: что такое…</span>
        <input className="stdin" style={{ minHeight: 44 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="например: переменная" />
      </label>
      <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-live="polite">
        {found.map((g) => (
          <li key={g.term} className="card flat" style={{ padding: 12 }}>
            <strong>{g.term}</strong> — {g.simple}
            {g.example && <code style={{ display: 'block', width: 'fit-content' }}>{g.example}</code>}
          </li>
        ))}
        {query.trim() && !found.length && <li className="muted">Такого слова в словаре нет. Попробуй иначе.</li>}
      </ul>
    </div>
  );
}

export function Notebook() {
  const [q, setQ] = useState('');
  const introduced = useGame((s) => s.introduced);
  const stagesDone = useGame((s) => s.stagesDone);
  // Only topics already met: a page opens with its skill or after the lesson's instruction (lib/notebook.ts).
  const { open: cards, closed } = notebookPages(LESSONS, introduced, stagesDone);
  const shown = cards.filter((c) => !q.trim() || stemText(`${c.title} ${c.syntax} ${c.example} ${c.mistake}`).includes(stemText(q)));
  return (
    <div className="stack">
      <div className="row">
        <input className="stdin" style={{ minHeight: 44, flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по тетради" aria-label="Поиск по тетради" />
        <button className="btn small" onClick={() => window.print()}>Печать</button>
      </div>
      <div className="stack-sm">
        {shown.map((c) => (
          <article key={c.id} className="card flat" style={{ padding: 16, gap: 8 }}>
            <h3>{c.title}</h3>
            <code style={{ display: 'block', width: 'fit-content' }}>{c.syntax}</code>
            <pre className="muted">{c.example}</pre>
            <p className="small"><strong>Типичная ошибка:</strong> <RichText text={c.mistake} /></p>
          </article>
        ))}
        {!shown.length && <p className="muted">{cards.length ? 'Ничего не нашлось.' : 'Тетрадь пока пустая: первые страницы появятся на инструктаже у Ольги.'}</p>}
        {closed > 0 && cards.length > 0 && <p className="small muted">Ещё не открыто: {closed} {pagesWord(closed)}. Они появятся вместе с новыми темами.</p>}
      </div>
    </div>
  );
}

/** Top bar. `reading` hides HUD (reading mode: only exit and settings). */
export function TopBar({ crumbs, reading = false, children }: { crumbs?: ReactNode; reading?: boolean; children?: ReactNode }) {
  const { coins, orders, profile, settings, letters } = useGame();
  const [panel, setPanel] = useState<null | 'settings' | 'vika' | 'notebook'>(null);
  const unread = letters.filter((l) => !l.read).length;
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="«Поехали!» — на главную">
          {profile && !settings.classic ? <Avatar id={profile.avatar} size={36} /> : <span aria-hidden="true">💻</span>}
          <span>«Поехали!»</span>
        </Link>
        {crumbs && <nav className="crumbs" aria-label="Где я">{crumbs}</nav>}
        <span className="spacer" />
        {children}
        {!reading && !settings.classic && (
          <>
            <span className="chip" title="Премия"><span className="coin" aria-hidden="true" />{coins}<span className="sr-only"> премия</span></span>
            <span className="chip" title="Надёжность бюро">★ {reputation(orders)}<span className="sr-only"> надёжность бюро</span></span>
            <Link to="/mail" className="btn ghost small" aria-label={`Пневмопочта, непрочитанных: ${unread}`}>✉ {unread > 0 && <span className="badge-dot">{unread}</span>}</Link>
          </>
        )}
        <button className="btn ghost small" onClick={() => setPanel('notebook')} aria-label="Тетрадь">📒<span className="hide-narrow">Тетрадь</span></button>
        <button className="btn ghost small" onClick={() => setPanel('vika')} aria-label="Спросить Вику">💬<span className="hide-narrow">Вика</span></button>
        <button className="btn ghost small" onClick={() => setPanel('settings')} aria-label="Настройки">⚙</button>
      </header>
      <Modal open={panel === 'settings'} onClose={() => setPanel(null)} title="Настройки"><Settings /></Modal>
      <Modal open={panel === 'vika'} onClose={() => setPanel(null)} title="Спросить Вику"><AskVika /></Modal>
      <Modal open={panel === 'notebook'} onClose={() => setPanel(null)} title="Тетрадь"><Notebook /></Modal>
    </>
  );
}
