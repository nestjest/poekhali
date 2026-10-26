import type { KeyboardEvent, ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Earth, GlassMug, Rocket, Satellite, Spark, Star } from './shapes';
import { INK, INK_BG, INK_SOFT, Line, Part, SoftShadow, v } from './v2/shade';
import { Glow, circ, mix, oval, rrect } from './v2/scene';
import './art.css';

export type HotspotId =
  | 'orders' | 'desk' | 'board' | 'cabinet' | 'mail' | 'shop' | 'reviews' | 'door' | 'museum' | 'orbit';

export const HOTSPOT_IDS: HotspotId[] = [
  'orders', 'desk', 'board', 'cabinet', 'mail', 'shop', 'reviews', 'door', 'museum', 'orbit',
];

/** viewBox (1200x700) coordinates where a DOM label for each hotspot should be centered. */
export const HOTSPOT_ANCHORS: Record<HotspotId, { x: number; y: number }> = {
  door: { x: 135, y: 340 },
  orders: { x: 386, y: 250 },
  orbit: { x: 670, y: 226 },
  board: { x: 924, y: 262 },
  mail: { x: 880, y: 350 },
  cabinet: { x: 1113, y: 380 },
  desk: { x: 680, y: 628 },
  shop: { x: 336, y: 650 },
  museum: { x: 925, y: 642 },
  reviews: { x: 1096, y: 662 },
};

export const ROOM_UPGRADES = ['plant', 'poster', 'coffee', 'chair', 'monitor2', 'taskboard', 'lamp', 'rug'] as const;

interface Props {
  upgrades: string[];
  onHotspot: (id: HotspotId) => void;
  /** 'door' label is optional (defaults to «Уйти домой») */
  labels: Record<Exclude<HotspotId, 'door'>, string> & Partial<Record<'door', string>>;
  badges?: Partial<Record<HotspotId, number>>;
  /** optional parallax tilt, each axis -1..1 */
  tilt?: { x: number; y: number };
  /** when provided, only these hotspots are interactive; the rest render as inert decoration */
  enabled?: HotspotId[];
  /** draws a bouncing marker above this hotspot */
  highlight?: HotspotId;
  /** how many spacecraft are already in orbit (dots on the «Карта орбит» screen) */
  satellites?: number;
}

interface Bounds { x: number; y: number; w: number; h: number }
/** Hit areas never overlap: wall row on top, floor row below. */
const BOUNDS: Record<HotspotId, Bounds> = {
  door: { x: 18, y: 92, w: 234, h: 398 },
  orders: { x: 266, y: 118, w: 240, h: 214 },
  orbit: { x: 520, y: 56, w: 300, h: 196 },
  board: { x: 834, y: 92, w: 180, h: 200 },
  mail: { x: 834, y: 306, w: 92, h: 86 },
  cabinet: { x: 1040, y: 108, w: 146, h: 330 },
  shop: { x: 262, y: 418, w: 160, h: 216 },
  desk: { x: 546, y: 348, w: 270, h: 256 },
  museum: { x: 830, y: 410, w: 190, h: 210 },
  reviews: { x: 1040, y: 448, w: 146, h: 226 },
};

const SIGN = mix('c-navy', 'c-ink', 62);
const Fg = Part;

function Badge({ b, n }: { b: Bounds; n: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={b.x + b.w - 6} cy={b.y + 10} r={17} fill={v('c-red')} stroke={INK} strokeWidth={1.8} />
      <text
        x={b.x + b.w - 6} y={b.y + 10} textAnchor="middle" dominantBaseline="central"
        fontSize={19} fontWeight={800} fill={v('c-cream')} stroke={INK} strokeWidth={0.6} paintOrder="stroke" fontFamily="var(--font-ui)"
      >
        {n > 99 ? '99+' : n}
      </text>
    </g>
  );
}

function Marker({ id }: { id: HotspotId }) {
  const b = BOUNDS[id];
  const cx = b.x + b.w / 2;
  const cy = Math.max(b.y - 30, 34);
  return (
    <g pointerEvents="none" aria-hidden="true">
      {/* translate on the outer group: the CSS bounce animation owns the inner group's transform */}
      <g transform={`translate(${cx} ${cy})`}>
        <g className="art-bounce">
          <Fg d="M-20 -14 Q-20 -22 -12 -22 H12 Q20 -22 20 -14 V0 Q20 6 15 10 L5 21 Q0 26 -5 21 L-15 10 Q-20 6 -20 0 Z" fill={v('c-red')} shade={[6, 5]} stroke={2} />
          <path d="M-9 -10 L0 4 L9 -10" fill="none" stroke={v('c-cream')} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </g>
  );
}

function Hotspot({
  id, label, onHotspot, badge, inert, children,
}: { id: HotspotId; label: string; onHotspot: (id: HotspotId) => void; badge?: number; inert?: boolean; children: ReactNode }) {
  const b = BOUNDS[id];
  const act = () => onHotspot(id);
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      act();
    }
  };
  if (inert) {
    return (
      <g>
        <g>{children}</g>
        {badge != null && badge > 0 && <Badge b={b} n={badge} />}
      </g>
    );
  }
  return (
    <g role="button" tabIndex={0} aria-label={label} className="art-hotspot" onClick={act} onKeyDown={onKey}>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" />
      <g className="art-lift">{children}</g>
      <rect
        className="art-hs-ring" x={b.x - 6} y={b.y - 6} width={b.w + 12} height={b.h + 12} rx={22}
        fill="none" stroke={v('focus')} strokeWidth={5}
      />
      {badge != null && badge > 0 && <Badge b={b} n={badge} />}
    </g>
  );
}

/* ------------------------------ scenery ------------------------------ */

function Wall() {
  const lamps: ReactNode[] = [];
  for (let i = 0; i < 12; i++) lamps.push(<rect key={i} x={46 + i * 100} y={10} width={36} height={11} rx={5.5} fill={v('c-mustard')} stroke={INK_BG} strokeWidth={1.4} />);
  const panels: ReactNode[] = [];
  for (let i = 0; i < 11; i++) panels.push(<path key={i} d={rrect(8 + i * 110, 408, 90, 70, 10)} fill="none" stroke={v('c-cream')} strokeWidth={1.8} opacity={0.3} />);
  return (
    <g>
      <rect x={-24} y={-24} width={1248} height={514} fill={v('c-wall')} />
      <Line d="M150 40 V388 M560 40 V388 M1010 40 V388" color={INK_BG} width={1.4} opacity={0.16} />
      {/* wainscot */}
      <rect x={-24} y={388} width={1248} height={102} fill={mix('c-navy', 'c-wall', 55)} />
      <rect x={-24} y={388} width={1248} height={10} fill={v('c-red')} opacity={0.85} />
      <Line d="M-24 388 H1224" color={INK_BG} width={1.8} />
      {panels}
      {/* ceiling band with lamps */}
      <rect x={-24} y={-24} width={1248} height={56} fill={mix('c-navy', 'c-wall', 62)} />
      <rect x={-24} y={26} width={1248} height={6} fill={v('c-red')} opacity={0.85} />
      <Line d="M-24 32 H1224" color={INK_BG} width={1.8} />
      {lamps}
      {/* floor */}
      <rect x={-24} y={490} width={1248} height={240} fill={v('c-floor')} />
      <Line d="M0 540 H1200 M0 596 H1200 M0 656 H1200" color={INK_BG} width={1.4} opacity={0.18} />
      <Line d="M180 490 L150 540 M430 490 L420 540 M700 490 L700 540 M980 490 L1000 540 M90 540 L60 596 M330 540 L310 596 M620 540 L610 596 M880 540 L890 596 M1130 540 L1150 596" color={INK_BG} width={1.2} opacity={0.15} />
      <Line d="M-24 490 H1224" color={INK_BG} width={2} />
      <Glow time="day" cx={600} cy={40} r={520} k={0.5} />
    </g>
  );
}

function ExitDoor() {
  const hazard: ReactNode[] = [];
  for (let x = 30; x < 240; x += 24) hazard.push(<path key={x} d={`M${x} 472 l12 0 l12 -26 l-12 0 Z`} fill={v('c-red')} opacity={0.8} />);
  return (
    <g>
      <SoftShadow cx={135} cy={492} rx={140} ry={12} />
      <Fg d={rrect(18, 92, 234, 398, 12)} fill={v('c-steel')} shade={[12, 9]} />
      <rect x={36} y={130} width={198} height={360} fill={v('c-sky')} />
      <Fg d={rrect(36, 130, 98, 360, 4)} fill={v('c-metal')} shade={[8, 6]} stroke={1.6}>
        <path d={rrect(48, 300, 74, 126, 6)} fill="none" stroke={INK_SOFT} strokeWidth={1.4} />
      </Fg>
      <Fg d={rrect(136, 130, 98, 360, 4)} fill={v('c-metal')} shade={[8, 6]} stroke={1.6}>
        <path d={rrect(148, 300, 74, 126, 6)} fill="none" stroke={INK_SOFT} strokeWidth={1.4} />
      </Fg>
      <Fg d={circ(85, 230, 26)} fill={v('c-window')} shade={[6, 5]}>
        <path d="M66 244 L80 220 L88 234" fill="none" stroke={v('c-cream')} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      </Fg>
      <Fg d={circ(185, 230, 26)} fill={v('c-window')} shade={[6, 5]}>
        <path d="M166 244 L180 220 L188 234" fill="none" stroke={v('c-cream')} strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      </Fg>
      <Fg d={rrect(36, 446, 198, 26, 3)} fill={v('c-cream')} shade={[0, 4]} light={null} stroke={1.4}>{hazard}</Fg>
      <Fg d={rrect(118, 322, 10, 66, 5)} fill={v('c-mustard')} shade={[3, 3]} stroke={1.4} />
      <Fg d={rrect(142, 322, 10, 66, 5)} fill={v('c-mustard')} shade={[3, 3]} stroke={1.4} />
      {/* lintel with the exit sign */}
      <Fg d={rrect(26, 98, 218, 28, 9)} fill={SIGN} shade={[0, 6]} stroke={1.6} />
      <circle cx={135} cy={112} r={9} fill={v('c-green')} stroke={INK} strokeWidth={1.4} />
      <path d="M130 112 H141 M137 108 L141 112 L137 116" fill="none" stroke={v('c-cream')} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function PosterGo() {
  return (
    <g>
      <Fg d={rrect(946, 308, 76, 94, 6)} fill={v('c-wood')} shade={[6, 5]} stroke={1.6} />
      <Fg d={rrect(954, 316, 60, 78, 3)} fill={v('c-red')} shade={[4, 4]} stroke={1.4}>
        <circle cx={984} cy={346} r={20} fill={v('c-mustard')} />
      </Fg>
      <g transform="translate(984 358) rotate(14) scale(0.15)"><Rocket sw={7} /></g>
      <text x={984} y={384} textAnchor="middle" fontFamily="var(--font-ui)" fontWeight={800} fontSize={11} fill={v('c-cream')} textLength={52} lengthAdjust="spacingAndGlyphs">ПОЕХАЛИ!</text>
    </g>
  );
}

/* ------------------------------ hotspot objects ------------------------------ */

function OrdersWindow() {
  const flags: ReactNode[] = [];
  const pal = ['c-red', 'c-orange', 'c-mustard'];
  for (let i = 0; i < 9; i++) {
    const x = 290 + i * 22.2;
    flags.push(<Fg key={i} d={`M${x + 1} 140 h20 l-10 26 z`} fill={v(pal[i % 3])} shade={[3, 3]} light={null} stroke={1.4} />);
  }
  return (
    <g>
      <SoftShadow cx={390} cy={326} rx={130} ry={9} />
      <Line d="M290 138 Q390 152 490 138" color={INK} width={1.6} />
      {flags}
      <Fg d={rrect(290, 176, 200, 144, 12)} fill={v('c-wood')} shade={[10, 8]} />
      <Fg d={rrect(306, 192, 168, 112, 6)} fill={v('c-window-far')} shade={[7, 6]} stroke={1.6}>
        <g opacity={0.7}>
          <rect x={322} y={250} width={34} height={54} rx={4} fill={v('c-metal')} />
          <rect x={366} y={236} width={24} height={68} rx={4} fill={v('c-navy')} />
          <circle cx={436} cy={222} r={14} fill={v('c-window')} />
          <rect x={410} y={262} width={50} height={42} rx={5} fill={v('c-red')} opacity={0.7} />
        </g>
        <path d="M326 208 L350 232 M326 226 L340 240" stroke={v('c-cream')} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
      </Fg>
      <Line d="M390 192 V304 M306 248 H474" color={INK_SOFT} width={1.6} />
      <Fg d={rrect(278, 304, 224, 18, 7)} fill={v('c-wood-2')} shade={[0, 5]} />
      {/* cubesat model on the sill + call bell */}
      <g transform="translate(332 292)"><Satellite s={0.5} cube /></g>
      <Fg d="M404 304 C404 282 440 282 440 304 Z" fill={v('c-mustard')} shade={[5, 4]} stroke={1.4} />
      <circle cx={422} cy={281} r={3.6} fill={v('c-mustard')} stroke={INK} strokeWidth={1.4} />
    </g>
  );
}

function OrbitScreen({ n }: { n: number }) {
  const cx = 670, cy = 158;
  const rings: [number, number][] = [[62, 34], [88, 48], [114, 62], [136, 74]];
  const dots: ReactNode[] = [];
  const count = Math.max(0, Math.min(12, Math.floor(n)));
  for (let i = 0; i < count; i++) {
    const [rx, ry] = rings[i % 4];
    const a = (i * 2.399 + 0.6) % (Math.PI * 2);
    dots.push(
      <g key={i}>
        <circle cx={cx + rx * Math.cos(a)} cy={cy + ry * Math.sin(a)} r={9} fill={v('c-star')} opacity={0.3} />
        <circle cx={cx + rx * Math.cos(a)} cy={cy + ry * Math.sin(a)} r={4.6} fill={v('c-star')} />
      </g>,
    );
  }
  return (
    <g>
      <Line d="M572 56 V-20 M768 56 V-20" color={INK} width={2.4} />
      <Fg d={rrect(520, 56, 300, 196, 16)} fill={SIGN} shade={[12, 9]} />
      <rect x={534} y={70} width={272} height={168} rx={8} fill={v('c-screen')} stroke={INK} strokeWidth={1.6} />
      <circle cx={548} cy={82} r={4} fill={v('c-red')} />
      <Line d="M560 82 H608 M770 82 H794" color={v('c-screen-glow')} width={3} opacity={0.7} />
      {rings.map(([rx, ry], i) => (
        <ellipse
          key={rx} cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={v('c-screen-glow')} strokeWidth={1.8}
          strokeDasharray={i === 3 ? '3 7' : i === 2 ? '10 6' : undefined} opacity={0.75}
        />
      ))}
      <Earth cx={cx} cy={cy} r={30} />
      {dots}
      <path d="M548 90 L572 76 H700 L640 90 Z" fill={v('c-cream')} opacity={0.08} />
    </g>
  );
}

function Notes({ x, y, size, items }: { x: number; y: number; size: number; items: { dx: number; dy: number; c: string; r: number }[] }) {
  return (
    <g>
      {items.map((n, i) => (
        <g key={i} transform={`rotate(${n.r} ${x + n.dx + size / 2} ${y + n.dy + size / 2})`}>
          <Fg d={rrect(x + n.dx, y + n.dy, size, size, 3)} fill={n.c} shade={[3, 3]} light={null} stroke={1.4}>
            <Line d={`M${x + n.dx + 6} ${y + n.dy + 11} H${x + n.dx + size - 6} M${x + n.dx + 6} ${y + n.dy + 20} H${x + n.dx + size - 12}`} color={INK} width={1.4} opacity={0.4} />
          </Fg>
        </g>
      ))}
    </g>
  );
}

function Board({ extra }: { extra: boolean }) {
  return (
    <g>
      <SoftShadow cx={924} cy={290} rx={96} ry={8} />
      <Fg d={rrect(836, 100, 176, 184, 12)} fill={v('c-wood')} shade={[10, 8]} />
      <Fg d={rrect(848, 112, 152, 160, 5)} fill={v('c-cream')} shade={[6, 5]} stroke={1.6}>
        <Line d="M860 124 H930 M860 134 H906" color={INK_BG} width={3} opacity={0.5} />
      </Fg>
      <Star x={980} y={128} r={9} />
      <Notes
        x={860} y={146} size={32}
        items={[
          { dx: 0, dy: 0, c: v('c-mustard'), r: -4 },
          { dx: 40, dy: 4, c: v('c-orange'), r: 3 },
          { dx: 80, dy: 0, c: v('c-window'), r: -2 },
          { dx: 8, dy: 40, c: v('c-green'), r: 4 },
          { dx: 52, dy: 42, c: v('c-mustard'), r: -3 },
        ]}
      />
      {extra && (
        <g>
          <Line d="M856 220 H992" color={INK_BG} width={1.8} opacity={0.8} />
          <Notes
            x={862} y={228} size={30}
            items={[
              { dx: 0, dy: 0, c: v('c-window'), r: 3 },
              { dx: 40, dy: 2, c: v('c-orange'), r: -3 },
              { dx: 80, dy: 0, c: v('c-mustard'), r: 2 },
            ]}
          />
        </g>
      )}
    </g>
  );
}

/** Pneumatic-mail station: receiver box with a capsule window and tube stubs. */
function PneumoMail() {
  return (
    <g>
      <Line d="M834 330 H846 M914 330 H926" color={INK} width={13} />
      <Line d="M834 330 H846 M914 330 H926" color={v('c-metal')} width={7} />
      <Fg d={rrect(846, 312, 68, 74, 12)} fill={v('c-orange')} shade={[8, 6]} />
      <Fg d={rrect(856, 322, 48, 32, 7)} fill={v('c-window')} shade={[5, 4]} stroke={1.5} />
      <Fg d={rrect(866, 331, 28, 14, 7)} fill={v('c-red')} shade={[3, 3]} light={null} stroke={1.2} />
      <circle cx={868} cy={370} r={5} fill={v('c-green')} stroke={INK} strokeWidth={1.4} />
      <rect x={880} y={365} width={24} height={9} rx={4.5} fill={INK_SOFT} />
    </g>
  );
}

function Cabinet() {
  const palette = ['c-red', 'c-navy', 'c-mustard', 'c-window', 'c-orange', 'c-green'];
  const shelves = [200, 280, 360];
  const items: ReactNode[] = [];
  shelves.forEach((sy, si) => {
    let x = 1060;
    let i = 0;
    while (x < 1164) {
      const w = 12 + ((si * 5 + i * 7) % 3) * 5;
      const h = 40 + ((si * 3 + i * 5) % 4) * 6;
      if (x + w > 1166) break;
      items.push(<rect key={`${si}-${i}`} x={x} y={sy - h} width={w} height={h} rx={3} fill={v(palette[(si * 2 + i) % palette.length])} stroke={INK_SOFT} strokeWidth={1.2} />);
      x += w + 3;
      i++;
    }
  });
  return (
    <g>
      <SoftShadow cx={1113} cy={426} rx={92} ry={9} />
      <Fg d={rrect(1042, 118, 144, 306, 12)} fill={v('c-steel')} shade={[12, 9]} />
      <Fg d={rrect(1054, 130, 120, 232, 5)} fill={mix('c-navy', 'c-ink', 80)} shade={[6, 5]} stroke={1.6} />
      {items}
      {shelves.map((sy) => <Fg key={sy} d={rrect(1054, sy, 120, 10, 3)} fill={v('c-metal')} shade={[0, 3]} light={null} stroke={1.4} />)}
      {/* drawers */}
      <Fg d={rrect(1054, 372, 120, 42, 6)} fill={v('c-metal')} shade={[5, 5]} stroke={1.6}>
        <Line d="M1114 372 V414" color={INK_SOFT} width={1.4} />
      </Fg>
      <Fg d={rrect(1086, 388, 24, 7, 3.5)} fill={v('c-mustard')} shade={[2, 2]} light={null} stroke={1.2} />
      <Fg d={rrect(1118, 388, 24, 7, 3.5)} fill={v('c-mustard')} shade={[2, 2]} light={null} stroke={1.2} />
    </g>
  );
}

function Monitor({ x, y, w, h, tilt = 0 }: { x: number; y: number; w: number; h: number; tilt?: number }) {
  const cx = x + w / 2;
  const my = y + h * 0.55;
  return (
    <g transform={`rotate(${tilt} ${cx} ${y + h})`}>
      <Fg d={rrect(cx - 8, y + h - 2, 16, 22, 3)} fill={v('c-steel')} shade={[3, 3]} stroke={1.4} />
      <Fg d={rrect(x, y, w, h, 9)} fill={v('c-metal')} shade={[8, 6]} />
      <rect x={x + 7} y={y + 7} width={w - 14} height={h - 14} rx={4} fill={v('c-screen')} />
      <path
        d={`M${x + 12} ${my} q${w * 0.07} ${-h * 0.3} ${w * 0.14} 0 t${w * 0.14} 0 t${w * 0.14} 0 t${w * 0.14} 0 t${w * 0.14} 0`}
        fill="none" stroke={v('c-screen-glow')} strokeWidth={3} strokeLinecap="round" opacity={0.9}
      />
      <Line d={`M${x + 14} ${y + 16} H${x + w * 0.4} M${x + 14} ${y + h - 14} H${x + w * 0.64}`} color={v('c-star')} width={2.4} opacity={0.85} />
    </g>
  );
}

function Desk({ second }: { second: boolean }) {
  return (
    <g transform="translate(-10 0)">
      <SoftShadow cx={691} cy={600} rx={150} ry={11} />
      {second && <Monitor x={572} y={386} w={68} h={56} tilt={-4} />}
      <Monitor x={656} y={364} w={112} h={80} />
      <Fg d={rrect(648, 456, 84, 14, 6)} fill={v('c-cream')} shade={[3, 3]} stroke={1.4} />
      <Line d="M660 463 H720" color={INK_BG} width={1.6} opacity={0.5} />
      {/* tea glass in a cup-holder */}
      <Fg d="M782 446 H806 V466 Q806 472 800 472 H788 Q782 472 782 466 Z" fill={v('c-orange')} shade={[4, 3]} stroke={1.4} />
      <Line d="M806 452 Q816 454 806 464" color={INK} width={1.6} />
      {/* desk body */}
      <Fg d={rrect(570, 494, 16, 106, 5)} fill={v('c-steel')} shade={[4, 4]} stroke={1.5} />
      <Fg d={rrect(796, 494, 16, 106, 5)} fill={v('c-steel')} shade={[4, 4]} stroke={1.5} />
      <Fg d={rrect(704, 494, 92, 102, 5)} fill={v('c-wood')} shade={[6, 5]} stroke={1.6}>
        <Line d="M704 544 H796" color={INK_SOFT} width={1.6} />
      </Fg>
      <Fg d={rrect(738, 512, 24, 7, 3.5)} fill={v('c-mustard')} shade={[2, 2]} light={null} stroke={1.2} />
      <Fg d={rrect(738, 562, 24, 7, 3.5)} fill={v('c-mustard')} shade={[2, 2]} light={null} stroke={1.2} />
      <Fg d={rrect(556, 470, 270, 26, 9)} fill={v('c-wood')} shade={[0, 6]} light={[0, 3]} />
    </g>
  );
}

/** Equipment depot: hand truck with crates and a price tag. */
function Shop() {
  return (
    <g transform="translate(-16 0)">
      <SoftShadow cx={362} cy={620} rx={92} ry={9} />
      <Line d="M362 428 V526" color={INK} width={4} />
      <Fg d="M332 430 L376 430 L388 446 L376 462 L332 462 Z" fill={v('c-mustard')} shade={[4, 3]} stroke={1.5}>
        <Line d="M342 440 H360 M342 452 H354" color={INK} width={2} opacity={0.5} />
      </Fg>
      <circle cx={374} cy={446} r={3} fill={v('c-cream')} stroke={INK} strokeWidth={1.2} />
      {/* cart */}
      <Fg d="M296 518 H410 L396 590 H312 Z" fill={v('c-navy')} shade={[8, 6]} stroke={1.6}>
        <Line d="M302 546 H404 M308 568 H398" color={v('c-cream')} width={1.8} opacity={0.35} />
      </Fg>
      <Fg d={rrect(306, 474, 44, 44, 5)} fill={v('c-orange')} shade={[5, 5]} stroke={1.5}>
        <Line d="M306 490 H350 M328 474 V518" color={INK} width={1.6} opacity={0.35} />
      </Fg>
      <Fg d={rrect(354, 486, 40, 32, 5)} fill={v('c-red')} shade={[5, 4]} stroke={1.5} />
      <Star x={374} y={502} r={8} />
      <Fg d={rrect(318, 440, 36, 34, 5)} fill={v('c-window')} shade={[4, 4]} stroke={1.5} />
      <Line d="M410 518 L432 484" color={INK} width={3} />
      <Fg d={circ(328, 608, 13)} fill={v('c-steel')} shade={[4, 3]} stroke={1.5} />
      <Fg d={circ(380, 608, 13)} fill={v('c-steel')} shade={[4, 3]} stroke={1.5} />
      <circle cx={328} cy={608} r={4} fill={v('c-cream')} />
      <circle cx={380} cy={608} r={4} fill={v('c-cream')} />
    </g>
  );
}

/** Mission log on a lectern. */
function Lectern() {
  return (
    <g transform="translate(188 30)">
      <SoftShadow cx={925} cy={612} rx={74} ry={9} />
      <Fg d={rrect(908, 510, 34, 90, 4)} fill={v('c-navy')} shade={[6, 5]} stroke={1.6} />
      <Fg d={rrect(886, 596, 78, 18, 8)} fill={v('c-wood')} shade={[0, 5]} stroke={1.6} />
      <Fg d="M876 512 L974 512 L962 474 L888 474 Z" fill={v('c-wood')} shade={[7, 5]} stroke={1.6} />
      {/* open logbook */}
      <Fg d="M888 474 Q908 464 925 472 L925 434 Q908 426 888 436 Z" fill={v('c-cream')} shade={[4, 4]} stroke={1.5} />
      <Fg d="M925 472 Q942 464 962 474 L962 436 Q942 426 925 434 Z" fill={v('c-cream')} shade={[4, 4]} stroke={1.5} />
      <Line d="M896 446 Q908 441 918 445 M896 456 Q908 451 918 455 M932 445 Q944 441 954 446 M932 455 Q944 451 954 456" color={INK} width={1.4} opacity={0.35} />
      <Line d="M898 463 L903 468 L912 458" color={v('c-green')} width={3} />
      <Fg d="M940 470 V490 L946 484 L952 490 V472" fill={v('c-red')} shade={[2, 2]} light={null} stroke={1.3} />
      <Line d="M924 436 V474" color={INK} width={1.8} />
    </g>
  );
}

/** Showcase of the bureau museum: glass case on a stand, first-satellite ball inside. */
function MuseumCase() {
  return (
    <g>
      <SoftShadow cx={925} cy={618} rx={104} ry={11} />
      <Fg d={rrect(842, 540, 166, 74, 10)} fill={v('c-navy')} shade={[10, 8]}>
        <path d={rrect(856, 552, 138, 50, 6)} fill="none" stroke={v('c-cream')} strokeWidth={1.6} opacity={0.35} />
      </Fg>
      <Fg d={rrect(900, 566, 50, 20, 4)} fill={v('c-mustard')} shade={[3, 3]} stroke={1.4}>
        <Line d="M908 573 H942 M908 580 H930" color={INK} width={1.6} opacity={0.5} />
      </Fg>
      {/* glass box */}
      <Fg d={rrect(846, 420, 158, 122, 10)} fill={v('c-glass')} shade={[8, 7]} light={[3, 3]} stroke={1.8} />
      <Fg d={rrect(846, 420, 158, 14, 6)} fill={v('c-mustard')} shade={[0, 4]} light={null} stroke={1.5} />
      {/* ball satellite with four whip antennas */}
      <Fg d={rrect(874, 518, 40, 14, 5)} fill={v('c-steel')} shade={[3, 3]} stroke={1.4} />
      <Line d="M894 484 L864 454 M894 484 L866 506 M894 484 L930 458 M894 484 L932 502" color={INK} width={2.8} />
      <Fg d={circ(894, 500, 22)} fill={v('c-metal')} shade={[7, 6]} stroke={1.6} />
      {/* second exhibit: capsule */}
      <Fg d={rrect(950, 518, 40, 14, 5)} fill={v('c-steel')} shade={[3, 3]} stroke={1.4} />
      <Fg d={circ(970, 500, 17)} fill={v('c-orange')} shade={[5, 5]} stroke={1.6}>
        <circle cx={970} cy={498} r={6} fill={v('c-window')} stroke={INK} strokeWidth={1.4} />
      </Fg>
      <path d="M850 440 L880 540 M868 428 L890 484" stroke={v('c-cream')} strokeWidth={8} strokeLinecap="round" opacity={0.2} />
    </g>
  );
}

/** Assembly stand with a spacecraft on a cradle (decor). */
function AssemblyStand() {
  const hazard: ReactNode[] = [];
  for (let x = 108; x < 244; x += 20) hazard.push(<path key={x} d={`M${x} 692 l9 0 l9 -16 l-9 0 Z`} fill={v('c-mustard')} />);
  return (
    <g pointerEvents="none">
      <SoftShadow cx={175} cy={696} rx={110} ry={10} />
      <Fg d={rrect(100, 666, 150, 26, 8)} fill={v('c-navy')} shade={[6, 5]} stroke={1.6}>{hazard}</Fg>
      <Fg d={rrect(118, 534, 14, 134, 5)} fill={v('c-metal')} shade={[4, 4]} stroke={1.5} />
      <Fg d={rrect(218, 534, 14, 134, 5)} fill={v('c-metal')} shade={[4, 4]} stroke={1.5} />
      <Line d="M132 588 L160 582 M218 588 L190 582" color={INK} width={8} />
      <Line d="M132 588 L160 582 M218 588 L190 582" color={v('c-red')} width={4} />
      <Fg d={rrect(114, 524, 122, 12, 6)} fill={v('c-steel')} shade={[3, 3]} stroke={1.5} />
      <g transform="translate(175 562)"><Satellite s={0.9} /></g>
      <Line d="M232 650 Q250 668 240 690" color={INK} width={3} />
    </g>
  );
}

/* ------------------------------ upgrades ------------------------------ */

/** «plant» upgrade: floor globe of the Earth. */
function Globe() {
  return (
    <g pointerEvents="none">
      <SoftShadow cx={52} cy={668} rx={40} ry={8} />
      <Fg d={oval(52, 660, 26, 7)} fill={v('c-steel')} shade={[5, 3]} stroke={1.5} />
      <Fg d={rrect(46, 612, 12, 46, 3)} fill={v('c-steel')} shade={[3, 3]} stroke={1.4} />
      <Line d="M12 572 A40 40 0 0 0 52 614" color={INK} width={5} />
      <Earth cx={52} cy={572} r={36} />
    </g>
  );
}

/** «coffee» upgrade: samovar and glass cup-holders on a wall shelf. */
function Samovar() {
  return (
    <g pointerEvents="none">
      <Fg d={rrect(338, 398, 150, 12, 5)} fill={v('c-wood')} shade={[0, 4]} stroke={1.5} />
      <Line d="M348 410 V424 M478 410 V424" color={INK} width={3} />
      <g transform="translate(378 398)">
        <Fg d="M-6 -66 H6 V-58 H-6 Z" fill={v('c-steel')} shade={[2, 2]} light={null} stroke={1.3} />
        <Fg d="M-14 -58 Q0 -72 14 -58 Z" fill={v('c-mustard')} shade={[3, 3]} stroke={1.4} />
        <Fg d="M-16 0 C-30 -14 -26 -42 -12 -54 H12 C26 -42 30 -14 16 0 Z" fill={v('c-mustard')} shade={[6, 5]} stroke={1.6}>
          <Line d="M-30 -26 H30" color={INK} width={1.6} opacity={0.35} />
        </Fg>
        <Line d="M-24 -22 H-34 V-30" color={INK} width={4} />
        <rect x={-18} y={-4} width={36} height={4} fill={v('c-steel')} />
        <Line d="M-6 -44 Q-8 -36 -6 -30" color={v('c-cream')} width={3} opacity={0.7} />
      </g>
      <g transform="translate(440 398) scale(0.5)"><GlassMug x={0} y={0} /></g>
      <g transform="translate(472 398) scale(0.5)"><GlassMug x={0} y={0} /></g>
    </g>
  );
}

/** «chair» upgrade: contoured launch couch (ложемент). */
function CouchSeat() {
  return (
    <g transform="translate(-24 0)" pointerEvents="none">
      <SoftShadow cx={502} cy={626} rx={62} ry={9} />
      <Fg d={rrect(496, 604, 12, 20, 3)} fill={v('c-steel')} shade={[3, 3]} stroke={1.4} />
      <Fg d={oval(502, 624, 28, 6)} fill={v('c-steel')} shade={[4, 2]} stroke={1.4} />
      <Fg d="M466 524 Q502 486 538 524 L542 586 Q502 604 462 586 Z" fill={v('c-navy')} shade={[9, 7]} stroke={1.6} />
      <Fg d={rrect(480, 494, 44, 26, 12)} fill={v('c-red')} shade={[5, 4]} stroke={1.5} />
      <Line d="M472 536 Q502 516 532 536" color={v('c-red')} width={3.2} />
      <Line d="M484 540 L496 592 M520 540 L508 592" color={v('c-mustard')} width={3.4} />
      <Fg d="M452 590 Q502 568 552 590 L554 608 Q502 626 450 608 Z" fill={v('c-navy')} shade={[7, 5]} stroke={1.6} />
      <Line d="M458 598 Q502 582 546 598" color={v('c-red')} width={2.6} />
    </g>
  );
}

/** «lamp» upgrade: moon lamp on top of the archive cabinet. */
function MoonLamp() {
  return (
    <g pointerEvents="none">
      <Glow time="evening" cx={1113} cy={80} r={150} k={0.9} />
      <Fg d={rrect(1096, 96, 34, 10, 5)} fill={v('c-navy')} shade={[2, 2]} light={null} stroke={1.4} />
      <Fg d={circ(1113, 74, 24)} fill={v('c-mustard')} shade={[8, 7]} stroke={1.6}>
        <circle cx={1104} cy={68} r={5} fill={v('c-orange')} opacity={0.5} />
        <circle cx={1122} cy={82} r={4} fill={v('c-orange')} opacity={0.5} />
      </Fg>
    </g>
  );
}

function Rug({ star }: { star: boolean }) {
  if (!star) {
    return (
      <g pointerEvents="none">
        <Fg d={rrect(492, 612, 440, 58, 16)} fill={v('c-red')} shade={[0, 8]} stroke={1.6}>
          <rect x={508} y={624} width={408} height={34} rx={10} fill="none" stroke={v('c-mustard')} strokeWidth={2.6} strokeDasharray="14 10" />
        </Fg>
      </g>
    );
  }
  const stars: [number, number][] = [[500, 636], [570, 650], [640, 628], [720, 646], [790, 626], [860, 650], [910, 638]];
  return (
    <g pointerEvents="none">
      <Fg d={oval(700, 640, 350, 54)} fill={SIGN} shade={[0, 9]} stroke={1.6} />
      <ellipse cx={700} cy={640} rx={318} ry={44} fill="none" stroke={v('c-star')} strokeWidth={2.6} strokeDasharray="2 10" strokeLinecap="round" />
      <path d={stars.map(([x, y]) => `${x} ${y}`).reduce((a, p, i) => (i ? `${a} L${p}` : `M${p}`), '')} fill="none" stroke={v('c-cream')} strokeWidth={1.4} opacity={0.5} />
      {stars.map(([x, y], i) => <Spark key={i} x={x} y={y} r={i % 2 ? 8 : 11} />)}
    </g>
  );
}

/* ------------------------------ room ------------------------------ */

export function StudioRoom({ upgrades, onHotspot, labels, badges, tilt, enabled, highlight, satellites = 0 }: Props) {
  const reduce = useReducedMotion();
  const has = (u: string) => upgrades.includes(u);
  const tx = !reduce && tilt ? tilt.x : 0;
  const ty = !reduce && tilt ? tilt.y : 0;
  const back = { transform: `translate(${tx * 6}px, ${ty * 6}px)` };
  const front = { transform: `translate(${tx * -10}px, ${ty * -10}px)` };
  const hs = (id: HotspotId, children: ReactNode) => (
    <Hotspot
      id={id} label={labels[id] ?? 'Уйти домой'} onHotspot={onHotspot} badge={badges?.[id]}
      inert={enabled ? !enabled.includes(id) : false}
    >{children}</Hotspot>
  );
  return (
    <svg
      viewBox="0 0 1200 700" width="100%" role="group" aria-label="Зал бюро"
      style={{ display: 'block', height: 'auto', overflow: 'hidden', maxWidth: '100%' }}
    >
      <g style={back}>
        <Wall />
        {hs('door', <ExitDoor />)}
        {has('poster') && <g pointerEvents="none"><PosterGo /></g>}
        {hs('orders', <OrdersWindow />)}
        {hs('orbit', <OrbitScreen n={satellites} />)}
        {hs('board', <Board extra={has('taskboard')} />)}
        {hs('mail', <PneumoMail />)}
        {hs('cabinet', <Cabinet />)}
        {has('lamp') && <MoonLamp />}
        {has('coffee') && <Samovar />}
      </g>
      <g style={front}>
        <Rug star={has('rug')} />
        <AssemblyStand />
        {has('plant') && <Globe />}
        {has('chair') && <CouchSeat />}
        {hs('shop', <Shop />)}
        {hs('desk', <Desk second={has('monitor2')} />)}
        {hs('museum', <MuseumCase />)}
        {hs('reviews', <Lectern />)}
      </g>
      {highlight && <Marker id={highlight} />}
    </svg>
  );
}
