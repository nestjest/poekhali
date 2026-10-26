import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Character, type CharacterId } from '../art/Character';
import { BOARD_RECT, Location, type LocationId } from '../art/Locations';
import { RichText } from '../components/RichText';
import type { CastMember, SceneInfo } from '../types';

export interface Rect { x: number; y: number; width: number; height: number }
const VB = { w: 1600, h: 900 };

/** Size of the stage element (re-measured on resize). */
export function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, box };
}

/** Maps a viewBox rect of a `slice`-scaled 1600×900 art to screen px; null if it doesn't fit. */
export function mapRect(r: Rect, box: { w: number; h: number }, minVisible = 0.92) {
  if (!box.w) return null;
  const s = Math.max(box.w / VB.w, box.h / VB.h);
  const ox = (box.w - VB.w * s) / 2;
  const oy = (box.h - VB.h * s) / 2;
  const left = r.x * s + ox, top = r.y * s + oy, width = r.width * s, height = r.height * s;
  const visibleW = Math.min(box.w, left + width) - Math.max(0, left);
  if (visibleW / width < minVisible) return null;
  return { left, top, width, height, scale: s };
}

const POS_X: Record<CastMember['pos'], number> = { left: 22, center: 50, right: 78 };

/** Where the speakers stand (percent of the stage width): the dialogue bubble attaches to them. */
export interface StageLayout { w: number; h: number; narrow: boolean; charSize: number; cast: { who: string; x: number }[] }
export const StageCtx = createContext<StageLayout | null>(null);

/** A lone character stands on the left (the bubble goes to the right, like in the reference); a group keeps its places. */
export function castX(cast: CastMember[], c: CastMember, narrow: boolean): number {
  if (narrow) return cast.length > 1 ? (c.pos === 'left' ? 30 : c.pos === 'right' ? 70 : 50) : 50;
  if (cast.length === 1) return 28;
  return POS_X[c.pos];
}

export function Stage({ scene, cast, board, classic, dim = false, children }: {
  scene: SceneInfo | null; cast: CastMember[]; board?: { title?: string; lines: string[] } | null;
  classic?: boolean; dim?: boolean; /** @deprecated a lone speaker now always stands left of the bubble */ shift?: boolean; children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const { ref, box } = useBox<HTMLDivElement>();
  const location = (scene?.location ?? 'reception') as LocationId;
  const boardRect = board && location === 'board' ? mapRect(BOARD_RECT, box) : null;
  const narrow = box.w < 720;
  // Waist-up figures (240×300): the width; the height is ×1.25 and the bottom of the body goes under the frame.
  const charSize = Math.min(narrow ? box.h * 0.36 : box.h * 0.6, narrow ? box.w * 0.85 : 560);
  const layout: StageLayout = { w: box.w, h: box.h, narrow, charSize, cast: cast.map((c) => ({ who: c.who, x: castX(cast, c, narrow) })) };
  const sceneKey = `${scene?.location}-${scene?.time}`;
  const fade = reduce ? {} : { initial: { opacity: 0, scale: scene?.transition === 'zoom' ? 1.06 : 1 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0 }, transition: { duration: 0.5 } };

  return (
    <StageCtx.Provider value={layout}>
    <div ref={ref} className={`stage ${classic ? 'classic' : ''} ${dim ? 'dim' : ''}`}>
      {!classic && (
        <AnimatePresence mode="wait">
          <motion.div key={sceneKey} className="stage-bg" {...fade}>
            <Location id={location} time={scene?.time ?? 'day'} />
          </motion.div>
        </AnimatePresence>
      )}
      {!classic && (
        <div className="stage-cast" aria-hidden="true">
          <AnimatePresence>
            {cast.map((c) => {
              const x = `${castX(cast, c, narrow)}%`;
              return (
                <motion.div key={c.who} className="cast-member"
                  style={{ left: x, width: charSize }}
                  initial={reduce ? false : { opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0, x: '-50%', left: x }}
                  exit={reduce ? undefined : { opacity: 0, y: 30 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24 }}>
                  <motion.div animate={reduce ? undefined : { y: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
                    <Character id={c.who as CharacterId} mood={c.mood} size={charSize} />
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
      <AnimatePresence>
        {board && (
          <motion.div key={board.title ?? 'board'} className={`board-notes ${boardRect ? 'on-board' : 'as-card'}`}
            style={boardRect ? { left: boardRect.left, top: boardRect.top, width: boardRect.width, height: boardRect.height,
              fontSize: Math.max(13, Math.min(26, boardRect.height / 11)) } : undefined}
            initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {board.title && <h2 className="board-title">{board.title}</h2>}
            <ul>
              {board.lines.map((l, i) => (
                <motion.li key={l} initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: reduce ? 0 : 0.25 + i * 0.35 }}>
                  <RichText text={l} />
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {scene?.title && (
          <motion.div key={scene.title} className="scene-title"
            initial={reduce ? false : { opacity: 0, y: -10 }} animate={{ opacity: [0, 1, 1, 0], y: 0 }}
            transition={{ duration: reduce ? 0.01 : 3, times: [0, 0.15, 0.8, 1] }}>
            {scene.title}
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
    </StageCtx.Provider>
  );
}
