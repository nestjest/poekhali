import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, AVATAR_IDS } from '../art/Avatar';
import { LaunchScene } from '../art/LaunchScene';
import { charName, CREWS, QUOTES } from '../content';
import { CheckView, type CheckResult } from '../dialogue/checks/CheckView';
import { advance, back, current, resume, start, type DialogueState } from '../dialogue/engine';
import { activeSession, useLesson } from '../lesson/lessonStore';
import { useGame, type AvatarId } from '../store';
import type { Dialogue } from '../types';
import { CrewMission } from './CrewMission';
import { QuoteCard } from './MuseumQuiz';
import { DialogueBox } from './DialogueBox';
import { Stage } from './Stage';
import { useToasts } from './Toasts';

export const FEATURE_RU: Record<string, string> = {
  phone: 'Рабочий телефон', notebook: 'Тетрадь инженера', vika_chat: 'Чат с Викой', mail: 'Пневмопочта', reviews: 'Журнал миссий',
  shop: 'Склад оснащения', skills: 'Навыки', settings: 'Настройки', studio: 'Зал бюро', desk: 'Рабочее место', orders: 'Окно заданий',
  board: 'Класс подготовки', door: 'Выход', coins: 'Премия', museum: 'Музей бюро', orbit: 'Карта орбит', crew: 'Экипаж',
};

/** Runs one script (dialogue) as a visual-novel scene. */
export function StoryPlayer({ dialogue, onFinish }: { dialogue: Dialogue; onFinish: () => void }) {
  const g = useGame();
  const saved = g.dialogues[dialogue.id];
  const toast = useToasts((t) => t.push);
  const [s, setS] = useState<DialogueState>(() =>
    saved && !saved.done && saved.pos > 0 && saved.pos < dialogue.nodes.length ? resume(dialogue, saved.pos) : start(dialogue));
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const node = current(dialogue, s);
  const classic = g.settings.classic;

  // Persist position; announce and store unlocked features.
  useEffect(() => {
    g.setDialogue(dialogue.id, { pos: s.index, done: s.done, ...stats });
    const fresh = s.unlocked.filter((f) => !g.features.includes(f));
    if (fresh.length) {
      g.unlock(fresh);
      fresh.forEach((f) => {
        const n = dialogue.nodes.find((x) => x.type === 'unlock' && x.feature === f);
        toast(`Новое: ${FEATURE_RU[f] ?? f}`, n && n.type === 'unlock' ? n.text : undefined);
      });
    }
    if (s.done) onFinish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.index, s.done, s.unlocked.length]);

  const go = (opts?: Parameters<typeof advance>[2]) => setS((x) => advance(dialogue, x, opts));
  const session = useLesson((l) => activeSession(l));
  const reduceMotion = useReducedMotion();

  // In a lesson the pseudonym and group come from the join form: the pass fields are filled in for the player.
  useEffect(() => {
    if (!session || node?.type !== 'input') return;
    if (node.field === 'group') g.setProfile({ group: session.group || session.code });
    if (node.field === 'nick' && !g.profile?.nick) return;
    go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, session?.id]);
  const canBack = s.history.some((h) => ['say', 'narrate'].includes(dialogue.nodes[h.index]?.type));
  // A crew mission or a quote that is not in the content (old save, demo lesson) must not block the scene.
  useEffect(() => {
    if ((node?.type === 'crew' && !CREWS[node.mission]) || (node?.type === 'quote' && !QUOTES[node.quote])) go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const onCheck = (r: CheckResult) => {
    if (node?.type !== 'check') return;
    if (!dialogue.diagnostic) {
      g.recordCheck([...(node.check.requires ?? []), ...(node.check.introduces ?? [])], r.correct);
      g.introduce(node.check.introduces ?? []);
    }
    setStats((x) => ({ correct: x.correct + (r.correct ? 1 : 0), total: x.total + (r.skipped ? 0 : 1) }));
    go({ defer: r.skipped });
  };

  // Escape hatch: «Назад» on the last line.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && canBack && !(e.target as HTMLElement).closest('input, textarea, .cm-editor')) setS((x) => back(dialogue, x));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!node) return <Stage scene={s.scene} cast={s.cast} board={s.board} classic={classic} />;
  const nick = g.profile?.nick ?? 'Я';
  // The text box: current line; for a choice — its prompt, or the last line stays on screen (no retyping).
  let line: { key: string; who?: string; player?: boolean; narrate?: boolean; text: string } | null = null;
  if (node.type === 'say' || node.type === 'narrate') {
    line = { key: `${node.id}-${s.history.length}`, text: node.text, narrate: node.type === 'narrate',
      player: node.type === 'say' && node.who === 'player', who: node.type === 'say' ? (node.who === 'player' ? nick : charName(node.who)) : undefined };
  } else if (node.type === 'choice') {
    const prev = [...s.history].reverse().find((h) => ['say', 'narrate'].includes(dialogue.nodes[h.index]?.type));
    const pn = prev ? dialogue.nodes[prev.index] : undefined;
    if (node.prompt || !pn || (pn.type !== 'say' && pn.type !== 'narrate')) line = { key: node.id, who: nick, player: true, text: node.prompt ?? '…' };
    else line = { key: `${pn.id}-${s.history.indexOf(prev!)}`, text: pn.text, narrate: pn.type === 'narrate',
      player: pn.type === 'say' && pn.who === 'player', who: pn.type === 'say' ? (pn.who === 'player' ? nick : charName(pn.who)) : undefined };
  }

  return (
    <Stage scene={s.scene} cast={s.cast} board={s.board} classic={classic} dim={['check', 'input', 'avatar', 'crew', 'quote'].includes(node.type)} shift={node.type === 'choice'}>
      {s.retrying && <div className="stage-chip">Возвращаемся к отложенному вопросу</div>}
      {line && (
        <DialogueBox key={line.key} who={line.who} player={line.player} narrate={line.narrate} text={line.text}
          choicesAt={s.cast.length > 1 ? 'center' : 'end'}
          onNext={node.type === 'choice' ? undefined : () => go()}
          choices={node.type === 'choice' ? node.options.map((o, i) => ({ text: o.text, onPick: () => go({ choice: i }) })) : undefined}
          extra={canBack && node.type !== 'choice' ? <button className="dlg-back" onClick={(e) => { e.stopPropagation(); setS((x) => back(dialogue, x)); }} aria-label="Назад">↶</button> : undefined} />
      )}
      {node.type === 'check' && (
        <InWorldPanel key={node.id + String(s.retrying)} label="Вопрос">
          <CheckView check={node.check} onDone={onCheck} classic={classic} />
        </InWorldPanel>
      )}
      {node.type === 'crew' && CREWS[node.mission] && <CrewMission key={node.id} mission={CREWS[node.mission]} onDone={() => go()} />}
      {node.type === 'quote' && QUOTES[node.quote] && (
        <InWorldPanel key={node.id} label="Цитата дня">
          <QuoteCard quote={QUOTES[node.quote]} onDone={() => { g.seeQuote(node.quote); go(); }} />
        </InWorldPanel>
      )}
      {node.type === 'input' && <PassInput key={node.id} field={node.field} prompt={node.prompt} onDone={() => go()} />}
      {node.type === 'avatar' && <PassAvatar key={node.id} prompt={node.prompt} onDone={() => go()} />}
      {node.type === 'launch' && (
        <div className="launch-layer">
          <LaunchScene key={node.id} craft={node.craft} reduced={!!reduceMotion || classic} onDone={() => { g.launch(node.craft); go(); }} />
          <button className="btn ghost launch-skip" onClick={() => { g.launch(node.craft); go(); }}>Пропустить</button>
        </div>
      )}
    </Stage>
  );
}

export function InWorldPanel({ label, children }: { label: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section className="world-panel" aria-label={label}
      initial={reduce ? false : { opacity: 0, y: 30, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
      {children}
    </motion.section>
  );
}

function PassInput({ field, prompt, onDone }: { field: 'nick' | 'group'; prompt: string; onDone: () => void }) {
  const { profile, setProfile } = useGame();
  const [v, setV] = useState(field === 'nick' ? (profile?.nick && profile.nick !== 'Новичок' ? profile.nick : '') : profile?.group ?? '');
  const ok = field === 'group' || v.trim().length >= 2;
  const save = () => { if (!ok) return; setProfile(field === 'nick' ? { nick: v.trim() } : { group: v.trim() }); onDone(); };
  return (
    <InWorldPanel label="Пропуск">
      <form className="pass" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="pass-head">ПРОПУСК · Бюро «Космос»</div>
        <label className="stack-sm">
          <span>{prompt}</span>
          <input className="pass-input" value={v} onChange={(e) => setV(e.target.value)} maxLength={field === 'nick' ? 24 : 16}
            autoFocus autoComplete="off" placeholder={field === 'nick' ? 'Псевдоним, не настоящее имя' : 'Можно оставить пустым'} />
        </label>
        <button className="btn primary" type="submit" disabled={!ok}>{field === 'group' && !v.trim() ? 'Пропустить' : 'Готово'}</button>
      </form>
    </InWorldPanel>
  );
}

function PassAvatar({ prompt, onDone }: { prompt: string; onDone: () => void }) {
  const { profile, setProfile } = useGame();
  const [a, setA] = useState<AvatarId>(profile?.avatar ?? 'a1');
  const ids = useMemo(() => AVATAR_IDS as AvatarId[], []);
  return (
    <InWorldPanel label="Фото для пропуска">
      <div className="pass">
        <div className="pass-head">ПРОПУСК · фото</div>
        <p>{prompt}</p>
        <div className="row" role="radiogroup" aria-label="Фото">
          {ids.map((id) => (
            <button key={id} className="btn avatar-pick" role="radio" aria-checked={a === id} aria-pressed={a === id} onClick={() => setA(id)}>
              <Avatar id={id} size={64} />
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => { setProfile({ avatar: a }); onDone(); }}>Это я</button>
      </div>
    </InWorldPanel>
  );
}
