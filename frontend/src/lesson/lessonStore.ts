// Lesson connection state: «Самостоятельно» (solo) or a teacher-led lesson joined by code.
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { CrewView, RaceRow } from '../lib/crew';
import type { Grants, PublicSession } from '../lib/gate';

export interface Me { id: number; nick: string; grants: Grants; help: boolean; poll_answer?: number | null }
/** `crew` — the student's crew for the team «Конец смены»; `race` — standings of all crews (empty until crews exist). */
export interface StudentView { session: PublicSession; me: Me; crew?: CrewView | null; race?: RaceRow[] }
export type Link = 'off' | 'connecting' | 'online' | 'offline';

interface LessonState {
  mode: 'solo' | 'lesson';
  token: string | null;
  session: PublicSession | null;
  me: Me | null;
  crew: CrewView | null;
  race: RaceRow[];
  link: Link;
  joined: (token: string, view: StudentView) => void;
  setView: (view: StudentView) => void;
  setLink: (link: Link) => void;
  /** Leave the lesson (ended, token lost, or by choice): progress stays, play continues solo. */
  leave: () => void;
}

const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const useLesson = create<LessonState>()(
  persist(
    (set) => ({
      mode: 'solo', token: null, session: null, me: null, crew: null, race: [], link: 'off',
      joined: (token, view) => set({ mode: 'lesson', token, session: view.session, me: view.me, crew: view.crew ?? null, race: view.race ?? [] }),
      setView: (view) => set({ session: view.session, me: view.me, crew: view.crew ?? null, race: view.race ?? [] }),
      setLink: (link) => set({ link }),
      leave: () => set({ mode: 'solo', token: null, session: null, me: null, crew: null, race: [], link: 'off' }),
    }),
    {
      name: 'bureau-lesson', storage: createJSONStorage(() => safeStorage), version: 1,
      partialize: (s) => ({ mode: s.mode, token: s.token, session: s.session, me: s.me }),
    },
  ),
);

/** The session that gates play right now (null in solo mode). */
export const activeSession = (s: Pick<LessonState, 'mode' | 'session'>): PublicSession | null =>
  s.mode === 'lesson' ? s.session : null;
