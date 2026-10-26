// Style v2 scene (prototype): the task window. The back plane is muted (softer outlines, lighter, a fade
// veil) so the character in front reads clearly; the counter in the foreground has full contrast.
import { useId, type ReactNode } from 'react';
import type { Mood } from '../Character';
import { CharacterV2Art, type V2Id } from './CharacterV2';
import { INK_BG, Line, Part, SoftShadow, v } from './shade';

/** Background part: same cel-shading, softer outline. */
const Bg = (p: { d: string; fill: string; shade?: [number, number]; children?: ReactNode }) =>
  <Part d={p.d} fill={p.fill} shade={p.shade ?? [10, 8]} light={[3, 3]} stroke={2} ink={INK_BG}>{p.children}</Part>;

const rect = (x: number, y: number, w: number, h: number, r = 10) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

function Back() {
  const id = useId().replace(/:/g, '');
  return (
    <g>
      <defs>
        <radialGradient id={`glow${id}`}>
          <stop offset="0%" stopColor={v('c-mustard')} stopOpacity={0.55} />
          <stop offset="100%" stopColor={v('c-mustard')} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* wall + wainscot */}
      <rect x={0} y={0} width={1600} height={900} fill={v('c-wall')} />
      {[200, 520, 1500].map((x) => <Line key={x} d={`M${x} 0 V560`} color={INK_BG} opacity={0.25} />)}
      <rect x={0} y={560} width={1600} height={340} fill={v('c-wall-2')} />
      <Line d="M0 560 H1600" width={2} color={INK_BG} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Line key={i} d={`M${i * 200 + 100} 575 V900`} color={INK_BG} opacity={0.3} />)}

      {/* poster on the left: a rocket, no inscriptions */}
      <Bg d={rect(92, 120, 250, 330, 6)} fill={v('c-poster')}>
        <path d="M92 450 L342 300 L342 450 Z" fill={v('c-red')} opacity={0.35} />
      </Bg>
      <Part d="M217 170 C246 200 252 260 244 330 L190 330 C182 260 188 200 217 170 Z" fill={v('c-cream')} shade={[8, 6]} stroke={2} ink={INK_BG} />
      <Part d="M190 300 L166 344 L194 334 Z" fill={v('c-red')} shade={[4, 4]} light={null} stroke={2} ink={INK_BG} />
      <Part d="M244 300 L268 344 L240 334 Z" fill={v('c-red')} shade={[4, 4]} light={null} stroke={2} ink={INK_BG} />
      <circle cx={217} cy={240} r={14} fill={v('c-window')} stroke={INK_BG} strokeWidth={2} />
      <path d="M200 334 Q217 400 234 334 Z" fill={v('c-orange')} opacity={0.85} />
      {[[130, 160], [310, 200], [140, 360], [300, 400]].map(([x, y]) => (
        <path key={`${x}`} d={`M${x} ${y - 9} L${x + 3} ${y - 3} L${x + 9} ${y} L${x + 3} ${y + 3} L${x} ${y + 9} L${x - 3} ${y + 3} L${x - 9} ${y} L${x - 3} ${y - 3} Z`} fill={v('c-mustard')} />
      ))}

      {/* sign over the window */}
      
      

      {/* the task window: frame + far room inside */}
      <Bg d={rect(860, 128, 720, 470, 16)} fill={v('c-wood')} shade={[12, 10]} />
      <rect x={890} y={158} width={660} height={410} rx={8} fill={v('c-window-far')} stroke={INK_BG} strokeWidth={2} />
      <g opacity={0.55} transform="translate(200 20)">
        <Line d="M700 300 H1440 M700 420 H1440" width={6} color={v('c-wood-2')} />
        <rect x={730} y={240} width={70} height={60} rx={6} fill={v('c-metal')} />
        <rect x={830} y={250} width={50} height={50} rx={4} fill={v('c-navy')} />
        <circle cx={1300} cy={262} r={34} fill={v('c-window')} />
        <rect x={1360} y={350} width={60} height={70} rx={6} fill={v('c-red')} />
        <rect x={720} y={360} width={110} height={60} rx={6} fill={v('c-cream')} />
      </g>

      {/* hanging lamp + evening glow (only in the dark theme: --c-glow) */}

      <Line d="M40 270 H70" width={4} color={INK_BG} />
      <Part d="M30 230 C30 206 110 206 110 230 L118 252 L22 252 Z" fill={v('c-red')} shade={[8, 6]} stroke={2} ink={INK_BG} />
      <ellipse cx={70} cy={256} rx={20} ry={7} fill={v('c-cream')} />

      {/* fade veil: pushes the back plane away */}
      <rect x={0} y={0} width={1600} height={900} fill={v('c-bg-fade')} />
    </g>
  );
}

function Counter() {
  return (
    <g>
      <Part d="M-20 750 H1620 V920 H-20 Z" fill={v('c-wood-2')} shade={[0, 14]} light={null}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Line key={i} d={`M${i * 220 + 40} 770 V900`} opacity={0.35} />)}
      </Part>
      <Part d="M-20 702 H1620 Q1630 702 1630 714 V742 Q1630 754 1620 754 H-20 Z" fill={v('c-wood')} shade={[0, 10]} light={[0, 3]} />
      {/* sign on the counter front */}
      <Part d={rect(1020, 790, 420, 70, 12)} fill={v('c-navy')} shade={[6, 6]} />
      <text x={1230} y={836} textAnchor="middle" fontFamily="var(--font-ui)" fontWeight={800} fontSize={30} letterSpacing={3} fill={v('c-cream')}>ПРИЁМ ЗАДАНИЙ</text>
      <g transform="translate(0 50)">{/* bell */}
      <SoftShadow cx={1160} cy={656} rx={60} ry={10} />
      <Part d="M1126 652 C1126 614 1194 614 1194 652 Z" fill={v('c-mustard')} shade={[6, 4]} />
      <Part d="M1112 648 H1208 V658 H1112 Z" fill={v('c-wood-2')} shade={[0, 4]} light={null} stroke={2} />
      <circle cx={1160} cy={612} r={6} fill={v('c-mustard')} stroke={v('c-ink')} strokeWidth={2} />
      {/* cubesat model */}
      <SoftShadow cx={1390} cy={656} rx={90} ry={12} />
      <Part d="M1356 560 H1424 V652 H1356 Z" fill={v('c-metal')} shade={[8, 6]}>
        <rect x={1366} y={572} width={48} height={30} fill={v('c-navy')} opacity={0.8} />
      </Part>
      <Part d="M1290 584 H1350 V628 H1290 Z" fill={v('c-navy')} shade={[5, 4]} stroke={2}>
        <Line d="M1310 584 V628 M1330 584 V628 M1290 606 H1350" opacity={0.5} />
      </Part>
      <Part d="M1430 584 H1490 V628 H1430 Z" fill={v('c-navy')} shade={[5, 4]} stroke={2}>
        <Line d="M1450 584 V628 M1470 584 V628 M1430 606 H1490" opacity={0.5} />
      </Part>
      {/* papers «ТЗ» */}
      <SoftShadow cx={980} cy={660} rx={80} ry={8} />
      <Part d="M920 640 L1040 632 L1046 650 L926 658 Z" fill={v('c-cream')} shade={[3, 4]} stroke={2} />
    </g>
      </g>
  );
}

/** The whole scene, 1600×900, slice. The customer stands behind the counter. */
/** Evening only (--c-glow is 0 in the light theme): a warm pool of lamp light over the back wall and the speaker. */
function LampLight() {
  const id = useId().replace(/:/g, '');
  return (
    <g style={{ opacity: 'var(--c-glow)' }} pointerEvents="none">
      <defs>
        <radialGradient id={`lamp${id}`}>
          <stop offset="0%" stopColor={v('c-mustard')} stopOpacity={0.55} />
          <stop offset="55%" stopColor={v('c-orange')} stopOpacity={0.18} />
          <stop offset="100%" stopColor={v('c-orange')} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={90} cy={250} r={720} fill={`url(#lamp${id})`} />
    </g>
  );
}

export function CounterV2({ who, mood }: { who: V2Id; mood: Mood }) {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      <Back />
      <g transform="translate(110 20) scale(3.05)">
        <CharacterV2Art id={who} mood={mood} drop />
      </g>
      <LampLight />
      <Counter />
    </svg>
  );
}
