// Player state (MVP: browser only, autosaved). In the full version rewards come from the server.
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { bktUpdate } from './lib/bkt';
import type { MuseumAnswer } from './lib/museum';

export type AvatarId = 'a1' | 'a2' | 'a3' | 'a4';

export interface Submission {
  version: string; stars: number; score: number; review: string; complaints: string[];
  at: number; hints: number; report?: { did: string[]; checked: string[]; note: string };
}
export interface OrderProgress {
  stage: 1 | 2 | 3 | 4;
  clarify: number[] | null;          // chosen questions (null = not done)
  scaffold: 1 | 2 | 3;
  code: Record<string, string>;      // per scaffold: 'parsons' | 'fill' | 'write'
  parsons: number[];
  warmupDone: boolean;
  hints: number;
  bestStars: number;
  version: number;                   // 0 → v1.0, 1 → v1.1 …
  needsRevision: boolean;
  submissions: Submission[];
  attempts?: number;                 // «Проверить» runs (for the teacher's class panel)
}
/** Crew program in solo play (no lesson): the player writes every part. */
export interface CrewProgress { parts: Record<string, string>; stars: number; hints: number; quiz?: Record<string, number> }
export interface Letter { id: string; from: string; title: string; body: string; at: number; read: boolean; link?: string }

export const UPGRADES = [
  { id: 'plant', title: 'Глобус Земли', price: 30, about: 'Крутится, если толкнуть' },
  { id: 'rug', title: 'Ковёр «Звёздная карта»', price: 25, about: 'Созвездия под ногами' },
  { id: 'poster', title: 'Плакат «Поехали!»', price: 40, about: 'Ракета в стиле ретро над столом' },
  { id: 'lamp', title: 'Лампа-луна', price: 35, about: 'Мягкий свет вечерней смены' },
  { id: 'chair', title: 'Кресло-ложемент', price: 50, about: 'Как в спускаемом аппарате, только мягче' },
  { id: 'coffee', title: 'Самовар и подстаканники', price: 60, about: '+1 бесплатная подсказка в день' },
  { id: 'taskboard', title: 'Доска заданий', price: 50, about: 'Очередь заданий на 1 длиннее' },
  { id: 'monitor2', title: 'Второй монитор телеметрии', price: 80, about: 'Как в настоящем ЦУПе' },
] as const;

export const BADGES: Record<string, { title: string; about: string }> = {
  first_run: { title: 'Первый запуск', about: 'Первая программа запущена' },
  attentive: { title: 'Точный брифинг', about: 'ТЗ уточнено без лишних вопросов' },
  bug_hunter: { title: 'Охотник за багами', about: 'Замечание телеметрии исправлено' },
  no_hints: { title: 'Без подсказок', about: 'Задание принято на 5★ без подсказок' },
  clean_code: { title: 'Чистый код', about: 'Ни одного замечания по стилю' },
  five_stars: { title: 'Пять звёзд', about: 'Первая оценка 5★' },
  revised: { title: 'Доработка', about: 'Версия 1.1 принята заказчиком' },
};

interface Settings { theme: 'auto' | 'light' | 'dark'; textScale: number; readableFont: boolean; classic: boolean; track?: 'course' | 'intro' }

interface State {
  profile: { nick: string; group: string; avatar: AvatarId } | null;
  settings: Settings;
  coins: number;
  upgrades: string[];
  badges: string[];
  skills: Record<string, number>;          // BKT p(known)
  introduced: string[];                     // skills introduced by finished content
  dialogues: Record<string, { pos: number; done: boolean; correct: number; total: number }>;
  orders: Record<string, OrderProgress>;
  crews: Record<string, CrewProgress>;      // crew missions by id (solo play; in a lesson the crew lives on the server)
  reflection: Record<string, string>;
  stagesDone: string[];                     // `${lessonId}:${stageId}`
  freeHintDay: string | null;
  letters: Letter[];
  features: string[];                       // unlocked game features (phone, notebook, shop…)
  errors: Record<string, number>;           // error / bug tags met while coding (class panel)
  launched: string[];                       // craft names that reached orbit (Карта орбит)
  museumSeen: string[];                     // exhibits already announced
  museumStudied: string[];                  // exhibits whose card the player opened («Изучить»)
  museumAnswers: Record<string, MuseumAnswer>; // client museum questions by mission file id
  quotesSeen: string[];                     // «Цитата дня» cards already shown
  where: { kind: 'title' } | { kind: 'hub' } | { kind: 'story'; dialogue: string; stage: string } | { kind: 'order'; id: string };
  // actions
  unlock: (features: string[]) => void;
  goTo: (where: State['where']) => void;
  setProfile: (p: Partial<{ nick: string; group: string; avatar: AvatarId }>) => void;
  login: (nick: string, group: string, avatar: AvatarId) => void;
  logout: () => void;
  setSettings: (s: Partial<Settings>) => void;
  recordCheck: (skills: string[], correct: boolean) => void;
  introduce: (skills: string[]) => void;
  setDialogue: (id: string, v: Partial<State['dialogues'][string]>) => void;
  order: (id: string) => OrderProgress;
  patchOrder: (id: string, patch: Partial<OrderProgress>) => void;
  patchCrew: (id: string, patch: Partial<CrewProgress>) => void;
  addCoins: (n: number) => void;
  buy: (id: string, price: number) => boolean;
  award: (badge: string) => void;
  finishStage: (key: string) => void;
  reopenStage: (key: string) => void;
  setReflection: (key: string, text: string) => void;
  useFreeHint: () => boolean;
  mail: (l: Omit<Letter, 'at' | 'read'>) => void;
  readLetter: (id: string) => void;
  noteErrors: (tags: string[]) => void;
  launch: (craft: string) => void;
  seeExhibits: (ids: string[]) => void;
  studyExhibit: (id: string) => void;
  answerMuseum: (fileId: string, answer: MuseumAnswer) => void;
  seeQuote: (id: string) => void;
  reset: () => void;
}

const safeStorage: StateStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: keep in memory */ } },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const START_COINS = 100;
const blankOrder = (scaffold: 1 | 2 | 3 = 3): OrderProgress => ({
  stage: 1, clarify: null, scaffold, code: {}, parsons: [], warmupDone: false, hints: 0,
  bestStars: 0, version: 0, needsRevision: false, submissions: [],
});
const today = () => new Date().toISOString().slice(0, 10);

const WELCOME: Letter = {
  id: 'welcome', from: 'Вика', title: 'Добро пожаловать в бюро!', at: 0, read: false,
  body: 'Привет! Я Вика, ведущий инженер бортового ПО. Начни с инструктажа у Ольги, потом планёрка — и первое задание для «Искорки».',
  link: '/day/0',
};

const initial = {
  profile: null, coins: START_COINS, upgrades: [], badges: [], skills: {}, introduced: [],
  dialogues: {}, orders: {}, crews: {} as Record<string, CrewProgress>, reflection: {}, stagesDone: [], freeHintDay: null, letters: [WELCOME],
  features: [] as string[], errors: {} as Record<string, number>, launched: [] as string[], museumSeen: [] as string[],
  museumStudied: [] as string[], museumAnswers: {} as Record<string, MuseumAnswer>, quotesSeen: [] as string[], where: { kind: 'title' } as State['where'],
};

export const useGame = create<State>()(
  persist(
    (set, get) => ({
      ...initial,
      settings: { theme: 'auto', textScale: 1, readableFont: false, classic: false },
      login: (nick, group, avatar) => set({ profile: { nick, group, avatar } }),
      unlock: (f) => set((st) => ({ features: [...new Set([...st.features, ...f])] })),
      goTo: (where) => set({ where }),
      setProfile: (p) => set((st) => ({ profile: { nick: 'Новичок', group: '', avatar: 'a1', ...st.profile, ...p } })),
      logout: () => set({ profile: null }),
      setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
      recordCheck: (skills, correct) => set((st) => {
        const next = { ...st.skills };
        for (const s of skills) next[s] = bktUpdate(next[s], correct);
        return { skills: next };
      }),
      introduce: (skills) => set((st) => ({ introduced: [...new Set([...st.introduced, ...skills])] })),
      setDialogue: (id, v) => set((st) => ({
        dialogues: { ...st.dialogues, [id]: { ...{ pos: 0, done: false, correct: 0, total: 0 }, ...st.dialogues[id], ...v } },
      })),
      order: (id) => get().orders[id] ?? blankOrder(),
      patchOrder: (id, patch) => set((st) => ({
        orders: { ...st.orders, [id]: { ...(st.orders[id] ?? blankOrder()), ...patch } },
      })),
      patchCrew: (id, patch) => set((st) => ({
        crews: { ...st.crews, [id]: { ...(st.crews?.[id] ?? { parts: {}, stars: 0, hints: 0 }), ...patch } },
      })),
      addCoins: (n) => set((st) => ({ coins: st.coins + n })),
      buy: (id, price) => {
        const st = get();
        if (st.coins < price || st.upgrades.includes(id)) return false;
        set({ coins: st.coins - price, upgrades: [...st.upgrades, id] });
        return true;
      },
      award: (badge) => {
        if (get().badges.includes(badge)) return;
        set((st) => ({ badges: [...st.badges, badge] }));
        get().mail({ id: `badge-${badge}`, from: 'Вика', title: `Значок «${BADGES[badge]?.title}»`,
          body: BADGES[badge]?.about ?? '', link: '/board' });
      },
      finishStage: (key) => set((st) => ({ stagesDone: [...new Set([...st.stagesDone, key])] })),
      reopenStage: (key) => set((st) => ({ stagesDone: st.stagesDone.filter((k) => k !== key) })),
      setReflection: (key, text) => set((st) => ({ reflection: { ...st.reflection, [key]: text } })),
      useFreeHint: () => {
        const st = get();
        if (!st.upgrades.includes('coffee') || st.freeHintDay === today()) return false;
        set({ freeHintDay: today() });
        return true;
      },
      mail: (l) => set((st) => (st.letters.some((x) => x.id === l.id) ? {} :
        { letters: [{ ...l, at: Date.now(), read: false }, ...st.letters] })),
      readLetter: (id) => set((st) => ({ letters: st.letters.map((l) => (l.id === id ? { ...l, read: true } : l)) })),
      noteErrors: (tags) => set((st) => {
        const next = { ...st.errors };
        for (const t of tags) if (t) next[t] = (next[t] ?? 0) + 1;
        return { errors: next };
      }),
      launch: (craft) => set((st) => (st.launched.includes(craft) ? {} : { launched: [...st.launched, craft] })),
      seeExhibits: (ids) => set((st) => ({ museumSeen: [...new Set([...st.museumSeen, ...ids])] })),
      studyExhibit: (id) => set((st) => (st.museumStudied.includes(id) ? {} : { museumStudied: [...st.museumStudied, id] })),
      answerMuseum: (fileId, answer) => set((st) => (st.museumAnswers[fileId] ? {} : { museumAnswers: { ...st.museumAnswers, [fileId]: answer } })),
      seeQuote: (id) => set((st) => (st.quotesSeen.includes(id) ? {} : { quotesSeen: [...st.quotesSeen, id] })),
      reset: () => set({ ...initial }),
    }),
    { name: 'bureau-kosmos', storage: createJSONStorage(() => safeStorage), version: 2, migrate: () => ({}) as State },
  ),
);

/** Reputation 0–100: average of best stars of submitted orders ×20 (moving average over the last 10). */
export function reputation(orders: Record<string, OrderProgress>): number {
  const subs = Object.values(orders).flatMap((o) => o.submissions).sort((a, b) => a.at - b.at).slice(-10);
  if (!subs.length) return 0;
  return Math.round((subs.reduce((n, s) => n + s.stars, 0) / subs.length) * 20);
}

export const versionLabel = (v: number) => `v1.${v}`;
