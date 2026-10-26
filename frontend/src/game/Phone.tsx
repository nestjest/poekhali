import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar } from '../art/Avatar';
import { AskVika, Notebook, Settings } from '../components/Shell';
import { MailApp, ReviewsApp, ShopApp, SkillsApp } from '../screens/Misc';
import { CrewApp, MuseumApp, OrbitApp } from './BureauApps';
import { openExhibits } from '../lib/crafts';
import { useLesson } from '../lesson/lessonStore';
import { reputation, useGame } from '../store';

type AppId = 'notebook' | 'vika_chat' | 'mail' | 'reviews' | 'skills' | 'shop' | 'museum' | 'orbit' | 'crew' | 'settings';
const APPS: { id: AppId; title: string; icon: string; color: string }[] = [
  { id: 'notebook', title: 'Тетрадь', icon: '📒', color: 'var(--art-yellow)' },
  { id: 'vika_chat', title: 'Вика', icon: '💬', color: 'var(--art-teal)' },
  { id: 'mail', title: 'Пневмопочта', icon: '✉️', color: 'var(--accent)' },
  { id: 'reviews', title: 'Журнал миссий', icon: '⭐', color: 'var(--accent-soft)' },
  { id: 'skills', title: 'Навыки', icon: '📈', color: 'var(--ok-bg)' },
  { id: 'museum', title: 'Музей бюро', icon: '🏛️', color: 'var(--art-sky)' },
  { id: 'orbit', title: 'Карта орбит', icon: '🛰️', color: 'var(--art-star)' },
  { id: 'crew', title: 'Экипаж', icon: '🏁', color: 'var(--note-blue)' },
  { id: 'shop', title: 'Склад', icon: '📦', color: 'var(--surface-2)' },
  { id: 'settings', title: 'Настройки', icon: '⚙️', color: 'var(--surface-2)' },
];

/** In-game smartphone: the only «menu» of the game. Apps appear as they are unlocked. */
export function Phone({ open, onClose, initialApp }: { open: boolean; onClose: () => void; initialApp?: AppId | null }) {
  const g = useGame();
  const reduce = useReducedMotion();
  const [app, setApp] = useState<AppId | null>(initialApp ?? null);
  const screen = useRef<HTMLDivElement>(null);
  // A new app opens at its top, not at the scroll position of the icon grid.
  useEffect(() => { screen.current?.scrollTo({ top: 0 }); }, [app, open]);
  useEffect(() => { if (open) setApp(initialApp ?? null); }, [open, initialApp]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); app ? setApp(null) : onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, app, onClose]);

  const apps = APPS.filter((a) => g.features.includes(a.id) || a.id === 'settings');
  const unread = g.letters.filter((l) => !l.read).length;
  const grants = useLesson((s) => s.me?.grants);
  const unstudied = openExhibits(g, grants).filter((ex) => !g.museumStudied.includes(ex.id)).length;
  const body: Record<AppId, ReactNode> = {
    notebook: <Notebook />, vika_chat: <AskVika />, mail: <MailApp />, reviews: <ReviewsApp />,
    skills: <SkillsApp />, shop: <ShopApp />, museum: <MuseumApp />, orbit: <OrbitApp />, crew: <CrewApp />, settings: <Settings />,
  };
  const current = APPS.find((a) => a.id === app);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="phone-backdrop" onClick={onClose} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="phone" role="dialog" aria-modal="true" aria-label="Рабочий телефон" onClick={(e) => e.stopPropagation()}
            initial={reduce ? false : { y: 80, rotate: 4, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
            <div className="phone-status">
              <span>9:41</span><span className="spacer" />
              {g.features.includes('coins') && <><span className="coin" aria-hidden="true" />{g.coins}<span className="sr-only"> премия</span>
                <span aria-hidden="true">★</span>{reputation(g.orders)}<span className="sr-only"> надёжность бюро, %</span></>}
            </div>
            <div className="phone-screen" ref={screen}>
              {current ? (
                <div className="stack">
                  <div className="row phone-app-head">
                    <button className="btn ghost small" onClick={() => setApp(null)} aria-label="Назад к приложениям">←</button>
                    <h2 style={{ fontSize: 'var(--fs-h3)' }}>{current.title}</h2>
                  </div>
                  {body[current.id]}
                </div>
              ) : (
                <div className="stack">
                  <div className="row">
                    {g.profile && <Avatar id={g.profile.avatar} size={44} />}
                    <div><strong>{g.profile?.nick ?? 'Новичок'}</strong><div className="small muted">Инженер-программист, стажёр</div></div>
                  </div>
                  <div className="phone-apps">
                    {apps.map((a) => (
                      <button key={a.id} className="phone-app" onClick={() => setApp(a.id)}>
                        <span className="phone-icon" style={{ background: a.color }} aria-hidden="true">{a.icon}
                          {a.id === 'mail' && unread > 0 && <span className="badge-dot phone-badge">{unread}</span>}
                          {a.id === 'museum' && unstudied > 0 && <span className="badge-dot phone-badge">{unstudied}</span>}</span>
                        <span>{a.title}{a.id === 'museum' && unstudied > 0 && <span className="sr-only">, не изучено: {unstudied}</span>}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="phone-home" onClick={onClose} aria-label="Убрать телефон" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PhoneButton({ onClick }: { onClick: () => void }) {
  const unread = useGame((s) => s.letters.filter((l) => !l.read).length);
  const features = useGame((s) => s.features);
  if (!features.includes('phone')) return null;
  return (
    <motion.button className="phone-btn" onClick={onClick} aria-label={`Телефон${unread ? `, непрочитанных: ${unread}` : ''}`}
      initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }}>
      <span aria-hidden="true">📱</span>
      {features.includes('mail') && unread > 0 && <span className="badge-dot phone-badge">{unread}</span>}
    </motion.button>
  );
}

/** Esc menu: like any game. */
export function PauseMenu({ open, onClose, onPhone, onTitle }: { open: boolean; onClose: () => void; onPhone: (app?: AppId) => void; onTitle: () => void }) {
  const reduce = useReducedMotion();
  const features = useGame((s) => s.features);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="pause" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.nav className="pause-menu" aria-label="Пауза" initial={reduce ? false : { scale: 0.92 }} animate={{ scale: 1 }}>
            <h2>Пауза</h2>
            <button className="btn primary" onClick={onClose} autoFocus>Продолжить</button>
            {features.includes('notebook') && <button className="btn" onClick={() => onPhone('notebook')}>Тетрадь</button>}
            <button className="btn" onClick={() => onPhone('settings')}>Настройки</button>
            <button className="btn ghost" onClick={onTitle}>Главное меню</button>
          </motion.nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export type { AppId };
