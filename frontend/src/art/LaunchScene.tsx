import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LAUNCH_ROCKET, LaunchBackdrop } from './Locations';
import { Flame, Rocket, Satellite, Spark } from './shapes';
import { INK_BG, Part, v } from './v2/shade';
import { mix, rrect } from './v2/scene';
import './art.css';

/** Timeline (ms) of the full cutscene; the reduced version uses three still frames. */
const T = { n2: 900, n1: 1800, go: 2700, hideGo: 3900, caption: 5000, done: 6400 };
const TR = { frame1: 900, frame2: 1700, done: 2600 };

const SIGN = mix('c-navy', 'c-ink', 62);

const bigText: CSSProperties = {
  fontFamily: 'var(--font-ui)', fontWeight: 800, color: 'var(--c-cream)', letterSpacing: '0.04em', lineHeight: 1.1,
  fontSize: 'calc(var(--fs-h1) * 3.6)', textAlign: 'center',
  textShadow: '0 3px 0 var(--c-ink), 2px 0 0 var(--c-ink), -2px 0 0 var(--c-ink), 0 -2px 0 var(--c-ink), 2px 2px 0 var(--c-ink), -2px 2px 0 var(--c-ink)',
};
const captionStyle: CSSProperties = {
  ...bigText, fontSize: 'var(--fs-h1)', letterSpacing: '0.02em', padding: 'var(--s2) var(--s4)',
  background: SIGN, border: '2px solid var(--c-ink)', borderRadius: 'var(--r-pill)', textShadow: 'none',
  maxWidth: 'calc(100% - 2 * var(--s3))', boxSizing: 'border-box',
};

const SMOKE: { x: number; y: number; r: number; d: number }[] = [
  { x: -30, y: 0, r: 70, d: 0 }, { x: 30, y: 6, r: 80, d: 0.05 }, { x: -150, y: 14, r: 76, d: 0.1 }, { x: 150, y: 14, r: 84, d: 0.15 },
  { x: -280, y: 26, r: 70, d: 0.25 }, { x: 280, y: 26, r: 76, d: 0.3 }, { x: -400, y: 38, r: 56, d: 0.4 }, { x: 410, y: 38, r: 60, d: 0.45 },
];
const STARS: [number, number, number][] = [
  [120, 80, 9], [340, 200, 7], [560, 60, 8], [980, 90, 9], [1240, 210, 7], [1460, 70, 8], [220, 340, 6], [1380, 360, 6], [700, 180, 6], [1100, 40, 7],
];

/** Full-screen launch cutscene: countdown, ignition, liftoff, darkening sky, separation, caption. */
export function LaunchScene({ craft, onDone, reduced }: { craft: string; onDone: () => void; reduced?: boolean }) {
  const doneRef = useRef(onDone);
  const finished = useRef(false);
  const [step, setStep] = useState(0);

  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      doneRef.current();
    };
    const ids: number[] = [];
    const at = (ms: number, fn: () => void) => { ids.push(window.setTimeout(fn, ms)); };
    if (reduced) {
      at(TR.frame1, () => setStep(1));
      at(TR.frame2, () => setStep(2));
      at(TR.done, finish);
    } else {
      at(T.n2, () => setStep(1));
      at(T.n1, () => setStep(2));
      at(T.go, () => setStep(3));
      at(T.hideGo, () => setStep(4));
      at(T.caption, () => setStep(5));
      at(T.done, finish);
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('keydown', onKey);
    };
  }, [reduced]);

  const skip = () => {
    if (finished.current) return;
    finished.current = true;
    doneRef.current();
  };

  const R = LAUNCH_ROCKET;
  const label = reduced
    ? (step === 0 ? 'Пуск!' : '')
    : (['3', '2', '1', 'Пуск!', ''][step] ?? '');
  const showCaption = reduced ? step === 2 : step === 5;
  const night = reduced ? step >= 1 : false;

  return (
    <div
      role="dialog" aria-modal="true" aria-label={`Запуск аппарата «${craft}»`}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--c-sky-night)', overflow: 'hidden' }}
    >
      <svg
        viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"
        aria-hidden="true" focusable="false" style={{ display: 'block' }}
      >
        <LaunchBackdrop time="evening" withRocket={false} />

        {/* the sky darkens while the vehicle climbs */}
        <motion.rect
          x={0} y={0} width={1600} height={900} fill={v('c-sky-night')} initial={{ opacity: 0 }}
          animate={reduced ? { opacity: night ? 0.82 : 0 } : { opacity: 0.84 }}
          transition={reduced ? { duration: 0.25 } : { delay: 3.4, duration: 1.8, ease: 'easeInOut' }}
        />
        <motion.g
          initial={{ opacity: 0 }} animate={reduced ? { opacity: night ? 1 : 0 } : { opacity: 1 }}
          transition={reduced ? { duration: 0.25 } : { delay: 4.0, duration: 1.4 }}
        >
          {STARS.map(([x, y, r]) => <Spark key={`${x}${y}`} x={x} y={y} r={r * 1.6} />)}
        </motion.g>

        {/* smoke clouds at the pad */}
        {!reduced && SMOKE.map((p, i) => (
          <motion.circle
            key={i} cx={R.x + p.x} cy={R.y + p.y} r={p.r} fill={v('c-cream')} stroke={INK_BG} strokeWidth={2}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1, 1.35], opacity: [0, 0.92, 0] }}
            transition={{ delay: 2.7 + p.d, duration: 2.6, times: [0, 0.35, 1], ease: 'easeOut' }}
          />
        ))}
        {reduced && (
          <motion.g initial={{ opacity: 1 }} animate={{ opacity: night ? 0 : 1 }} transition={{ duration: 0.25 }}>
            {SMOKE.slice(0, 6).map((p, i) => (
              <circle key={i} cx={R.x + p.x} cy={R.y + p.y} r={p.r * 0.8} fill={v('c-cream')} stroke={INK_BG} strokeWidth={2} opacity={0.9} />
            ))}
          </motion.g>
        )}

        {/* launch vehicle */}
        <motion.g
          initial={{ y: 0, x: 0, opacity: 1 }}
          animate={reduced
            ? { opacity: night ? 0 : 1 }
            : { y: [0, 0, -1400], x: [0, 0, 0], opacity: 1 }}
          transition={reduced
            ? { duration: 0.25 }
            : { delay: 2.7, duration: 2.5, times: [0, 0.2, 1], ease: [0.5, 0, 0.9, 0.5] }}
        >
          <g transform={`translate(${R.x} ${R.y}) scale(${R.s})`}>
            <Rocket sw={1.5} />
            {!reduced && (
              <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.7, duration: 0.2 }}>
                <Flame />
              </motion.g>
            )}
            {reduced && !night && <Flame />}
          </g>
        </motion.g>

        {/* spent stage falls away, the spacecraft separates and drifts off */}
        {!reduced && (
          <motion.g
            initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x: [0, -60, -150, -230], y: [0, 40, 180, 420], rotate: [0, -10, -35, -70] }}
            transition={{ delay: 4.3, duration: 1.4, times: [0, 0.1, 0.7, 1], ease: 'easeIn' }}
          >
            <g transform="translate(790 330)">
              <Part d={rrect(-22, -60, 44, 96, 10)} fill={v('c-cream')} shade={[8, 6]}>
                <rect x={-24} y={-20} width={48} height={22} fill={v('c-navy')} />
              </Part>
              <Part d="M-14 36 H14 L18 54 H-18 Z" fill={v('c-steel')} shade={[4, 3]} />
            </g>
          </motion.g>
        )}
        <motion.g
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
          animate={reduced
            ? { opacity: night ? 1 : 0, scale: 1.6, x: 200, y: -40 }
            : { opacity: [0, 1, 1], scale: [0.4, 1.2, 1.7], x: [0, 90, 260], y: [0, -20, -70] }}
          transition={reduced
            ? { duration: 0.25 }
            : { delay: 4.4, duration: 1.9, times: [0, 0.25, 1], ease: 'easeOut' }}
        >
          <g transform="translate(800 340)">
            <circle r={60} fill={v('c-star')} opacity={0.2} />
            <Satellite s={1.1} />
          </g>
        </motion.g>
      </svg>

      {/* texts are HTML over the picture */}
      <div
        aria-live="polite"
        style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none',
          padding: 'var(--s3)', boxSizing: 'border-box',
        }}
      >
        <AnimatePresence mode="wait">
          {label && (
            <motion.div
              key={label} style={bigText}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.5 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: reduced ? 0.2 : 0.22, ease: 'easeOut' }}
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 'calc(var(--s6) + var(--s3))', display: 'flex', justifyContent: 'center',
          padding: '0 var(--s3)', pointerEvents: 'none',
        }}
      >
        <AnimatePresence>
          {showCaption && (
            <motion.div
              key="cap" style={captionStyle}
              initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {`«${craft}» на орбите`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button
        type="button" onClick={skip}
        style={{
          position: 'absolute', right: 'var(--s3)', bottom: 'var(--s3)', minHeight: 'var(--tap)', minWidth: 'var(--tap)',
          padding: '0 var(--s3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface)', color: 'var(--text)', border: '2px solid var(--line)', borderRadius: 'var(--r-pill)',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-small)', cursor: 'pointer',
        }}
      >
        Пропустить
      </button>
    </div>
  );
}
