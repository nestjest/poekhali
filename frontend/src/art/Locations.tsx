import { useId } from 'react';
import type { ReactNode } from 'react';
import { INK, INK_BG, INK_SOFT, Line, Part, SoftShadow, v } from './v2/shade';
import {
  Bg, Glow, Hangar, Lattice, Ridge, Sky, Sun, TimeTint, Tree, FirTree, Veil, circ, mix, oval, rrect,
} from './v2/scene';
import type { LocationTime } from './v2/scene';
import { Bush, Cloud, Earth, GlassMug, Pendant, Rocket, Satellite, Spark, Star } from './shapes';
import './art.css';

export type LocationId = 'street' | 'reception' | 'board' | 'desk' | 'counter' | 'studio' | 'launch';
export type { LocationTime };

export const LOCATION_IDS: LocationId[] = ['street', 'reception', 'board', 'desk', 'counter', 'studio', 'launch'];
export const LOCATION_TIMES: LocationTime[] = ['morning', 'day', 'evening'];

/** viewBox 1600x900 units: writable white area of the whiteboard (DOM konspekt notes go here). */
export const BOARD_RECT = { x: 412, y: 120, width: 776, height: 400 } as const;
/** viewBox 1600x900 units: screen area of the desk monitor (light and empty; the DOM panel sits on top). */
export const MONITOR_RECT = { x: 340, y: 70, width: 920, height: 517 } as const;
/** viewBox 1600x900 units: cork board on the wall right of the monitor (DOM sticky notes go here). */
export const NOTES_RECT = { x: 1334, y: 84, width: 224, height: 372 } as const;

/** Where the launch vehicle stands on the pad (shared with LaunchScene). */
export const LAUNCH_ROCKET = { x: 800, y: 660, s: 1.5 } as const;

const CORK = mix('c-wood', 'c-mustard', 68);
/** Dark blue-violet for signs: cream text on it stays readable in both themes. */
const SIGN = mix('c-navy', 'c-ink', 62);
const ROAD = mix('c-suit', 'c-wall', 70);
const PAPER_SCREEN = mix('c-screen-glow', 'c-cream', 52);
const FONT = 'var(--font-ui)';

const Fg = Part;

/** Soft vertical panel lines on a wall. */
function WallLines({ xs, y0, y1, k = 0.22 }: { xs: number[]; y0: number; y1: number; k?: number }) {
  return <Line d={xs.map((x) => `M${x} ${y0} V${y1}`).join(' ')} color={INK_BG} width={1.4} opacity={k} />;
}

/** Window light falling across a wall or floor (two soft slanted bands). */
function LightBands({ x, y, w, h, k = 1 }: { x: number; y: number; w: number; h: number; k?: number }) {
  return (
    <g pointerEvents="none" opacity={k}>
      <path d={`M${x + w * 0.2} ${y} L${x + w * 0.62} ${y} L${x + w * 0.42} ${y + h} L${x - w * 0.2} ${y + h} Z`} fill={v('c-cream')} opacity={0.2} />
      <path d={`M${x + w * 0.7} ${y} L${x + w * 0.86} ${y} L${x + w * 0.66} ${y + h} L${x + w * 0.5} ${y + h} Z`} fill={v('c-cream')} opacity={0.14} />
    </g>
  );
}

/* ------------------------------ shared scenery ------------------------------ */

/** View out of a window: sky, sun, hills, the assembly hangar, a service tower with a rocket, trees. */
function Territory({ time, x, y, w, h }: { time: LocationTime; x: number; y: number; w: number; h: number }) {
  const g = y + h * 0.72;
  const sx = time === 'morning' ? x + w * 0.2 : x + w * 0.78;
  const sy = time === 'day' ? y + h * 0.22 : g - 36;
  return (
    <g>
      <Sky time={time} x={x} y={y} w={w} h={h} />
      <Sun time={time} cx={sx} cy={sy} r={Math.min(w, h) * 0.07} />
      <Cloud x={x + w * 0.3} y={y + h * 0.22} s={Math.min(0.6, w / 900)} delay={6} op={0.85} />
      <Ridge
        pts={[[x - 20, g - 6], [x + w * 0.25, g - 24], [x + w * 0.55, g - 4], [x + w * 0.85, g - 22], [x + w + 20, g - 8]]}
        bottom={y + h + 10} fill={mix('c-grass', 'c-sky', 62)}
      />
      <Hangar x={x + w * 0.08} y={g - 106} w={w * 0.34} h={96} />
      <Lattice x={x + w * 0.6} y={g - 150} w={24} h={140} rows={5} />
      <g transform={`translate(${x + w * 0.6 + 52} ${g - 10}) scale(0.3)`}><Rocket soft sw={5} /></g>
      <Ridge
        pts={[[x - 20, g + 8], [x + w * 0.3, g - 6], [x + w * 0.6, g + 10], [x + w + 20, g - 4]]}
        bottom={y + h + 10} fill={v('c-grass')}
      />
      <FirTree x={x + w * 0.5} y={g + 12} s={0.46} />
      <Tree x={x + w * 0.92} y={g + 14} s={0.5} seed={2} />
      <Veil k={0.5} />
    </g>
  );
}

/* ------------------------------ street: bureau gate ------------------------------ */

function Street({ time }: { time: LocationTime }) {
  const sunX = time === 'morning' ? 250 : time === 'evening' ? 1320 : 1280;
  const sunY = time === 'morning' ? 470 : time === 'evening' ? 520 : 170;
  const bars: string[] = [];
  for (let i = 0; i < 7; i++) bars.push(`M${630 + i * 26} 476 V684 M${828 + i * 26} 476 V684`);
  const panels: number[] = [];
  for (let x = 55; x < 1600; x += 110) panels.push(x);
  const tiles: string[] = [];
  for (let x = 0; x <= 1600; x += 160) tiles.push(`M${x} 700 L${x - 30} 774`);
  return (
    <g>
      <Sky time={time} x={0} y={0} w={1600} h={720} />
      <Sun time={time} cx={sunX} cy={sunY} r={time === 'day' ? 50 : 70} />
      <Cloud x={170} y={170} delay={0} />
      <Cloud x={1130} y={110} s={0.8} delay={14} />
      <Cloud x={650} y={90} s={0.55} delay={26} />
      <Cloud x={1420} y={290} s={0.62} delay={8} />

      {/* far plane: hills, hangar, towers */}
      <Ridge pts={[[-30, 560], [200, 520], [430, 548], [700, 528], [980, 552], [1250, 520], [1500, 542], [1640, 530]]} bottom={720} fill={mix('c-grass', 'c-sky', 55)} />
      <Hangar x={70} y={452} w={260} h={100} />
      <Lattice x={380} y={398} w={34} h={152} rows={6} />
      <Lattice x={1430} y={392} w={30} h={158} rows={6} />
      <g transform="translate(1498 552) scale(0.32)"><Rocket soft sw={5} /></g>
      <Ridge pts={[[-30, 604], [240, 574], [520, 598], [820, 580], [1100, 600], [1400, 574], [1640, 592]]} bottom={720} fill={v('c-grass')} />
      <Veil />

      {/* fence */}
      <rect x={-10} y={560} width={1620} height={140} fill={v('c-wall')} />
      <WallLines xs={panels} y0={576} y1={690} k={0.3} />
      <rect x={-10} y={648} width={1620} height={52} fill={v('c-wall-2')} />
      <Line d="M-10 648 H1610" color={INK_BG} width={1.6} opacity={0.5} />
      <Fg d={rrect(-20, 546, 1640, 22, 8)} fill={v('c-navy')} shade={[0, 6]} light={[0, 2]} />

      {/* stela with a rocket model (left) */}
      <SoftShadow cx={232} cy={700} rx={130} ry={12} />
      <Fg d={rrect(150, 626, 164, 74, 10)} fill={v('c-metal')} shade={[8, 6]} />
      <Fg d={rrect(176, 548, 112, 84, 8)} fill={v('c-wall')} shade={[8, 6]} />
      <Fg d="M208 548 L216 350 H248 L256 548 Z" fill={v('c-metal')} shade={[8, 6]} />
      <Fg d={circ(232, 598, 20)} fill={v('c-navy')} shade={[6, 5]} />
      <Star x={232} y={598} r={12} />
      <g transform="translate(232 352) rotate(-12) scale(0.42)"><Rocket sw={3.4} /></g>

      {/* gate */}
      <SoftShadow cx={800} cy={700} rx={380} ry={14} />
      {[540, 996].map((x) => (
        <g key={x}>
          <Fg d={rrect(x, 338, 64, 362, 8)} fill={v('c-wall')} shade={[10, 7]} />
          <Fg d={rrect(x - 10, 322, 84, 30, 9)} fill={v('c-navy')} shade={[8, 5]} />
        </g>
      ))}
      <Star x={572} y={300} r={14} />
      <Star x={1028} y={300} r={14} />
      <Fg d={rrect(604, 474, 392, 224, 4)} fill={v('c-steel')} shade={[8, 6]} light={[2, 2]}>
        <Line d={bars.join(' ')} color={INK_SOFT} width={2.2} />
        <rect x={604} y={564} width={392} height={28} fill={v('c-red')} />
        <Line d="M800 474 V698" color={INK} width={2.4} />
      </Fg>
      <Line d="M604 474 H996" color={INK} width={3} />
      <Fg d={rrect(604, 348, 392, 26, 6)} fill={v('c-navy')} shade={[0, 6]} light={[0, 2]} />
      <Fg d={circ(800, 578, 27)} fill={v('c-navy')} shade={[8, 6]} />
      <Star x={800} y={578} r={16} />

      {/* sign over the gate */}
      <Line d="M650 206 V348 M950 206 V348" color={INK} width={3.2} />
      <Fg d={rrect(480, 160, 640, 112, 28)} fill={SIGN} shade={[10, 8]} light={[3, 3]} />
      <rect x={496} y={176} width={608} height={80} rx={18} fill="none" stroke={v('c-cream')} strokeWidth={2.4} strokeDasharray="2 10" strokeLinecap="round" opacity={0.8} />
      <text
        x={800} y={218} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={800} fontSize={52} letterSpacing={3}
        fill={v('c-cream')} textLength={440} lengthAdjust="spacingAndGlyphs"
      >
        {'Бюро „Космос“'}
      </text>
      <Star x={528} y={218} r={14} />
      <Star x={1072} y={218} r={14} />

      {/* checkpoint booth (right) */}
      <SoftShadow cx={1240} cy={700} rx={150} ry={12} />
      <Fg d={rrect(1130, 504, 220, 196, 10)} fill={v('c-wall')} shade={[12, 9]} />
      <Fg d={rrect(1152, 530, 140, 90, 8)} fill={v('c-window')} shade={[7, 6]}>
        <path d="M1166 612 L1196 540 M1236 612 L1272 540" stroke={v('c-cream')} strokeWidth={9} opacity={0.5} strokeLinecap="round" />
        <path d="M1222 520 V630" stroke={INK_SOFT} strokeWidth={2} />
      </Fg>
      <Fg d={rrect(1308, 548, 30, 152, 4)} fill={v('c-navy')} shade={[6, 5]} />
      <Fg d={rrect(1140, 616, 160, 16, 6)} fill={v('c-wood')} shade={[0, 4]} />
      <Fg d="M1108 510 H1372 L1348 466 H1132 Z" fill={v('c-red')} shade={[10, 7]}>
        <Line d="M1156 466 L1168 510 M1200 466 L1212 510 M1244 466 L1256 510 M1288 466 L1300 510" color={v('c-cream')} width={9} opacity={0.5} />
      </Fg>

      {/* pavement and road */}
      <rect x={-10} y={700} width={1620} height={76} fill={v('c-floor')} />
      <Line d={tiles.join(' ')} color={INK_BG} width={1.4} opacity={0.22} />
      <Line d="M-10 700 H1610" color={INK_BG} width={2} />
      <rect x={-10} y={776} width={1620} height={134} fill={ROAD} />
      <Line d="M-10 776 H1610" color={INK_BG} width={2} />
      <Line d="M80 846 H240 M520 846 H680 M960 846 H1120 M1400 846 H1560" color={v('c-cream')} width={8} opacity={0.4} />

      {/* greenery in front of the fence */}
      <Bush x={470} y={684} rx={60} ry={26} seed={1} />
      <Bush x={1100} y={686} rx={56} ry={24} tone="c-grass" seed={3} />
      <Tree x={68} y={704} s={1.5} seed={1} />
      <FirTree x={372} y={706} s={0.95} tone="c-grass" />
      <Tree x={1546} y={706} s={1.45} tone="c-grass" seed={4} />

      {/* lamp post */}
      <Fg d={rrect(1422, 408, 14, 292, 5)} fill={v('c-navy')} shade={[5, 4]} />
      <Line d="M1429 412 Q1429 362 1380 362" color={INK} width={8} />
      <Line d="M1429 412 Q1429 362 1380 362" color={v('c-navy')} width={4.6} />
      <Fg d="M1346 360 H1396 L1384 386 H1358 Z" fill={v('c-mustard')} shade={[6, 5]} />

      <TimeTint time={time} />
      <Glow time={time} cx={800} cy={540} r={300} k={0.7} />
      <Glow time={time} cx={1240} cy={570} r={150} />
      <Glow time={time} cx={1371} cy={380} r={170} />
    </g>
  );
}

/* ------------------------------ reception: pass office ------------------------------ */

function Reception({ time }: { time: LocationTime }) {
  const tiles: string[] = [];
  for (let i = -6; i <= 6; i++) tiles.push(`M${800 + i * 90} 640 L${800 + i * 200} 900`);
  return (
    <g>
      <rect x={-10} y={-10} width={1620} height={920} fill={v('c-wall')} />
      <WallLines xs={[140, 470, 840, 1250]} y0={80} y1={470} k={0.2} />

      {/* ceiling band with twinkles */}
      <rect x={-10} y={-10} width={1620} height={84} fill={mix('c-navy', 'c-wall', 62)} />
      <Line d="M-10 74 H1610" color={INK_BG} width={2} />
      {Array.from({ length: 14 }, (_, i) => <Spark key={i} x={60 + i * 116} y={38} r={i % 2 ? 7 : 10} />)}

      {/* wainscot */}
      <rect x={-10} y={470} width={1620} height={172} fill={mix('c-navy', 'c-wall', 55)} />
      <rect x={-10} y={470} width={1620} height={14} fill={v('c-red')} opacity={0.85} />
      <Line d="M-10 470 H1610" color={INK_BG} width={2} />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={rrect(34 + i * 136, 512, 100, 104, 12)} fill="none" stroke={v('c-cream')} strokeWidth={2} opacity={0.3} />)}

      {/* floor */}
      <rect x={-10} y={640} width={1620} height={270} fill={v('c-floor')} />
      <Line d={tiles.join(' ')} color={INK_BG} width={1.4} opacity={0.18} />
      <Line d="M-10 640 H1610" color={INK_BG} width={2} />
      <rect x={-10} y={628} width={1620} height={14} fill={v('c-steel')} />
      <Fg d="M640 902 Q660 760 704 644 H896 Q940 760 960 902 Z" fill={v('c-red')} shade={[10, 8]} light={[0, 3]} stroke={1.8} ink={INK_BG}>
        <Line d="M676 902 Q700 770 722 652 M924 902 Q900 770 878 652" color={v('c-mustard')} width={4} opacity={0.9} />
      </Fg>

      {/* poster «Семь раз проверь — один раз запусти» */}
      <Bg d={rrect(566, 136, 208, 290, 12)} fill={v('c-wood')} shade={[10, 8]} />
      <Bg d={rrect(582, 152, 176, 258, 6)} fill={mix('c-navy', 'c-ink', 78)} shade={[8, 6]}>
        <path d="M582 352 H758 V410 H582 Z" fill={SIGN} />
      </Bg>
      <Spark x={612} y={186} r={9} />
      <Spark x={730} y={210} r={7} />
      <Spark x={626} y={250} r={5} />
      <Earth cx={670} cy={288} r={58} soft />
      <g transform="translate(670 296) rotate(10) scale(0.34)"><Rocket sw={5} soft /></g>
      <text x={670} y={375} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={15} fill={v('c-cream')} textLength={156} lengthAdjust="spacingAndGlyphs">СЕМЬ РАЗ ПРОВЕРЬ —</text>
      <text x={670} y={398} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={15} fill={v('c-mustard')} textLength={156} lengthAdjust="spacingAndGlyphs">ОДИН РАЗ ЗАПУСТИ</text>

      {/* wall clock */}
      <Bg d={circ(940, 190, 52)} fill={v('c-cream')} shade={[10, 8]}>
        <Line d="M940 190 V154 M940 190 L966 204" color={INK_BG} width={4} />
        <circle cx={940} cy={190} r={5} fill={INK_BG} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={940 + Math.sin(a) * 41} cy={190 - Math.cos(a) * 41} r={2.4} fill={INK_BG} opacity={0.6} />;
        })}
      </Bg>
      <Star x={940} y={140} r={7} soft />

      {/* pass desk with a glass window (left) */}
      <SoftShadow cx={330} cy={820} rx={260} ry={18} />
      <Fg d={rrect(110, 300, 440, 330, 14)} fill={mix('c-navy', 'c-wall', 70)} shade={[12, 9]} />
      <Fg d={rrect(134, 332, 392, 232, 8)} fill={v('c-glass')} shade={[8, 6]} light={[3, 3]}>
        <path d="M200 332 L166 564 M284 332 L254 564" stroke={v('c-cream')} strokeWidth={14} opacity={0.35} />
        <path d="M330 332 V564" stroke={INK_SOFT} strokeWidth={2.4} />
        <rect x={134} y={500} width={392} height={64} fill={v('c-wood-2')} opacity={0.4} />
      </Fg>
      <Fg d={rrect(110, 300, 440, 32, 14)} fill={v('c-red')} shade={[0, 7]} />
      <Star x={330} y={316} r={9} />
      <Fg d={rrect(90, 596, 480, 46, 14)} fill={v('c-wood')} shade={[0, 8]} />
      <Fg d={rrect(130, 642, 400, 172, 10)} fill={mix('c-navy', 'c-wall', 64)} shade={[10, 8]}>
        <path d={rrect(152, 666, 156, 126, 10)} fill="none" stroke={v('c-cream')} strokeWidth={2} opacity={0.3} />
        <path d={rrect(332, 666, 176, 126, 10)} fill="none" stroke={v('c-cream')} strokeWidth={2} opacity={0.3} />
      </Fg>
      {/* pass blank, stamp, tray */}
      <g transform="rotate(-5 250 580)">
        <Fg d={rrect(180, 560, 92, 34, 5)} fill={v('c-cream')} shade={[4, 4]}>
          <circle cx={198} cy={577} r={8} fill={v('c-skin-2')} />
          <Line d="M214 572 H262 M214 582 H252" color={INK_BG} width={2} opacity={0.6} />
        </Fg>
      </g>
      <Fg d={rrect(420, 570, 30, 26, 6)} fill={v('c-red')} shade={[5, 4]} />
      <Fg d={rrect(426, 550, 18, 24, 5)} fill={v('c-wood-2')} shade={[4, 3]} />
      <Fg d={rrect(472, 580, 64, 16, 5)} fill={v('c-cream')} shade={[4, 3]} />

      {/* turnstile (right) */}
      <SoftShadow cx={1210} cy={806} rx={150} ry={16} />
      <Fg d={rrect(1112, 552, 42, 250, 10)} fill={v('c-metal')} shade={[8, 6]} />
      <Fg d={rrect(1104, 528, 58, 52, 10)} fill={SIGN} shade={[8, 6]}>
        <circle cx={1133} cy={546} r={7} fill={v('c-green')} />
        <rect x={1120} y={558} width={26} height={9} rx={3} fill={v('c-cream')} />
      </Fg>
      <Fg d={rrect(1262, 612, 32, 190, 10)} fill={v('c-metal')} shade={[8, 6]} />
      <Fg d={rrect(1176, 598, 62, 204, 10)} fill={v('c-steel')} shade={[9, 7]} />
      <Line d="M1207 650 L1112 692 M1207 650 L1298 692 M1207 650 L1207 580" color={INK} width={14} />
      <Line d="M1207 650 L1112 692 M1207 650 L1298 692 M1207 650 L1207 580" color={v('c-metal')} width={8} />
      <Fg d={circ(1207, 650, 13)} fill={v('c-red')} shade={[4, 3]} />

      {/* exit door */}
      <Bg d={rrect(1384, 192, 184, 450, 12)} fill={v('c-wood')} shade={[12, 9]} />
      <Bg d={rrect(1404, 214, 144, 428, 6)} fill={mix('c-navy', 'c-wall', 70)} shade={[8, 6]} />
      <Bg d={rrect(1420, 230, 112, 150, 8)} fill={v('c-window')} shade={[6, 5]}>
        <path d="M1420 316 L1480 230 M1452 380 L1530 274" stroke={v('c-cream')} strokeWidth={9} opacity={0.5} strokeLinecap="round" />
      </Bg>
      <Bg d={circ(1424, 474, 10)} fill={v('c-mustard')} shade={[4, 3]} />
      <Star x={1476} y={440} r={21} soft />

      <Pendant x={760} len={74} />
      <TimeTint time={time} />
      <Glow time={time} cx={760} cy={130} r={330} k={0.7} />
      <Glow time={time} cx={1476} cy={330} r={160} k={0.4} />
    </g>
  );
}

/* ------------------------------ board: briefing classroom ------------------------------ */

function BoardRoom({ time }: { time: LocationTime }) {
  const R = BOARD_RECT;
  const wid = useId().replace(/:/g, '');
  return (
    <g>
      <rect x={-10} y={-10} width={1620} height={920} fill={v('c-wall')} />
      <WallLines xs={[300, 1240, 1560]} y0={40} y1={620} k={0.2} />
      <rect x={-10} y={-10} width={1620} height={46} fill={mix('c-navy', 'c-wall', 62)} />
      <Line d="M-10 36 H1610" color={INK_BG} width={2} />
      <rect x={-10} y={620} width={1620} height={112} fill={mix('c-navy', 'c-wall', 55)} />
      <rect x={-10} y={620} width={1620} height={12} fill={v('c-red')} opacity={0.85} />
      <Line d="M-10 620 H1610" color={INK_BG} width={2} />
      <rect x={-10} y={730} width={1620} height={180} fill={v('c-floor')} />
      <Line d="M-10 730 H1610" color={INK_BG} width={2} />
      <Line d={Array.from({ length: 13 }, (_, i) => `M${800 + (i - 6) * 100} 730 L${800 + (i - 6) * 240} 900`).join(' ')} color={INK_BG} width={1.4} opacity={0.16} />

      {/* window on the left: a view with hills and a tree */}
      <Bg d={rrect(52, 150, 196, 280, 14)} fill={v('c-metal')} shade={[10, 8]} />
      <defs><clipPath id={`${wid}w`}><rect x={68} y={166} width={164} height={248} rx={6} /></clipPath></defs>
      <g clipPath={`url(#${wid}w)`}>
        <Sky time={time} x={68} y={166} w={164} h={248} />
        <Sun time={time} cx={time === 'morning' ? 100 : 192} cy={time === 'day' ? 230 : 330} r={20} />
        <Ridge pts={[[60, 372], [120, 352], [180, 370], [240, 350]]} bottom={420} fill={mix('c-grass', 'c-sky', 60)} />
        <Ridge pts={[[60, 396], [140, 382], [240, 394]]} bottom={420} fill={v('c-grass')} />
        <Tree x={120} y={418} s={0.42} seed={2} />
      </g>
      <Line d="M150 166 V414 M68 290 H232" color={INK_BG} width={4} />
      <rect x={68} y={166} width={164} height={248} rx={6} fill="none" stroke={INK_BG} strokeWidth={1.8} />
      <Bg d={rrect(40, 424, 220, 20, 8)} fill={v('c-wood')} shade={[0, 5]} />
      <LightBands x={60} y={444} w={200} h={180} k={0.8} />

      {/* poster: a rocket over the Earth (right) */}
      <Bg d={rrect(1286, 150, 190, 300, 12)} fill={v('c-wood')} shade={[10, 8]} />
      <Bg d={rrect(1302, 166, 158, 268, 6)} fill={mix('c-navy', 'c-ink', 78)} shade={[8, 6]} />
      <Earth cx={1381} cy={372} r={64} soft />
      <g transform="translate(1381 340) rotate(14) scale(0.4)"><Rocket flame sw={5} soft /></g>
      <Spark x={1334} y={202} r={9} />
      <Spark x={1432} y={236} r={7} />
      <Spark x={1346} y={282} r={5} />

      {/* whiteboard (light: dark text reads on it) */}
      <SoftShadow cx={800} cy={R.y + R.height + 74} rx={460} ry={14} />
      <Fg d={rrect(R.x - 40, R.y - 40, R.width + 80, R.height + 92, 18)} fill={v('c-steel')} shade={[10, 8]} />
      <Fg d={rrect(R.x, R.y, R.width, R.height, 6)} fill={v('board-card')} shade={[8, 6]} light={[3, 3]}>
        <path d={`M${R.x + 560} ${R.y} L${R.x + 380} ${R.y + R.height} H${R.x + 450} L${R.x + 636} ${R.y} Z`} fill={v('c-window')} opacity={0.35} />
        <path d={`M${R.x + 680} ${R.y} L${R.x + 590} ${R.y + R.height} H${R.x + 614} L${R.x + 706} ${R.y} Z`} fill={v('c-window')} opacity={0.25} />
      </Fg>
      {([[R.x - 22, 'c-red'], [R.x + R.width / 2, 'c-orange'], [R.x + R.width + 22, 'c-navy']] as const).map(([x, c]) => (
        <Fg key={x} d={circ(x, R.y - 22, 9)} fill={v(c)} shade={[3, 3]} />
      ))}
      <Fg d={rrect(R.x + 90, R.y + R.height + 36, R.width - 180, 24, 9)} fill={v('c-metal')} shade={[0, 6]} />
      <Fg d={rrect(R.x + 140, R.y + R.height + 24, 74, 16, 7)} fill={v('c-navy')} shade={[3, 3]} />
      <Fg d={rrect(R.x + 232, R.y + R.height + 24, 74, 16, 7)} fill={v('c-red')} shade={[3, 3]} />
      <Fg d={rrect(R.x + R.width - 250, R.y + R.height + 22, 96, 18, 6)} fill={v('c-cream')} shade={[3, 3]} />

      {/* teaching table with a model and a globe at the edges */}
      <SoftShadow cx={800} cy={908} rx={760} ry={16} />
      <Fg d={rrect(120, 770, 1360, 46, 18)} fill={v('c-wood')} shade={[0, 9]} light={[0, 3]} />
      <Fg d={rrect(160, 816, 1280, 100, 4)} fill={v('c-wood-2')} shade={[0, 0]} light={null}>
        <Line d="M160 850 H1440" color={INK} width={1.4} opacity={0.2} />
      </Fg>
      <SoftShadow cx={290} cy={768} rx={90} ry={10} />
      <Fg d={rrect(240, 752, 100, 20, 7)} fill={v('c-steel')} shade={[4, 3]} />
      <Line d="M290 752 V722" color={INK} width={5} />
      <g transform="translate(290 684)"><Satellite s={0.9} /></g>
      <SoftShadow cx={1316} cy={768} rx={90} ry={10} />
      <Fg d={oval(1316, 764, 60, 9)} fill={v('c-steel')} shade={[6, 3]} />
      <Fg d={rrect(1308, 736, 16, 28, 4)} fill={v('c-steel')} shade={[3, 3]} />
      <Line d="M1256 690 A62 62 0 0 0 1316 748" color={INK} width={5} />
      <Earth cx={1316} cy={690} r={54} />
      <GlassMug x={1180} y={772} />

      <TimeTint time={time} />
      <Glow time={time} cx={150} cy={290} r={190} k={0.6} />
      <Glow time={time} cx={800} cy={70} r={460} k={0.35} />
    </g>
  );
}

/* ------------------------------ desk: engineer's workplace ------------------------------ */

function DeskRoom({ time }: { time: LocationTime }) {
  const M = MONITOR_RECT;
  const N = NOTES_RECT;
  const wid = useId().replace(/:/g, '');
  const keyRows = [0, 1, 2, 3].map((r) => `M${556 + (r % 2) * 8} ${786 + r * 20} H${1050 - (r % 2) * 6}`);
  return (
    <g>
      <rect x={-10} y={-10} width={1620} height={920} fill={v('c-wall')} />
      <WallLines xs={[310, 1310, 1580]} y0={40} y1={706} k={0.18} />
      <rect x={-10} y={-10} width={1620} height={42} fill={mix('c-navy', 'c-wall', 62)} />
      <Line d="M-10 32 H1610" color={INK_BG} width={2} />

      {/* window onto the assembly hangar */}
      <Bg d={rrect(30, 72, 250, 270, 14)} fill={v('c-metal')} shade={[10, 8]} />
      <defs><clipPath id={`${wid}w`}><rect x={46} y={88} width={218} height={238} rx={6} /></clipPath></defs>
      <g clipPath={`url(#${wid}w)`}>
        <Territory time={time} x={46} y={88} w={218} h={238} />
      </g>
      <Line d="M155 88 V326 M46 207 H264" color={INK_BG} width={4} />
      <rect x={46} y={88} width={218} height={238} rx={6} fill="none" stroke={INK_BG} strokeWidth={1.8} />

      {/* shelf with models */}
      <Bg d={rrect(24, 452, 270, 16, 6)} fill={v('c-wood')} shade={[0, 4]} />
      <Line d="M52 468 V492 M266 468 V492" color={INK_BG} width={3} />
      {([['c-navy', 44, 62], ['c-red', 70, 74], ['c-mustard', 96, 54], ['c-green', 122, 68]] as const).map(([c, x, h]) => (
        <Bg key={x} d={rrect(x, 452 - h, 22, h, 4)} fill={v(c)} shade={[5, 4]} />
      ))}
      <g transform="translate(212 410)"><Satellite s={0.6} soft /></g>
      <g transform="translate(264 452) scale(0.2)"><Rocket soft sw={7} /></g>

      {/* cork board for sticky notes */}
      <Fg d={rrect(N.x - 16, N.y - 16, N.width + 32, N.height + 32, 16)} fill={v('c-wood-2')} shade={[10, 8]} />
      <Fg d={rrect(N.x, N.y, N.width, N.height, 6)} fill={CORK} shade={[6, 5]} light={[2, 2]}>
        {[[40, 50], [150, 120], [70, 220], [170, 300], [30, 330], [120, 20], [190, 210], [60, 140]].map(([dx, dy]) => (
          <circle key={`${dx}${dy}`} cx={N.x + dx} cy={N.y + dy} r={3.2} fill={v('c-wood-2')} opacity={0.55} />
        ))}
      </Fg>

      {/* monitor: light pastel screen */}
      <SoftShadow cx={800} cy={712} rx={230} ry={14} />
      <Fg d="M752 640 H848 L868 700 H732 Z" fill={v('c-steel')} shade={[8, 6]} />
      <Fg d={rrect(684, 690, 232, 22, 11)} fill={v('c-steel')} shade={[0, 6]} />
      <Fg d={rrect(M.x - 34, M.y - 32, M.width + 68, M.height + 92, 28)} fill={v('c-metal')} shade={[12, 9]} light={[3, 3]} />
      <Fg d={rrect(M.x - 8, M.y - 8, M.width + 16, M.height + 16, 10)} fill={v('c-steel')} shade={[6, 5]} light={null} />
      <rect x={M.x} y={M.y} width={M.width} height={M.height} rx={5} fill={PAPER_SCREEN} />
      <path d={`M${M.x + M.width - 150} ${M.y} L${M.x + M.width - 340} ${M.y + M.height} H${M.x + M.width - 296} L${M.x + M.width - 104} ${M.y} Z`} fill={v('c-cream')} opacity={0.25} />
      <circle cx={M.x + 40} cy={M.y + M.height + 38} r={5} fill={v('c-red')} />
      <Star x={800} y={M.y + M.height + 38} r={10} />
      <circle cx={800} cy={M.y - 20} r={4} fill={INK_SOFT} />

      {/* desk surface */}
      <rect x={-10} y={706} width={1620} height={204} fill={v('c-wood')} />
      <rect x={-10} y={706} width={1620} height={16} fill={v('c-wood-2')} opacity={0.5} />
      <Line d="M-10 706 H1610" color={INK} width={2.4} />
      <Line d="M-10 790 H1610 M-10 860 H1610" color={INK_BG} width={1.4} opacity={0.2} />

      {/* keyboard, mouse */}
      <SoftShadow cx={800} cy={872} rx={300} ry={14} />
      <Fg d={rrect(532, 762, 540, 106, 18)} fill={v('c-metal')} shade={[8, 7]}>
        <Line d={keyRows.join(' ')} color={v('c-cream')} width={11} opacity={0.9} />
        <Line d="M640 868 H960" color={v('c-cream')} width={0} />
      </Fg>
      <Fg d={rrect(1140, 768, 160, 110, 22)} fill={v('c-navy')} shade={[8, 7]} />
      <Fg d={rrect(1192, 786, 56, 78, 28)} fill={v('c-cream')} shade={[5, 5]}>
        <Line d="M1192 816 H1248 M1220 786 V816" color={INK_SOFT} width={1.6} />
      </Fg>

      {/* tea in a cup-holder, headset, model rocket, notes */}
      <GlassMug x={400} y={808} steam />
      <Line d="M1380 774 Q1420 722 1460 774" color={INK} width={9} />
      <Line d="M1380 774 Q1420 722 1460 774" color={v('c-steel')} width={5} />
      <Fg d={rrect(1366, 764, 22, 34, 9)} fill={v('c-red')} shade={[4, 4]} />
      <Fg d={rrect(1452, 764, 22, 34, 9)} fill={v('c-red')} shade={[4, 4]} />
      <g transform="translate(1530 780) scale(0.3)"><Rocket sw={6} /></g>
      <Fg d={rrect(70, 806, 160, 16, 6)} fill={v('c-mustard')} shade={[3, 3]} transform="rotate(-3 150 814)" />

      <TimeTint time={time} />
      <rect x={M.x - 60} y={M.y - 50} width={M.width + 120} height={M.height + 140} rx={44} fill={v('c-screen-glow')} opacity={time === 'evening' ? 0.1 : 0.04} pointerEvents="none" />
      <Glow time={time} cx={160} cy={220} r={260} k={0.5} />
    </g>
  );
}

/* ------------------------------ counter: task window ------------------------------ */

function CounterRoom({ time }: { time: LocationTime }) {
  const wid = useId().replace(/:/g, '');
  const flags: ReactNode[] = [];
  const n = 18;
  const fw = 1128 / n;
  const palette = ['c-red', 'c-orange', 'c-mustard'];
  for (let i = 0; i < n; i++) {
    const x = 236 + fw * i;
    const sag = Math.sin((i / n) * Math.PI) * 6;
    flags.push(
      <Part
        key={i} d={`M${x + 2} ${126 + sag} h${fw - 4} l${(fw - 4) / 2} 34 z`} fill={v(palette[i % 3])} shade={[3, 3]} light={null}
        stroke={1.4} ink={INK_BG}
      />,
    );
  }
  return (
    <g>
      <rect x={-10} y={-10} width={1620} height={920} fill={v('c-wall')} />
      <WallLines xs={[190, 1410, 1560]} y0={40} y1={560} k={0.2} />
      <rect x={-10} y={560} width={1620} height={350} fill={v('c-wall-2')} />
      <Line d="M-10 560 H1610" color={INK_BG} width={2} />
      <rect x={-10} y={-10} width={1620} height={44} fill={mix('c-navy', 'c-wall', 62)} />
      <Line d="M-10 34 H1610" color={INK_BG} width={2} />

      {/* shelf with a cubesat model (left) and a framed picture */}
      <Bg d={rrect(40, 338, 150, 14, 6)} fill={v('c-wood')} shade={[0, 4]} />
      <g transform="translate(112 302)"><Satellite s={0.9} cube soft /></g>
      <Bg d={rrect(50, 150, 110, 92, 8)} fill={v('c-wood')} shade={[8, 6]} />
      <Bg d={rrect(62, 162, 86, 68, 4)} fill={mix('c-navy', 'c-ink', 78)} shade={[6, 5]} />
      <g transform="translate(105 220) scale(0.2)"><Rocket sw={8} soft /></g>
      <Spark x={76} y={178} r={6} />
      <Spark x={134} y={190} r={5} />

      {/* the window: view of the bureau's territory */}
      <defs><clipPath id={`${wid}c`}><rect x={236} y={118} width={1128} height={496} rx={6} /></clipPath></defs>
      <g clipPath={`url(#${wid}c)`}>
        <Territory time={time} x={236} y={118} w={1128} h={496} />
      </g>
      <Bg d="M206 90 H1394 V644 H206 Z M236 118 V614 H1364 V118 Z" fill={v('c-wood')} shade={[12, 10]} />
      <rect x={236} y={118} width={1128} height={496} rx={6} fill="none" stroke={INK_BG} strokeWidth={1.8} />
      <LightBands x={420} y={640} w={500} h={260} k={0.7} />
      <Line d="M236 124 Q800 152 1364 124" color={INK_BG} width={2} />
      {flags}

      {/* sign */}
      <Line d="M640 94 V66 M960 94 V66" color={INK_BG} width={3} />
      <Fg d={rrect(520, 36, 560, 76, 22)} fill={SIGN} shade={[8, 7]} />
      <rect x={534} y={48} width={532} height={52} rx={14} fill="none" stroke={v('c-cream')} strokeWidth={2.2} strokeDasharray="2 9" strokeLinecap="round" opacity={0.8} />
      <text
        x={800} y={75} textAnchor="middle" dominantBaseline="central" fontFamily={FONT} fontWeight={800} fontSize={38} letterSpacing={2}
        fill={v('c-cream')} textLength={400} lengthAdjust="spacingAndGlyphs"
      >
        Приём заданий
      </text>
      <Star x={560} y={75} r={12} />
      <Star x={1040} y={75} r={12} />

      {/* counter */}
      <Fg d="M-20 742 H1620 V920 H-20 Z" fill={v('c-wood-2')} shade={[0, 14]} light={null}>
        <Line d={[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `M${i * 220 + 40} 770 V900`).join(' ')} opacity={0.3} />
      </Fg>
      <Fg d="M-20 692 H1620 Q1630 692 1630 704 V732 Q1630 744 1620 744 H-20 Z" fill={v('c-wood')} shade={[0, 10]} light={[0, 3]} />

      {/* bell (left), lamp (right), notepad */}
      <SoftShadow cx={380} cy={694} rx={80} ry={11} />
      <Fg d="M326 686 C326 628 434 628 434 686 Z" fill={v('c-mustard')} shade={[8, 6]} />
      <Fg d={rrect(308, 680, 144, 16, 7)} fill={v('c-wood-2')} shade={[0, 4]} light={null} />
      <circle cx={380} cy={630} r={7} fill={v('c-mustard')} stroke={INK} strokeWidth={1.6} />
      <SoftShadow cx={1316} cy={694} rx={70} ry={10} />
      <Fg d={rrect(1274, 676, 80, 16, 8)} fill={v('c-steel')} shade={[0, 5]} />
      <Line d="M1312 678 L1342 622 L1302 568" color={INK} width={9} />
      <Line d="M1312 678 L1342 622 L1302 568" color={v('c-steel')} width={4} />
      <Fg d="M1266 582 L1338 550 L1352 586 Z" fill={v('c-red')} shade={[7, 5]} />
      <SoftShadow cx={1120} cy={698} rx={110} ry={9} />
      <Fg d="M1052 672 L1176 664 L1184 688 L1060 696 Z" fill={v('c-cream')} shade={[3, 4]} />

      <TimeTint time={time} />
      <Glow time={time} cx={1480} cy={250} r={320} k={0.7} />
      <Glow time={time} cx={1310} cy={600} r={170} k={0.7} />
      <Glow time={time} cx={800} cy={620} r={430} k={0.2} />
    </g>
  );
}

/* ------------------------------ launch: pad ------------------------------ */

function Tower({ x, side }: { x: number; side: 1 | -1 }) {
  const arm = (y: number, len: number, c: string) => (
    <Fg d={`M${x + side * 52} ${y} H${x + side * 52 + len * -side} L${x + side * 52 + (len - 26) * -side} ${y + 22} H${x + side * 52} Z`} fill={v(c)} shade={[0, 6]} light={[0, 2]} stroke={1.6} ink={INK_BG} />
  );
  return (
    <g>
      <Lattice x={x} y={290} w={52} h={390} rows={9} />
      {arm(372, 150, 'c-red')}
      {arm(484, 126, 'c-orange')}
      <Line d={`M${x + 26} 290 V250`} color={INK_BG} width={4} />
      <circle cx={x + 26} cy={246} r={7} fill={v('c-red')} stroke={INK_BG} strokeWidth={1.6} />
    </g>
  );
}

/** Launch pad at sunset: steppe, service towers, concrete table. The rocket itself is optional. */
export function LaunchBackdrop({ time = 'evening', withRocket = true }: { uid?: string; time?: LocationTime; withRocket?: boolean }) {
  const sunX = time === 'morning' ? 300 : time === 'day' ? 1250 : 1240;
  const sunY = time === 'day' ? 190 : 590;
  const R = LAUNCH_ROCKET;
  const grass: ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const x = 60 + i * 130 + (i % 3) * 18;
    const y = 780 + (i % 3) * 36;
    grass.push(<path key={i} d={`M${x} ${y} q-4 -14 -8 -18 M${x} ${y} q0 -14 0 -22 M${x} ${y} q4 -14 8 -18`} stroke={INK_BG} strokeWidth={2.4} strokeLinecap="round" opacity={0.4} fill="none" />);
  }
  return (
    <g>
      <Sky time={time} x={0} y={0} w={1600} h={700} />
      <Sun time={time} cx={sunX} cy={sunY} r={time === 'day' ? 54 : 88} />
      <Cloud x={200} y={200} delay={0} op={0.85} />
      <Cloud x={1150} y={130} s={0.8} delay={12} op={0.85} />
      <Cloud x={680} y={290} s={0.5} delay={20} op={0.75} />
      <Cloud x={1420} y={340} s={0.6} delay={5} op={0.75} />

      {/* steppe */}
      <Ridge pts={[[-30, 640], [260, 616], [560, 640], [900, 624], [1240, 640], [1640, 622]]} bottom={720} fill={mix('c-grass', 'c-sky', 58)} />
      <Hangar x={90} y={540} w={230} h={92} />
      <Veil />
      <Ridge pts={[[-30, 676], [300, 650], [640, 672], [980, 656], [1300, 674], [1640, 652]]} bottom={910} fill={v('c-grass')} />
      <FirTree x={400} y={684} s={0.6} tone="c-tree" />
      <FirTree x={1270} y={680} s={0.52} tone="c-grass" />
      <Tree x={1490} y={690} s={0.6} seed={3} />
      {grass}

      {/* pad: trench, table, service towers */}
      <Tower x={462} side={1} />
      <Tower x={1086} side={-1} />
      <Fg d="M520 906 L584 706 H1016 L1080 906 Z" fill={v('c-wall')} shade={[10, 8]} light={[0, 3]} stroke={1.8} ink={INK_BG}>
        <Line d="M560 770 H1040 M540 840 H1060" color={INK_BG} width={1.4} opacity={0.3} />
        <path d="M570 906 L624 750 H976 L1030 906 Z" fill={v('c-screen')} opacity={0.2} />
      </Fg>
      <Fg d={rrect(520, 684, 560, 40, 10)} fill={v('c-metal')} shade={[0, 8]} stroke={1.8} ink={INK_BG} />
      <Fg d={rrect(640, 662, 320, 26, 8)} fill={v('c-steel')} shade={[0, 6]} stroke={1.8} ink={INK_BG} />

      {withRocket && (
        <g>
          <SoftShadow cx={R.x} cy={R.y + 4} rx={170} ry={16} />
          <g transform={`translate(${R.x} ${R.y}) scale(${R.s})`}>
            <Rocket sw={1.5} />
          </g>
          {/* two lower cradle arms in front of the rocket */}
          <Fg d="M690 604 L716 562 H760 L752 624 Z" fill={v('c-metal')} shade={[6, 5]} stroke={1.8} ink={INK_BG} />
          <Fg d="M910 604 L884 562 H840 L848 624 Z" fill={v('c-metal')} shade={[6, 5]} stroke={1.8} ink={INK_BG} />
        </g>
      )}

      <TimeTint time={time} />
      <Glow time={time} cx={sunX} cy={sunY} r={320} k={0.3} color="c-orange" />
    </g>
  );
}

/* ------------------------------ public ------------------------------ */

export function Location({
  id, time = 'day', children,
}: { id: LocationId; time?: LocationTime; children?: ReactNode }) {
  if (id === 'studio') return null;
  return (
    <svg
      viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"
      aria-hidden="true" focusable="false" style={{ display: 'block' }}
    >
      {id === 'street' && <Street time={time} />}
      {id === 'reception' && <Reception time={time} />}
      {id === 'board' && <BoardRoom time={time} />}
      {id === 'desk' && <DeskRoom time={time} />}
      {id === 'counter' && <CounterRoom time={time} />}
      {id === 'launch' && <LaunchBackdrop time={time} />}
      {children}
    </svg>
  );
}

/** Kept for components that draw a backdrop outside Location (the v2 sky carries its own gradients, so this is empty). */
export function LocationDefs(_props: { uid: string; time: LocationTime }) {
  return <defs />;
}
