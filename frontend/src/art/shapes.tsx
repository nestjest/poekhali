import type { ReactNode } from 'react';
import { INK_BG, Line, Part, SoftShadow, v } from './v2/shade';
import { blob, circ, mix, oval, rrect, smooth, sparkPath } from './v2/scene';
import './art.css';

/** Shared drawing kit for the art of the course «Поехали!», style v2 (docs/world.md §9): pastel tokens --c-*, cel-shading, thin warm outlines. */
export const INK = v('c-ink');
/** Thin warm outline for the few bare strokes left. */
export const S = { stroke: INK, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
export { v };

/** Five-point star path centred on (0,0), outer radius r. */
export function starPath(r: number, inner = 0.5): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * inner : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(Math.cos(a) * rad).toFixed(1)} ${(Math.sin(a) * rad).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

export function Star({ x, y, r = 10, fill = v('c-mustard'), sw = 1.6, soft = false }: { x: number; y: number; r?: number; fill?: string; sw?: number; soft?: boolean }) {
  return (
    <Part
      d={starPath(r)} transform={`translate(${x} ${y})`} fill={fill} shade={[r * 0.3, r * 0.26]} light={[r * 0.1, r * 0.1]}
      stroke={sw} ink={soft ? INK_BG : INK}
    />
  );
}

/** Four-point twinkle («искра») without outline. */
export function Spark({ x, y, r = 8, op = 1 }: { x: number; y: number; r?: number; op?: number }) {
  return <path transform={`translate(${x} ${y})`} d={sparkPath(r)} fill={v('c-star')} opacity={op} />;
}

/** Soft cloud (slowly drifts via .art-cloud). */
export function Cloud({ x, y, s = 1, delay = 0, op = 0.92 }: { x: number; y: number; s?: number; delay?: number; op?: number }) {
  const d = 'M-30 16 Q-56 16 -54 -2 Q-52 -18 -32 -16 Q-30 -40 -2 -38 Q16 -58 44 -40 Q72 -44 78 -16 Q104 -14 102 4 Q100 16 84 16 Z';
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={op}>
      <g className="art-cloud" style={{ animationDelay: `${-delay}s` }}>
        <Part d={d} fill={mix('c-cream', 'c-sky', 80)} shade={[8, 8]} light={[3, 3]} stroke={1.8 / Math.max(s, 0.5)} ink={INK_BG}>
          <path d="M-20 -2 Q10 -22 40 -8" fill="none" stroke={v('c-cream')} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
        </Part>
      </g>
    </g>
  );
}

/** Exhaust flame under a rocket whose nozzle bottom is at y=0 (flickers via .art-flame). */
export function Flame() {
  return (
    <g className="art-flame">
      <path d="M-30 -4 Q-36 40 -30 86 Q-22 40 -20 -4 Z M30 -4 Q36 40 30 86 Q22 40 20 -4 Z M-9 -4 Q-16 58 0 120 Q16 58 9 -4 Z" fill={v('c-orange')} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M-7 -2 Q-8 24 0 62 Q8 24 7 -2 Z" fill={v('c-mustard')} />
    </g>
  );
}

/**
 * Generic launch vehicle (not any real rocket): core + two side boosters, nose fairing, nozzles.
 * Local coordinates: nozzle bottom at y=0, tip at y=-320, centred on x=0. Draw with translate/scale.
 * `sw` is the outline width in local units; `soft` uses the muted background outline.
 */
export function Rocket({ flame = false, sw = 2, soft = false }: { flame?: boolean; sw?: number; soft?: boolean }) {
  const ink = soft ? INK_BG : INK;
  const p = { stroke: sw, ink } as const;
  return (
    <g>
      {flame && <Flame />}
      <Part d="M-14 -34 H14 L18 0 H-18 Z" fill={v('c-steel')} shade={[6, 4]} {...p} />
      <Part d="M-48 -34 H-28 L-26 -6 H-50 Z" fill={v('c-steel')} shade={[4, 3]} {...p} />
      <Part d="M48 -34 H28 L26 -6 H50 Z" fill={v('c-steel')} shade={[4, 3]} {...p} />
      <Part d="M-56 -36 V-180 Q-56 -214 -38 -226 Q-20 -214 -20 -180 V-36 Z" fill={v('c-metal')} shade={[8, 6]} {...p}>
        <path d="M-60 -150 H-16 V-126 H-60 Z" fill={v('c-red')} />
      </Part>
      <Part d="M56 -36 V-180 Q56 -214 38 -226 Q20 -214 20 -180 V-36 Z" fill={v('c-metal')} shade={[8, 6]} {...p}>
        <path d="M60 -150 H16 V-126 H60 Z" fill={v('c-red')} />
      </Part>
      <Part d="M-24 -36 V-250 Q-24 -290 0 -322 Q24 -290 24 -250 V-36 Z" fill={v('c-cream')} shade={[10, 8]} light={[3, 4]} {...p}>
        <path d="M-30 -250 Q-30 -296 0 -330 Q30 -296 30 -250 Z" fill={v('c-red')} />
        <path d="M-30 -210 H30 V-186 H-30 Z" fill={v('c-navy')} />
        <path d="M-30 -104 H30" stroke={ink} strokeWidth={sw * 0.8} opacity={0.35} />
        <circle cx={0} cy={-150} r={9} fill={v('c-window')} stroke={ink} strokeWidth={sw * 0.9} />
        <path transform="translate(0 -198)" d={starPath(7)} fill={v('c-mustard')} />
      </Part>
    </g>
  );
}

/** Small satellite: body with two solar-panel wings and an antenna. Centred on (0,0), ~96 units wide. */
export function Satellite({ s = 1, cube = false, soft = false }: { s?: number; cube?: boolean; soft?: boolean }) {
  const ink = soft ? INK_BG : INK;
  return (
    <g transform={`scale(${s})`}>
      {!cube && (
        <>
          <Line d="M-14 0 H-24 M14 0 H24" width={3.4} color={ink} />
          {[-1, 1].map((k) => (
            <Part key={k} d={rrect(0, -16, 52, 32, 3)} transform={`translate(${k * 24} 0) scale(${k} 1)`} fill={v('c-navy')} shade={[6, 5]} stroke={1.6} ink={ink}>
              <path d="M13 -16 V16 M26 -16 V16 M39 -16 V16 M0 0 H52" stroke={v('c-window')} strokeWidth={1.6} opacity={0.75} />
            </Part>
          ))}
        </>
      )}
      <Line d="M0 -18 V-34 M-6 -34 H6" width={2.6} color={ink} />
      <circle cx={0} cy={-36} r={3.2} fill={v('c-red')} stroke={ink} strokeWidth={1.4} />
      <Part d={rrect(-18, -18, 36, 36, 7)} fill={v('c-orange')} shade={[7, 6]} stroke={1.6} ink={ink}>
        <path d="M-20 -20 H20 V-6 H-20 Z" fill={v('c-metal')} />
        <circle cx={0} cy={6} r={6} fill={v('c-cream')} stroke={ink} strokeWidth={1.4} />
      </Part>
    </g>
  );
}

/** Fir tree (kept for compatibility): base centred at (0,0), height ≈ 170·s. */
export function Fir({ x, y, s = 1, tone = 'c-tree' }: { x: number; y: number; s?: number; tone?: string }) {
  const t = tone.startsWith('art-') ? 'c-tree' : tone;
  const tier = (top: number, bottom: number, w: number) =>
    `M0 ${top} Q${w * 0.22} ${top + (bottom - top) * 0.55} ${w} ${bottom} Q${w * 0.4} ${bottom + 9} 0 ${bottom + 4} Q${-w * 0.4} ${bottom + 9} ${-w} ${bottom} Q${-w * 0.22} ${top + (bottom - top) * 0.55} 0 ${top} Z`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <SoftShadow cx={4} cy={2} rx={50} ry={8} />
      <Part d={rrect(-8, -26, 16, 28, 4)} fill={v('c-wood-2')} shade={[5, 4]} stroke={1.6} />
      <Part d={tier(-96, -16, 56)} fill={v(t)} shade={[14, 10]} stroke={1.6} />
      <Part d={tier(-132, -56, 46)} fill={mix(t, 'c-green', 82)} shade={[12, 9]} stroke={1.6} />
      <Part d={tier(-170, -98, 34)} fill={mix(t, 'c-cream', 86)} shade={[10, 8]} stroke={1.6} />
    </g>
  );
}

/** Hanging lamp: cord from y=0 to `len`, a coral shade with a warm bulb. */
export function Pendant({ x, len = 150, soft = true }: { x: number; len?: number; soft?: boolean }) {
  const ink = soft ? INK_BG : INK;
  return (
    <g>
      <Line d={`M${x} 0 V${len}`} width={2.6} color={ink} />
      <Part d={`M${x - 54} ${len + 44} Q${x - 46} ${len} ${x} ${len} Q${x + 46} ${len} ${x + 54} ${len + 44} Z`} fill={v('c-red')} shade={[10, 7]} stroke={1.8} ink={ink} />
      <path d={oval(x, len + 46, 40, 7)} fill={v('c-mustard')} />
    </g>
  );
}

/** Mug in a metal cup-holder (подстаканник), base centred at (0,0). */
export function GlassMug({ x, y, steam = false }: { x: number; y: number; steam?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <SoftShadow cx={4} cy={3} rx={46} ry={8} />
      {steam && (
        <g className="art-steam" fill="none" stroke={INK_BG} strokeWidth={3.4} strokeLinecap="round" opacity={0.5}>
          <path d="M-8 -70 Q-18 -84 -8 -96 Q2 -108 -8 -120" />
          <path d="M10 -70 Q2 -80 10 -90" />
        </g>
      )}
      <path d="M24 -48 H36 Q50 -48 50 -30 Q50 -14 34 -14 H24" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <path d="M24 -48 H36 Q50 -48 50 -30 Q50 -14 34 -14 H24" fill="none" stroke={v('c-steel')} strokeWidth={5.4} strokeLinecap="round" />
      <Part d="M-26 -58 H26 V-14 Q26 0 14 0 H-14 Q-26 0 -26 -14 Z" fill={v('c-orange')} shade={[9, 7]} stroke={1.6}>
        <path d="M-30 -34 H30 M-30 -20 H30" stroke={INK} strokeWidth={1.2} opacity={0.3} />
      </Part>
      <Part d="M-30 -14 H30 L24 0 H-24 Z" fill={v('c-steel')} shade={[6, 4]} stroke={1.6} />
      <path d={oval(0, -58, 26, 6)} fill={v('c-wood-2')} stroke={INK} strokeWidth={1.4} />
    </g>
  );
}

/** Floor with soft perspective lines. */
export function Floor({ y0, y1, color = 'c-floor' }: { y0: number; y1: number; color?: string }) {
  const c = color.startsWith('art-') ? 'c-floor' : color;
  const lines: string[] = [];
  const h = y1 - y0;
  for (let i = 1; i <= 3; i++) lines.push(`M0 ${y0 + (h * i * i) / 12} H1600`);
  for (let i = -8; i <= 8; i++) lines.push(`M${800 + i * 90} ${y0} L${800 + i * 220} ${y1}`);
  return (
    <g>
      <rect x={0} y={y0} width={1600} height={y1 - y0} fill={v(c)} />
      <path d={lines.join(' ')} stroke={INK_BG} strokeWidth={1.4} opacity={0.2} fill="none" />
      <path d={`M0 ${y0} H1600`} stroke={INK_BG} strokeWidth={2} />
    </g>
  );
}

/** Row of twinkles as a poster frieze. */
export function StarFrieze({ y, n = 16, w = 1600 }: { y: number; n?: number; w?: number }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) out.push(<Spark key={i} x={(w / n) * (i + 0.5)} y={y} r={i % 2 ? 7 : 10} />);
  return <g>{out}</g>;
}

/* ---- v2 additions ---- */

/** The Earth: sea disc with soft continents and a cloud wisp (centre cx, cy; radius r). */
export function Earth({ cx, cy, r, soft = false }: { cx: number; cy: number; r: number; soft?: boolean }) {
  const ink = soft ? INK_BG : INK;
  const sc = (pts: [number, number][]) => smooth(pts.map(([x, y]) => [cx + x * r, cy + y * r] as [number, number]));
  return (
    <Part d={circ(cx, cy, r)} fill={v('c-navy')} shade={[r * 0.26, r * 0.22]} light={[r * 0.07, r * 0.07]} stroke={Math.max(1.6, r * 0.04)} ink={ink}>
      <path d={sc([[-0.62, -0.3], [-0.3, -0.62], [0.18, -0.55], [0.38, -0.2], [0.08, 0.04], [-0.26, 0.02], [-0.52, -0.08]])} fill={v('c-green')} />
      <path d={sc([[0.3, 0.28], [0.64, 0.2], [0.74, 0.5], [0.46, 0.74], [0.22, 0.52]])} fill={v('c-green')} />
      <path d={sc([[-0.66, 0.38], [-0.34, 0.3], [-0.2, 0.62], [-0.5, 0.78]])} fill={v('c-green')} />
      <path d={`M${cx - r * 0.5} ${cy - r * 0.55} Q${cx - r * 0.1} ${cy - r * 0.85} ${cx + r * 0.3} ${cy - r * 0.62}`} fill="none" stroke={v('c-cream')} strokeWidth={r * 0.07} strokeLinecap="round" opacity={0.6} />
    </Part>
  );
}

/** A soft organic patch (bush, mound). Convenience for sceneries. */
export function Bush({ x, y, rx = 50, ry = 30, tone = 'c-tree', seed = 0 }: { x: number; y: number; rx?: number; ry?: number; tone?: string; seed?: number }) {
  return (
    <g>
      <SoftShadow cx={x} cy={y + ry * 0.9} rx={rx * 1.1} ry={ry * 0.3} />
      <Part d={blob(x, y, rx, ry, 8, 0.12, seed)} fill={v(tone)} shade={[rx * 0.2, ry * 0.3]} stroke={1.8} ink={INK_BG}>
        <path d={blob(x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.35, 6, 0.1, seed + 1)} fill={mix(tone, 'c-cream', 60)} opacity={0.5} />
      </Part>
    </g>
  );
}
