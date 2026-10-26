// Content (JSON in /content) and judge result shapes.

export type Mood = 'neutral' | 'joy' | 'puzzled' | 'annoyed' | 'thinking';
export type Code = string | string[];

export const codeText = (c: Code | undefined): string =>
  c === undefined ? '' : Array.isArray(c) ? c.join('\n') + '\n' : c;

// ------------------------------------------------------------------ content
export interface CharacterInfo { name: string; role: 'staff' | 'client'; business?: string; voice?: string; about?: string }
export interface ExhibitQuiz { question: string; options: string[]; answer: number }
export interface Exhibit {
  id: string; title: string; year?: number; text: string; fact: string; art?: string;
  unlock: 'start' | { stage?: string; order?: string; lesson?: number };
  quiz?: ExhibitQuiz[];
}
/** A museum question: exhibit id + the index of its quiz question. */
export interface MuseumRef { exhibit: string; question: number }
/** «Цитата дня» at the end of the shift (content/quotes.json, docs/space-facts.md quote_*). */
export interface Quote { id: string; name: string; years: string; role: string; about: string; quote: string; context: string; fact: string; source: string }
export interface Skill { id: string; title: string; lesson: number; requires: string[] }
export interface GlossaryEntry { term: string; forms?: string[]; simple: string; example?: string; lesson: number }

interface CheckBase {
  prompt: string;
  requires?: string[];
  introduces?: string[];
  hint: string;
  explain: string;
  feedback_correct: string;
  feedback_wrong: string;
}
export type Check = CheckBase & (
  | { kind: 'single'; options: string[]; answer: number }
  | { kind: 'multi'; options: string[]; answer: number[] }
  | { kind: 'predict'; code: Code; stdin?: string[] }
  | { kind: 'order'; lines: string[] }
  | { kind: 'fill'; code: Code; chips: string[]; answer: number[] }
  | { kind: 'find_bug'; code: string[]; answer: number }
  | { kind: 'tiny_code'; starter: Code; reference: Code; expected_stdout: string[]; stdin?: string[] }
  | { kind: 'match'; pairs: [string, string][] }
);
export type CheckKind = Check['kind'];

export type Pos = 'left' | 'center' | 'right';
export interface CastMember { who: string; pos: Pos; mood: Mood }
export interface SceneInfo { location: string; time: 'morning' | 'day' | 'evening'; transition: 'fade' | 'zoom' | 'slide'; title?: string }

export type DialogueNode =
  | { id: string; type: 'say'; who: string; mood?: Mood; text: string; next?: string }
  | { id: string; type: 'narrate'; text: string; next?: string }
  | { id: string; type: 'check'; check: Check; next?: string }
  | { id: string; type: 'choice'; prompt?: string; options: { text: string; next?: string }[] }
  | { id: string; type: 'scene'; location: string; time?: SceneInfo['time']; transition?: SceneInfo['transition']; title?: string; cast?: { who: string; pos?: Pos; mood?: Mood }[]; next?: string }
  | { id: string; type: 'enter'; who: string; pos?: Pos; mood?: Mood; next?: string }
  | { id: string; type: 'exit'; who: string; next?: string }
  | { id: string; type: 'board'; title?: string; lines: string[]; next?: string }
  | { id: string; type: 'input'; field: 'nick' | 'group'; prompt: string; next?: string }
  | { id: string; type: 'avatar'; prompt: string; next?: string }
  | { id: string; type: 'unlock'; feature: string; text?: string; next?: string }
  | { id: string; type: 'launch'; craft: string; text?: string; next?: string }
  | { id: string; type: 'crew'; mission: string; next?: string }
  | { id: string; type: 'quote'; quote: string; next?: string }
  | { id: string; type: 'jump'; next: string }
  | { id: string; type: 'flag'; set: string; next?: string }
  | { id: string; type: 'end' };

export interface Dialogue { id: string; lesson: number; diagnostic?: boolean; nodes: DialogueNode[] }

export interface TeacherNotes { say?: string; ask?: string[]; mistakes?: string[]; stuck?: string }
export interface Stage {
  id: 'diagnostic' | 'briefing' | 'orders' | 'review' | 'closing' | string;
  title: string;
  dialogue?: string;
  orders?: string[];
  teacher?: TeacherNotes;
  minutes?: number;
  hotspot?: string;
  auto?: boolean;
  unlocks?: string[];
}
export interface NotebookCard { id: string; title: string; syntax: string; example: string; mistake: string; skills?: string[] }
export interface Lesson {
  id: string; number: number; title: string; client_id: string; goal: string; result: string;
  competencies: string[]; program_lines: string[];
  results: { know: string; can: string; own: string };
  timing: [string, number][];
  allowed_constructs: string[];
  stages: Stage[];
  teacher?: TeacherNotes;
  notebook: NotebookCard[];
  reflection: string[];
  homework?: string;
}

export interface Case {
  id: string; stdin?: string[]; expected_stdout: string[]; hidden?: boolean; weight?: number;
  requirement_id: string; approve?: string; complaint?: string; tolerance?: number;
}
export interface ClarifyOption { text: string; relevant: boolean; reply: string; adds_requirement?: string }
export interface Order {
  id: string; lesson: number; order_no: number;
  kind: 'regular' | 'boss' | 'bugreport' | 'refactor' | 'urgent' | 'team' | 'review';
  client_id: string; title: string; pitch: string[];
  clarify?: { prompt: string; options: ClarifyOption[]; required?: number };
  requirements: { id: string; text: string }[];
  statement_md?: string;
  scaffold_level: 1 | 2 | 3;
  parsons_lines?: { code: string; distractor?: boolean }[];
  fill_code?: Code;
  starter_code?: Code;
  warmup?: Check;
  cases: Case[];
  ast_rules?: unknown;
  hints: string[];
  requires: string[]; introduces: string[];
  reference_solution?: Code;
  difficulty?: number;
  lines?: { accept?: string; good?: string; revision?: string };
  /** The client's museum question after acceptance (extra premium). */
  museum?: MuseumRef & { ask: string };
}

/** Team «Конец смены»: one program assembled from the parts of the crew members (content/crews). */
export interface CrewPart { id: string; role: string; title: string; task: string; gives?: string[]; uses?: string[]; template: Code; reference: Code }
export interface CrewMission {
  id: string; lesson: number; title: string; craft: string; client_id: string; brief: string[]; parts: CrewPart[];
  requirements: { id: string; text: string }[]; cases: Case[]; hints: string[]; requires?: string[];
  /** Museum quiz of the crew: one answer per question for the whole crew. */
  quiz?: MuseumRef[];
}

// -------------------------------------------------------------------- judge
export interface Explain { title: string; where: string; check: string; tag: string }
export interface RunError { type: string; message: string; line: number | null; col: number | null; explain: Explain }
export interface RunCodeResult { stdout: string; error: RunError | null; prompts: string[]; steps: number }
export interface CaseResult {
  id: string; hidden: boolean; passed: boolean; weight: number; requirement_id: string;
  reply: string | null; error: RunError | null;
  stdin?: string[]; expected?: string[]; actual?: string[];
  diff?: { line: number; expected: string | null; actual: string | null } | null;
}
export type BuildEvent =
  | { type: 'build_start'; total: number }
  | { type: 'compile_fail'; error: RunError }
  | { type: 'case_start'; id: string }
  | { type: 'case_pass' | 'case_fail'; id: string; requirement_id: string; reply: string | null; hidden: boolean }
  | { type: 'build_end'; summary: Summary };
export interface Summary {
  passed: number; total: number; hidden_failed: number; score: number; stars: number; accepted: boolean;
  parts: { visible: number; hidden: number; style: number; independence: number; accuracy: number };
}
export interface OrderResult {
  order_id: string; cases: CaseResult[];
  requirements: { id: string; text: string; ok: boolean | null; checked: boolean }[];
  error: RunError | null;
  ast_report: { rule: string; ok: boolean; text: string }[];
  style_report: { code: string; line: number; text: string }[];
  bugs: { tag: string; line: number; text: string }[];
  events: BuildEvent[]; summary: Summary; needs_revision: boolean;
}
/** run_crew: the order result + line ranges of the parts and whose part failed. */
export interface CrewResult extends OrderResult { parts: { id: string; first: number; last: number }[]; error_part: string | null }
export interface TraceStep { line: number | null; vars: { name: string; type: string; value: string; changed: boolean }[]; stdout: string }
export interface TraceResult { steps: TraceStep[]; error: RunError | null; truncated: boolean }
