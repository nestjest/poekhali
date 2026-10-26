// Content loader: the same JSON files the Python linter and judge use.
import type { CharacterInfo, CrewMission, Dialogue, Exhibit, GlossaryEntry, Lesson, Order, Quote, Skill } from './types';

const files = import.meta.glob('@content/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const pick = <T,>(suffix: string): T | undefined => {
  const key = Object.keys(files).find((k) => k.endsWith(suffix));
  return key ? (files[key] as T) : undefined;
};
const all = <T,>(dir: string): T[] =>
  Object.entries(files).filter(([k]) => k.includes(`/${dir}/`)).map(([, v]) => v as T);

export const CHARACTERS: Record<string, CharacterInfo> = pick('/characters.json') ?? {};
export const SKILLS: Skill[] = pick('/skills.json') ?? [];
export const GLOSSARY: GlossaryEntry[] = pick('/glossary.json') ?? [];
export const REPORT_PHRASES: { did: string[]; checked: string[] } = pick('/report_phrases.json') ?? { did: [], checked: [] };
export const MUSEUM: Exhibit[] = pick('/museum.json') ?? [];
export const exhibitById = (id: string): Exhibit | undefined => MUSEUM.find((e) => e.id === id);
/** «Цитата дня» at the end of each shift. */
export const QUOTES: Record<string, Quote> = Object.fromEntries((pick<Quote[]>('/quotes.json') ?? []).map((q) => [q.id, q]));
export const LESSONS: Lesson[] = all<Lesson>('lessons').sort((a, b) => a.number - b.number);
export const DIALOGUES: Record<string, Dialogue> = Object.fromEntries(all<Dialogue>('dialogues').map((d) => [d.id, d]));
/** Crew missions (team «Конец смены») by id: crew0 … crew3. */
export const CREWS: Record<string, CrewMission> = Object.fromEntries(all<CrewMission>('crews').map((m) => [m.id, m]));
const ORDER_LIST = all<Order>('orders');
const ORDER_FILE: Record<string, Order> = Object.fromEntries(
  Object.entries(files).filter(([k]) => k.includes('/orders/')).map(([k, v]) => [k.split('/').pop()!.replace('.json', ''), v as Order]),
);

/** Orders are referenced by file id (o0-1) in lessons. */
export const orderByFile = (fileId: string): Order | undefined => ORDER_FILE[fileId];
export const orderFileId = (order: Order): string =>
  Object.entries(ORDER_FILE).find(([, o]) => o === order)?.[0] ?? order.id;
export const ORDERS = ORDER_LIST;

export const lessonOrders = (lesson: Lesson): Order[] =>
  lesson.stages.flatMap((s) => s.orders ?? []).map((id) => ORDER_FILE[id]).filter(Boolean);

export const skillTitle = (id: string) => SKILLS.find((s) => s.id === id)?.title ?? id;

const termIndex = new Map<string, GlossaryEntry>();
for (const g of GLOSSARY) for (const f of [g.term, ...(g.forms ?? [])]) termIndex.set(f.toLowerCase(), g);
export const findTerm = (word: string) => termIndex.get(word.toLowerCase());

export const KIND_RU: Record<Order['kind'], string> = {
  regular: 'Задание', boss: 'Итоговое задание', bugreport: 'Замечание телеметрии', refactor: 'Доработка',
  urgent: 'Срочное', team: 'Командное', review: 'Разбор кода',
};
export const charName = (id: string) => CHARACTERS[id]?.name ?? id;
