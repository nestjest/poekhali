// Style v2 scene kit: organic shapes, muted background parts, sky, lamp light, trees, hangar, tower.
// Everything draws with the `Part` cel-shading (light from the upper-left) and takes colours only from --c-* tokens.
// The background plane is lighter and softer (INK_BG, fade veil); the foreground keeps full contrast.
import { useId, type ComponentProps } from 'react';
import { INK_BG, Line, Part, SoftShadow, v } from './shade';

export type LocationTime = 'morning' | 'day' | 'evening';
type PartP = ComponentProps<typeof Part>;

/** `color-mix` of two --c-* tokens: `mix('c-sky', 'c-cream', 60)` = 60% sky + 40% cream. */
export const mix = (a: string, b: string, pct = 50) => `color-mix(in srgb, var(--${a}) ${pct}%, var(--${b}))`;

export const rrect = (x: number, y: number, w: number, h: number, r = 10) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

export const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
export const oval = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

const f = (n: number) => Math.round(n * 10) / 10;

/** A smooth (Catmull-Rom → cubic Bézier) curve through the points; closed by default. */
export function smooth(pts: [number, number][], closed = true): string {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.min(Math.max(i, 0), n - 1)]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}

/** A free-form rounded blob (leaf mass, bush, cloud, continent): an ellipse with a gently wavy edge. */
export function blob(cx: number, cy: number, rx: number, ry: number, n = 9, amp = 0.12, seed = 0): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + amp * Math.sin(i * 2.3 + seed * 1.7) + amp * 0.55 * Math.cos(i * 3.1 + seed * 0.9);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts);
}

/** Background part: same cel-shading, softer outline. */
export const Bg = (p: PartP) => <Part shade={[10, 8]} light={[3, 3]} stroke={1.8} ink={INK_BG} {...p} />;

/** Pushes everything drawn before it away (lighter, hazier). */
export function Veil({ k = 1 }: { k?: number }) {
  return <rect x={-10} y={-10} width={1620} height={920} fill={v('c-bg-fade')} opacity={k} pointerEvents="none" />;
}

/** Opacity of lamp light: 0 by day, evening → warm. In the dark theme `--c-glow` is already on. */
export const lampOpacity = (time: LocationTime) => (time === 'evening' ? 'max(var(--c-glow), 0.7)' : 'var(--c-glow)');

/** A warm pool of lamp light (radial gradient, no blur). */
export function Glow({ cx, cy, r, time, k = 1, color = 'c-mustard' }: { cx: number; cy: number; r: number; time: LocationTime; k?: number; color?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <g style={{ opacity: `calc(${lampOpacity(time)} * ${k})` }} pointerEvents="none">
      <defs>
        <radialGradient id={`gl${id}`}>
          <stop offset="0%" stopColor={v(color)} stopOpacity={0.55} />
          <stop offset="55%" stopColor={v('c-orange')} stopOpacity={0.18} />
          <stop offset="100%" stopColor={v('c-orange')} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#gl${id})`} />
    </g>
  );
}

/** Whole-frame tint for the time of day (morning: warm peach, evening: dusk). */
export function TimeTint({ time }: { time: LocationTime }) {
  if (time === 'day') return null;
  return (
    <g pointerEvents="none">
      {time === 'morning' && <rect x={-10} y={-10} width={1620} height={920} fill={v('c-mustard')} opacity={0.1} />}
      {time === 'evening' && <rect x={-10} y={-10} width={1620} height={920} fill={v('c-orange')} opacity={0.1} />}
      {time === 'evening' && <rect x={-10} y={-10} width={1620} height={920} fill={v('c-sky-night')} opacity={0.18} />}
    </g>
  );
}

const SKY: Record<LocationTime, [string, number][]> = {
  morning: [[mix('c-sky', 'c-sky-2', 78), 0], [mix('c-sky-2', 'c-orange', 64), 1]],
  day: [[v('c-sky'), 0], [mix('c-sky', 'c-sky-2', 62), 1]],
  evening: [[mix('c-sky', 'c-sky-night', 46), 0], [v('c-sky-2'), 0.62], [mix('c-sky-2', 'c-orange', 56), 1]],
};
const STAR_POS: [number, number, number][] = [
  [0.06, 0.08, 5], [0.15, 0.2, 4], [0.24, 0.06, 6], [0.33, 0.17, 4], [0.44, 0.07, 5], [0.52, 0.22, 4], [0.61, 0.09, 6],
  [0.7, 0.18, 4], [0.79, 0.06, 5], [0.88, 0.2, 4], [0.94, 0.1, 6], [0.4, 0.33, 3.5], [0.1, 0.38, 3.5], [0.74, 0.35, 3.5],
];

/** Four-point twinkle. */
export const sparkPath = (r: number) =>
  `M0 ${-r} Q${r * 0.18} ${-r * 0.18} ${r} 0 Q${r * 0.18} ${r * 0.18} 0 ${r} Q${-r * 0.18} ${r * 0.18} ${-r} 0 Q${-r * 0.18} ${-r * 0.18} 0 ${-r} Z`;

/** Sky rectangle (pastel gradient by time of day, soft horizon haze, stars at dusk and in the dark theme). */
export function Sky({ time, x, y, w, h, stars = true }: { time: LocationTime; x: number; y: number; w: number; h: number; stars?: boolean }) {
  const id = useId().replace(/:/g, '');
  const k = Math.min(1.4, Math.max(0.5, Math.min(w, h) / 640));
  return (
    <g>
      <defs>
        <linearGradient id={`sk${id}`} x1="0" y1="0" x2="0" y2="1">
          {SKY[time].map(([c, o]) => <stop key={o} offset={o} stopColor={c} />)}
        </linearGradient>
        <linearGradient id={`hz${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor={v('c-sky-2')} stopOpacity={0} />
          <stop offset="1" stopColor={v('c-sky-2')} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#sk${id})`} />
      <rect x={x} y={y} width={w} height={h} fill={`url(#hz${id})`} />
      {stars && (
        <g style={{ opacity: time === 'evening' ? 0.95 : 'calc(var(--c-glow) * 1.7)' }}>
          {STAR_POS.map(([sx, sy, r]) => (
            <path key={`${sx}${sy}`} transform={`translate(${f(x + w * sx)} ${f(y + h * sy * 0.8)})`} d={sparkPath(r * k * 1.5)} fill={v('c-star')} />
          ))}
        </g>
      )}
    </g>
  );
}

/** Sun (or a low glowing disc at dawn and dusk) with a soft halo. */
export function Sun({ time, cx, cy, r }: { time: LocationTime; cx: number; cy: number; r: number }) {
  const id = useId().replace(/:/g, '');
  const color = time === 'day' ? 'c-mustard' : 'c-orange';
  return (
    <g>
      <defs>
        <radialGradient id={`sn${id}`}>
          <stop offset="0" stopColor={v(color)} stopOpacity={0.5} />
          <stop offset="1" stopColor={v(color)} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r * 2.8} fill={`url(#sn${id})`} />
      <Part d={circ(cx, cy, r)} fill={v(color)} shade={[r * 0.28, r * 0.22]} light={[r * 0.08, r * 0.08]} stroke={1.8} ink={INK_BG} />
    </g>
  );
}

/** Round tree. Base centred at (x, y); height ≈ 190·s. */
export function Tree({ x, y, s = 1, tone = 'c-tree', seed = 0 }: { x: number; y: number; s?: number; tone?: string; seed?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <SoftShadow cx={6} cy={2} rx={62} ry={9} />
      <Bg d={rrect(-8, -76, 16, 78, 6)} fill={v('c-wood-2')} shade={[6, 4]} />
      <Bg d={blob(0, -128, 54, 62, 9, 0.12, seed)} fill={v(tone)} shade={[16, 12]}>
        <path d={blob(-16, -150, 26, 30, 7, 0.1, seed + 2)} fill={mix(tone, 'c-cream', 62)} opacity={0.55} />
        <path d={blob(14, -104, 20, 16, 6, 0.1, seed + 4)} fill={mix(tone, 'c-green', 60)} opacity={0.5} />
      </Bg>
    </g>
  );
}

/** Fir tree. Base centred at (x, y); height ≈ 170·s. */
export function FirTree({ x, y, s = 1, tone = 'c-tree' }: { x: number; y: number; s?: number; tone?: string }) {
  const tier = (top: number, bottom: number, w: number) =>
    `M0 ${top} Q${w * 0.22} ${top + (bottom - top) * 0.55} ${w} ${bottom} Q${w * 0.4} ${bottom + 9} 0 ${bottom + 4} Q${-w * 0.4} ${bottom + 9} ${-w} ${bottom} Q${-w * 0.22} ${top + (bottom - top) * 0.55} 0 ${top} Z`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <SoftShadow cx={4} cy={2} rx={50} ry={8} />
      <Bg d={rrect(-8, -26, 16, 28, 4)} fill={v('c-wood-2')} shade={[5, 4]} />
      <Bg d={tier(-96, -16, 56)} fill={v(tone)} shade={[14, 10]} />
      <Bg d={tier(-132, -56, 46)} fill={mix(tone, 'c-green', 82)} shade={[12, 9]} />
      <Bg d={tier(-170, -98, 34)} fill={mix(tone, 'c-cream', 86)} shade={[10, 8]} />
    </g>
  );
}

/** Assembly-and-test hangar with an arched roof (background style). */
export function Hangar({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const ribs: string[] = [];
  for (let i = 1; i < 6; i++) ribs.push(`M${x + (w / 6) * i} ${y + h * 0.18 + Math.abs(3 - i) * h * 0.1} V${y + h}`);
  return (
    <g>
      <SoftShadow cx={x + w / 2} cy={y + h + 2} rx={w * 0.62} ry={9} />
      <Bg d={`M${x} ${y + h} V${y + h * 0.4} Q${x + w / 2} ${y - h * 0.34} ${x + w} ${y + h * 0.4} V${y + h} Z`} fill={v('c-metal')} shade={[14, 10]}>
        <Line d={ribs.join(' ')} color={INK_BG} width={1.4} opacity={0.3} />
      </Bg>
      <Bg d={rrect(x + w * 0.3, y + h * 0.42, w * 0.4, h * 0.58, 6)} fill={v('c-navy')} shade={[8, 6]}>
        <Line d={`M${x + w * 0.5} ${y + h * 0.42} V${y + h}`} color={INK_BG} width={1.4} />
      </Bg>
      <path d={rrect(x + w * 0.3, y + h * 0.42, w * 0.4, h * 0.07, 3)} fill={v('c-red')} />
      {[0.1, 0.2, 0.74, 0.84].map((k) => (
        <path key={k} d={rrect(x + w * k, y + h * 0.34, w * 0.06, h * 0.14, 3)} fill={v('c-window')} stroke={INK_BG} strokeWidth={1.4} />
      ))}
    </g>
  );
}

/** Lattice service tower: two red legs, X-bracing (background style). */
export function Lattice({ x, y, w, h, rows = 6 }: { x: number; y: number; w: number; h: number; rows?: number }) {
  const rh = h / rows;
  const braces: string[] = [];
  const bars: string[] = [];
  for (let i = 0; i < rows; i++) {
    const y0 = y + i * rh;
    braces.push(`M${x} ${y0} L${x + w} ${y0 + rh} M${x + w} ${y0} L${x} ${y0 + rh}`);
    bars.push(`M${x} ${y0 + rh} H${x + w}`);
  }
  return (
    <g>
      <SoftShadow cx={x + w / 2} cy={y + h + 2} rx={w * 1.1} ry={7} />
      <rect x={x} y={y} width={w} height={h} fill={v('c-cream')} opacity={0.28} />
      <path d={braces.join(' ')} stroke={INK_BG} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.75} />
      <path d={bars.join(' ')} stroke={INK_BG} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d={`M${x} ${y} V${y + h} M${x + w} ${y} V${y + h}`} stroke={INK_BG} strokeWidth={Math.max(7, w * 0.16)} strokeLinecap="round" />
      <path d={`M${x} ${y} V${y + h} M${x + w} ${y} V${y + h}`} stroke={v('c-red')} strokeWidth={Math.max(3.4, w * 0.08)} strokeLinecap="round" />
    </g>
  );
}

/** Soft rolling hills: a smooth ridge line closed down to `bottom`. */
export function Ridge({ pts, bottom, fill, stroke = INK_BG }: { pts: [number, number][]; bottom: number; fill: string; stroke?: string }) {
  const first = pts[0], last = pts[pts.length - 1];
  const d = `${smooth(pts, false)} L${last[0]} ${bottom} L${first[0]} ${bottom} Z`;
  return <Part d={d} fill={fill} shade={[0, 0]} light={[0, 3]} stroke={1.8} ink={stroke} />;
}
