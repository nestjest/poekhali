import type { ReactNode } from 'react';
import { Rocket, Spark } from './shapes';
import { INK, Line, Part, SoftShadow, v } from './v2/shade';
import { circ, mix, oval, rrect } from './v2/scene';
import './art.css';

export type ExhibitArtId = 'sputnik' | 'vostok' | 'lunokhod' | 'station' | 'rocket' | 'glonass' | 'cubesat' | 'engine';

export const EXHIBIT_ART_IDS: ExhibitArtId[] = ['sputnik', 'vostok', 'lunokhod', 'station', 'rocket', 'glonass', 'cubesat', 'engine'];

export const EXHIBIT_ART_NAMES: Record<ExhibitArtId, string> = {
  sputnik: 'Первый спутник',
  vostok: 'Космический корабль',
  lunokhod: 'Самоходный аппарат',
  station: 'Орбитальная станция',
  rocket: 'Ракета',
  glonass: 'Навигационный спутник',
  cubesat: 'Кубсат',
  engine: 'Ракетный двигатель',
};

/** Solar panel wing with a cell grid. */
function Panel({ x, y, w, h, cols = 3, rows = 2 }: { x: number; y: number; w: number; h: number; cols?: number; rows?: number }) {
  const lines: string[] = [];
  for (let i = 1; i < cols; i++) lines.push(`M${x + (w / cols) * i} ${y} V${y + h}`);
  for (let j = 1; j < rows; j++) lines.push(`M${x} ${y + (h / rows) * j} H${x + w}`);
  return (
    <Part d={rrect(x, y, w, h, 3)} fill={v('c-navy')} shade={[5, 4]} stroke={1.5}>
      <path d={lines.join(' ')} stroke={v('c-window')} strokeWidth={1.5} opacity={0.8} />
    </Part>
  );
}

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <Part d={circ(cx, cy, r)} fill={v('c-steel')} shade={[r * 0.3, r * 0.25]} stroke={1.5}>
      <circle cx={cx} cy={cy} r={r * 0.4} fill={v('c-metal')} />
      <path d={`M${cx - r} ${cy} H${cx + r} M${cx} ${cy - r} V${cy + r}`} stroke={INK} strokeWidth={1.2} opacity={0.3} />
    </Part>
  );
}

const Stem = ({ y0, y1 }: { y0: number; y1: number }) => (
  <>
    <Line d={`M100 ${y0} V${y1}`} color={INK} width={7} />
    <Line d={`M100 ${y0} V${y1}`} color={v('c-steel')} width={3.4} />
  </>
);

function Item({ id }: { id: ExhibitArtId }): ReactNode {
  switch (id) {
    case 'sputnik':
      return (<>
        <Stem y0={126} y1={158} />
        <Line d="M96 94 L20 52 M96 100 L10 92 M96 106 L12 124 M96 112 L22 156" color={INK} width={3.6} />
        <Line d="M96 94 L20 52 M96 100 L10 92 M96 106 L12 124 M96 112 L22 156" color={v('c-metal')} width={1.5} />
        <Part d={circ(108, 100, 30)} fill={v('c-metal')} shade={[9, 8]} stroke={1.8}>
          <path d="M70 100 H146 M108 62 V138" stroke={INK} strokeWidth={1.4} opacity={0.25} />
          <path d="M90 84 Q98 74 112 72" fill="none" stroke={v('c-cream')} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
        </Part>
      </>);
    case 'vostok':
      return (<>
        <Part d="M82 124 H118 L130 152 H70 Z" fill={v('c-cream')} shade={[8, 6]} stroke={1.7}>
          <rect x={60} y={138} width={80} height={12} fill={v('c-red')} />
        </Part>
        <Part d="M86 152 L80 158 H120 L114 152 Z" fill={v('c-steel')} shade={[3, 3]} stroke={1.5} />
        <Line d="M70 128 L56 112 M130 128 L144 112" color={INK} width={3.6} />
        <Part d={circ(100, 88, 36)} fill={v('c-orange')} shade={[11, 9]} stroke={1.8}>
          <path d="M60 104 Q100 126 140 104" fill="none" stroke={INK} strokeWidth={1.6} opacity={0.3} />
          <path d="M80 62 Q90 54 102 53" fill="none" stroke={v('c-cream')} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
        </Part>
        <Part d={circ(100, 80, 11)} fill={v('c-window')} shade={[3, 3]} stroke={1.6} />
        <Line d="M100 52 V36 M94 36 H106" color={INK} width={2.6} />
      </>);
    case 'lunokhod':
      return (<>
        <Part d="M54 100 L36 62 L108 62 L120 100 Z" fill={v('c-navy')} shade={[7, 6]} stroke={1.6}>
          <path d="M54 100 L36 62 M72 100 L58 62 M90 100 L80 62 M108 100 L102 62" stroke={v('c-window')} strokeWidth={1.6} opacity={0.75} />
        </Part>
        <Part d="M46 100 H158 L148 140 H58 Z" fill={v('c-metal')} shade={[10, 8]} stroke={1.7}>
          <rect x={104} y={106} width={36} height={18} rx={4} fill={v('c-orange')} />
        </Part>
        <circle cx={152} cy={112} r={6} fill={v('c-window')} stroke={INK} strokeWidth={1.4} />
        <Line d="M60 100 V86 M54 86 H66" color={INK} width={2.6} />
        {[56, 86, 116, 146].map((x) => <Wheel key={`b${x}`} cx={x + 6} cy={138} r={10} />)}
        {[52, 84, 116, 148].map((x) => <Wheel key={`f${x}`} cx={x} cy={148} r={11} />)}
      </>);
    case 'station':
      return (<>
        <Stem y0={150} y1={158} />
        <Line d="M60 104 H140 M100 60 V140" color={INK} width={5} />
        <Panel x={8} y={50} w={44} h={26} />
        <Panel x={8} y={90} w={44} h={26} />
        <Panel x={148} y={50} w={44} h={26} />
        <Panel x={148} y={90} w={44} h={26} />
        <Line d="M52 63 H62 M52 103 H62 M138 63 H148 M138 103 H148" color={INK} width={2.6} />
        <Part d={rrect(52, 92, 96, 24, 11)} fill={v('c-cream')} shade={[6, 5]} stroke={1.7} />
        <Part d={rrect(86, 52, 28, 96, 13)} fill={v('c-metal')} shade={[7, 6]} stroke={1.7}>
          <rect x={80} y={90} width={40} height={28} fill={v('c-orange')} />
        </Part>
        <circle cx={100} cy={104} r={6} fill={v('c-window')} stroke={INK} strokeWidth={1.4} />
        <Part d={circ(100, 150, 9)} fill={v('c-red')} shade={[3, 3]} stroke={1.5} />
        <Part d={circ(100, 50, 6)} fill={v('c-red')} shade={[2, 2]} stroke={1.4} />
      </>);
    case 'rocket':
      return (
        <g transform="translate(100 160) scale(0.46)"><Rocket sw={3.6} /></g>
      );
    case 'glonass':
      return (<>
        <Stem y0={140} y1={158} />
        <Line d="M70 92 H82 M118 92 H130" color={INK} width={4} />
        <Panel x={10} y={68} w={60} h={48} cols={4} rows={3} />
        <Panel x={130} y={68} w={60} h={48} cols={4} rows={3} />
        <Part d={rrect(80, 56, 40, 84, 7)} fill={v('c-mustard')} shade={[9, 7]} stroke={1.8}>
          <Line d="M80 80 H120 M80 104 H120" color={INK} width={1.4} opacity={0.3} />
          <rect x={80} y={56} width={40} height={14} fill={v('c-navy')} />
        </Part>
        <Part d={rrect(84, 120, 32, 16, 4)} fill={v('c-metal')} shade={[4, 3]} stroke={1.4} />
        <Part d={oval(100, 46, 22, 8)} fill={v('c-metal')} shade={[5, 3]} stroke={1.5} />
        <Line d="M100 38 V26" color={INK} width={2.6} />
      </>);
    case 'cubesat':
      return (<>
        <Stem y0={142} y1={158} />
        <Part d="M78 52 L130 52 L130 138 L78 138 Z" fill={v('c-navy')} shade={[8, 6]} stroke={1.7}>
          <path d="M78 80 H130 M78 108 H130 M104 52 V138" stroke={v('c-window')} strokeWidth={1.6} opacity={0.7} />
        </Part>
        <Part d="M130 52 L146 40 L146 126 L130 138 Z" fill={v('c-orange')} shade={[5, 4]} stroke={1.7} />
        <Part d="M78 52 L94 40 L146 40 L130 52 Z" fill={v('c-metal')} shade={[4, 3]} stroke={1.7} />
        <Line d="M112 40 V20 M104 20 H120" color={INK} width={3} />
        <circle cx={112} cy={18} r={3.4} fill={v('c-red')} stroke={INK} strokeWidth={1.4} />
        <Part d={circ(104, 124, 5)} fill={v('c-cream')} shade={[2, 2]} stroke={1.4} />
      </>);
    case 'engine':
      return (<>
        <Line d="M100 52 V30 M84 30 H116" color={INK} width={4.4} />
        <Part d={rrect(136, 64, 28, 44, 8)} fill={v('c-steel')} shade={[6, 5]} stroke={1.6} />
        <Line d="M136 78 H124 Q112 78 112 90 M136 98 H128" color={INK} width={4.4} />
        <Line d="M136 78 H124 Q112 78 112 90 M136 98 H128" color={v('c-metal')} width={1.8} />
        <Part d={rrect(42, 72, 22, 34, 8)} fill={v('c-steel')} shade={[5, 4]} stroke={1.6} />
        <Line d="M64 86 H78" color={INK} width={4.4} />
        <Part d="M76 52 H124 L128 74 H72 Z" fill={v('c-metal')} shade={[7, 5]} stroke={1.7} />
        <Part d="M72 74 H128 C132 100 142 126 150 152 H50 C58 126 68 100 72 74 Z" fill={v('c-orange')} shade={[12, 9]} stroke={1.8}>
          <path d="M84 76 C84 104 76 130 66 152 M100 76 V152 M116 76 C116 104 124 130 134 152" fill="none" stroke={INK} strokeWidth={1.4} opacity={0.3} />
        </Part>
        <Line d="M54 142 H146" color={INK} width={3} opacity={0.7} />
        <Part d={oval(100, 152, 50, 5)} fill={v('c-red')} shade={[0, 2]} light={null} stroke={1.5} />
      </>);
  }
}

/** Museum exhibit on a display stand (viewBox 200x200, pastel cel-shaded, no inscriptions). */
export function ExhibitArt({ id, size = 120 }: { id: ExhibitArtId; size?: number }) {
  return (
    <svg
      viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={EXHIBIT_ART_NAMES[id]}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <circle cx={100} cy={96} r={86} fill={v('c-mustard')} opacity={0.18} />
      <Spark x={22} y={30} r={7} />
      <Spark x={180} y={40} r={5} />
      <Spark x={176} y={122} r={4} />
      <SoftShadow cx={100} cy={190} rx={92} ry={9} />
      <Item id={id} />
      {/* display stand */}
      <Part d={rrect(36, 168, 128, 20, 8)} fill={mix('c-navy', 'c-ink', 62)} shade={[7, 5]} stroke={1.6}>
        <rect x={46} y={174} width={108} height={8} rx={4} fill="none" stroke={v('c-cream')} strokeWidth={1.6} strokeDasharray="2 7" strokeLinecap="round" opacity={0.8} />
      </Part>
      <Part d={rrect(26, 156, 148, 14, 6)} fill={v('c-metal')} shade={[0, 4]} light={[0, 2]} stroke={1.6} />
    </svg>
  );
}
