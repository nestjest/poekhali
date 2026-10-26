import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { create } from 'zustand';

interface Toast { id: number; title: string; text?: string }
interface ToastState { items: Toast[]; push: (title: string, text?: string) => void; drop: (id: number) => void }

let seq = 0;
export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (title, text) => set((s) => ({ items: [...s.items, { id: ++seq, title, text }] })),
  drop: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

/** «Новое: …» notifications, like achievements in games. */
export function Toasts() {
  const { items, drop } = useToasts();
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(() => drop(items[0].id), 4200);
    return () => clearTimeout(t);
  }, [items, drop]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {items.slice(0, 3).map((t) => (
          <motion.div key={t.id} className="toast" onClick={() => drop(t.id)}
            initial={reduce ? false : { opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, x: 40 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
            <span className="toast-star" aria-hidden="true">✦</span>
            <span className="stack-sm" style={{ gap: 2 }}><strong>{t.title}</strong>{t.text && <span className="small">{t.text}</span>}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
