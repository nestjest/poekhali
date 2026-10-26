import { useId } from 'react';
import { Earth, Satellite, Spark } from './shapes';
import { INK, v } from './v2/shade';
import { mix } from './v2/scene';
import './art.css';

export interface OrbitCraft { id: string; name: string; orbit: 'leo' | 'sso' | 'meo' | 'geo'; launched: boolean }

type OrbitId = OrbitCraft['orbit'];

const CX = 400;
const CY = 300;
const ORBIT_IDS: OrbitId[] = ['leo', 'sso', 'meo', 'geo'];
const RINGS: Record<OrbitId, { rx: number; ry: number; name: string; base: number }> = {
  leo: { rx: 112, ry: 66, name: 'Низкая', base: 28 },
  sso: { rx: 172, ry: 102, name: 'Солнечно-синхронная', base: 152 },
  meo: { rx: 242, ry: 146, name: 'Средняя', base: 64 },
  geo: { rx: 322, ry: 196, name: 'Геостационарная', base: 206 },
};

interface Rect { x: number; y: number; w: number; h: number }
interface Placed { craft: OrbitCraft; ix: number; iy: number; label: Rect }

const PAD = 4;
const BOUNDS = { x0: 36, y0: 28, x1: 764, y1: 572 };
const hit = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + PAD && a.x + a.w + PAD > b.x && a.y < b.y + b.h + PAD && a.y + a.h + PAD > b.y;
const clamp = (r: Rect): Rect => ({
  ...r,
  x: Math.min(Math.max(r.x, BOUNDS.x0), BOUNDS.x1 - r.w),
  y: Math.min(Math.max(r.y, BOUNDS.y0), BOUNDS.y1 - r.h),
});

/** Ring caption rectangles (above the top of each ring) so craft labels keep away from them. */
function ringCaption(id: OrbitId): Rect {
  const r = RINGS[id];
  const w = r.name.length * 6.8 + 12;
  return { x: CX - w / 2, y: CY - r.ry - 20, w, h: 18 };
}

/** Pure layout: icon on its ring, label next to it, never overlapping other labels, icons, captions or the edges. */
function layout(crafts: OrbitCraft[]): Placed[] {
  const obstacles: Rect[] = ORBIT_IDS.map(ringCaption);
  obstacles.push({ x: CX - 60, y: CY - 60, w: 120, h: 120 }); // the Earth
  const icons: { craft: OrbitCraft; ix: number; iy: number }[] = [];
  for (const id of ORBIT_IDS) {
    const group = crafts.filter((c) => c.launched && c.orbit === id);
    const m = group.length;
    group.forEach((craft, j) => {
      let a = RINGS[id].base + (j * 360) / m;
      const fromTop = (((a + 90) % 360) + 360) % 360; // 0 = straight up
      if (fromTop < 26 || fromTop > 334) a += 52;
      const t = (a * Math.PI) / 180;
      icons.push({ craft, ix: CX + RINGS[id].rx * Math.cos(t), iy: CY + RINGS[id].ry * Math.sin(t) });
    });
  }
  icons.forEach((i) => obstacles.push({ x: i.ix - 42, y: i.iy - 28, w: 84, h: 56 }));
  const placed: Placed[] = [];
  const taken: Rect[] = [];
  for (const { craft, ix, iy } of icons) {
    const w = craft.name.length * 8.2 + 22;
    const h = 26;
    const right = ix < CX;
    const cands: Rect[] = [
      { x: right ? ix + 48 : ix - 48 - w, y: iy - h / 2, w, h },
      { x: right ? ix - 48 - w : ix + 48, y: iy - h / 2, w, h },
      { x: ix - w / 2, y: iy + 34, w, h },
      { x: ix - w / 2, y: iy - 34 - h, w, h },
    ];
    for (let k = 1; k <= 12; k++) {
      const dy = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (h + PAD);
      cands.push({ x: cands[0].x, y: cands[0].y + dy, w, h });
    }
    let chosen = clamp(cands[0]);
    for (const c of cands) {
      const r = clamp(c);
      const free = !obstacles.some((o) => hit(r, o)) && !taken.some((o) => hit(r, o));
      if (free) { chosen = r; break; }
    }
    taken.push(chosen);
    placed.push({ craft, ix, iy, label: chosen });
  }
  return placed;
}

const STARS: [number, number, number][] = [
  [60, 60, 6], [150, 540, 5], [250, 40, 5], [560, 30, 6], [690, 70, 5], [740, 520, 6], [610, 560, 5], [30, 300, 4], [770, 300, 4],
];

/** «Карта орбит»: the Earth, four orbit rings and the spacecraft that have already been launched. */
export function OrbitMap({ crafts }: { crafts: OrbitCraft[] }) {
  const uid = useId().replace(/:/g, '');
  const placed = layout(crafts);
  const summary = placed.length
    ? placed.map((p) => `${p.craft.name} — ${RINGS[p.craft.orbit].name.toLowerCase()} орбита`).join('; ')
    : 'аппаратов на орбите пока нет';
  return (
    <svg
      viewBox="0 0 800 600" width="100%" role="img" aria-label={`Карта орбит: ${summary}`}
      style={{ display: 'block', height: 'auto', maxWidth: '100%' }}
    >
      <rect x={2} y={2} width={796} height={596} rx={20} fill={v('c-sky-night')} stroke={INK} strokeWidth={2.4} />
      <defs>
        <radialGradient id={`${uid}halo`}>
          <stop offset="0" stopColor={v('c-navy')} stopOpacity={0.5} />
          <stop offset="1" stopColor={v('c-navy')} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={CX} cy={CY} r={300} fill={`url(#${uid}halo)`} />
      {STARS.map(([x, y, r]) => <Spark key={`${x}${y}`} x={x} y={y} r={r} op={0.85} />)}

      {/* rings */}
      {ORBIT_IDS.map((id, i) => (
        <ellipse
          key={id} cx={CX} cy={CY} rx={RINGS[id].rx} ry={RINGS[id].ry} fill="none"
          stroke={v('c-screen-glow')} strokeWidth={2} opacity={0.7} strokeDasharray={i === 3 ? '4 9' : i === 2 ? '12 7' : undefined}
        />
      ))}
      {ORBIT_IDS.map((id) => {
        const c = ringCaption(id);
        return (
          <text
            key={id} x={CX} y={c.y + 13} textAnchor="middle" fontFamily="var(--font-ui)" fontSize={12}
            fill={v('c-screen-glow')} opacity={0.9}
          >
            {RINGS[id].name}
          </text>
        );
      })}

      {/* the Earth */}
      <circle cx={CX} cy={CY} r={66} fill={v('c-screen-glow')} opacity={0.18} />
      <Earth cx={CX} cy={CY} r={58} />

      {/* spacecraft (the group drifts slowly; labels move with it) */}
      <g className="art-orbit-drift">
        {placed.map(({ craft, ix, iy, label }) => (
          <g key={craft.id}>
            <circle cx={ix} cy={iy} r={26} fill={v('c-star')} opacity={0.2} />
            <g transform={`translate(${ix} ${iy})`}><Satellite s={0.5} /></g>
            <g>
              <rect x={label.x} y={label.y} width={label.w} height={label.h} rx={13} fill={mix('c-navy', 'c-sky-night', 40)} stroke={v('c-screen-glow')} strokeWidth={1.6} />
              <text
                x={label.x + label.w / 2} y={label.y + label.h / 2} textAnchor="middle" dominantBaseline="central"
                fontFamily="var(--font-ui)" fontWeight={700} fontSize={14} fill={v('c-cream')}
              >
                {craft.name}
              </text>
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
