// Player pass photos in style v2: four different young faces «по плечи» on a pastel disc.
// One outline along the silhouette (head + hair + shoulders), thin inner seams, cel shading from the upper-left.
import { useId, type ReactNode } from 'react';
import { INK, INK_BG, INK_SOFT, Line, Part, SEAM, Silhouette, v } from './v2/shade';
import './art.css';

export type AvatarId = 'a1' | 'a2' | 'a3' | 'a4';
export const AVATAR_IDS: AvatarId[] = ['a1', 'a2', 'a3', 'a4'];

/** Mirrors an absolute path (M L C Q Z) about x = 60. */
const mir = (d: string) => {
  let i = 0;
  return d.replace(/[MLCQZ]|-?\d+(?:\.\d+)?/g, (t) => {
    if (/[A-Z]/.test(t)) { i = 0; return t; }
    return String(i++ % 2 === 0 ? 120 - Number(t) : Number(t));
  });
};
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

interface Look {
  bg: string; skin: string; hair: string; outfit: string;
  head: string; ear: string; neck: string; body: string;
  hairBack: string[]; hairFront: string[];
  eyeDX: number; eyeY: number; browW: number; blush: boolean; freckles?: boolean;
  mouth: 'grin' | 'smile' | 'smirk' | 'soft';
  glasses?: boolean;
  /** Painted over the shoulders, before the head (collar, hood, straps). */
  collar: ReactNode;
  /** Painted over the head (headphones, hair clips). */
  accent?: ReactNode;
}

const LOOKS: Record<AvatarId, Look> = {
  // a1: a round-faced boy, tousled brown hair, orange hoodie.
  a1: {
    bg: v('c-sky'), skin: v('c-skin-1'), hair: v('c-hair-dark'), outfit: v('c-orange'),
    head: 'M36 56 C35 38 46 27 60 27 C74 27 85 38 84 56 C83 72 73 84 60 85 C47 84 37 72 36 56 Z',
    ear: 'M37 55 C30 53 29 64 35 67 C38 68 39 64 39 61 Z',
    neck: 'M52 72 L52 94 Q60 99 68 94 L68 72 Z',
    body: 'M10 120 C10 102 24 92 44 88 C54 86 66 86 76 88 C96 92 110 102 110 120 Z',
    hairBack: [],
    hairFront: ['M34 52 C30 36 38 20 54 17 C58 11 68 11 72 18 C86 20 92 38 86 52 C84 44 80 40 74 38 C70 44 64 42 60 38 C56 44 48 44 44 40 C40 42 36 46 34 52 Z'],
    eyeDX: 11, eyeY: 58, browW: 2, blush: true, freckles: true, mouth: 'grin',
    collar: (
      <>
        <Part d="M36 94 C42 84 78 84 84 94 C80 104 40 104 36 94 Z" fill={v('c-orange')} shade={[3, 4]} stroke={SEAM} ink={INK_SOFT} />
        <Line d="M52 98 L50 112 M68 98 L70 112" width={1.6} color={INK_SOFT} />
      </>
    ),
  },
  // a2: a girl with two curly puffs, deep skin tone, mustard sweater.
  a2: {
    bg: v('c-sky-2'), skin: v('c-skin-3'), hair: v('c-hair-dark'), outfit: v('c-mustard'),
    head: 'M35 57 C34 39 46 29 60 29 C74 29 86 39 85 57 C84 73 74 86 60 87 C46 86 36 73 35 57 Z',
    ear: 'M36 58 C30 56 30 66 35 68 C37 68 38 65 38 62 Z',
    neck: 'M52 74 L52 96 Q60 101 68 96 L68 74 Z',
    body: 'M14 120 C14 104 26 94 44 90 C54 88 66 88 76 90 C94 94 106 104 106 120 Z',
    hairBack: [ellipse(28, 38, 15, 14), ellipse(92, 38, 15, 14), 'M32 56 C28 32 40 16 60 16 C80 16 92 32 88 56 Z'],
    hairFront: ['M34 54 C30 32 42 18 60 18 C78 18 90 32 86 54 C84 44 78 36 70 34 C66 40 56 40 52 34 C44 36 38 44 34 54 Z'],
    eyeDX: 11, eyeY: 59, browW: 2, blush: true, mouth: 'smile',
    collar: <Part d="M46 92 C52 100 68 100 74 92 C70 104 50 104 46 92 Z" fill={v('c-mustard')} shade={[2, 3]} light={null} stroke={SEAM} ink={INK_SOFT} />,
    accent: (
      <>
        <Part d={ellipse(40, 28, 3.4, 3)} fill={v('c-red')} shade={[1, 1]} light={null} stroke={SEAM} ink={INK_SOFT} />
        <Part d={ellipse(80, 28, 3.4, 3)} fill={v('c-red')} shade={[1, 1]} light={null} stroke={SEAM} ink={INK_SOFT} />
      </>
    ),
  },
  // a3: a girl with long straight hair, a side fringe and round glasses, green sweater.
  a3: {
    bg: v('c-brick'), skin: v('c-skin-2'), hair: v('c-hair-brown'), outfit: v('c-green'),
    head: 'M37 56 C36 38 47 28 60 28 C73 28 84 38 83 56 C82 72 73 84 60 86 C47 84 38 72 37 56 Z',
    ear: 'M38 56 C33 55 33 63 37 65 Z',
    neck: 'M53 72 L53 94 Q60 99 67 94 L67 72 Z',
    body: 'M12 120 C12 102 26 92 44 88 C54 86 66 86 76 88 C94 92 108 102 108 120 Z',
    hairBack: ['M32 52 C30 28 42 14 60 14 C78 14 90 28 88 52 L92 98 C82 102 76 96 76 88 L44 88 C44 96 38 102 28 98 Z'],
    hairFront: ['M34 58 C30 34 42 19 60 19 C78 19 90 34 86 58 C85 48 80 40 70 36 C66 44 54 50 44 52 C40 54 36 56 34 58 Z'],
    eyeDX: 11, eyeY: 60, browW: 1.8, blush: true, glasses: true, mouth: 'soft',
    collar: (
      <>
        <Part d="M44 90 L60 106 L76 90 L70 86 L60 96 L50 86 Z" fill={v('c-cream')} shade={[2, 3]} light={null} stroke={SEAM} ink={INK_SOFT} />
        <Line d="M60 106 L60 120" width={SEAM} color={INK_SOFT} />
      </>
    ),
  },
  // a4: a lean boy with a narrow face, side-parted hair and headphones, navy hoodie.
  a4: {
    bg: v('c-grass'), skin: v('c-skin-2'), hair: v('c-hair-dark'), outfit: v('c-navy'),
    head: 'M38 54 C37 36 46 27 60 27 C74 27 83 36 82 54 C81 70 72 84 60 87 C48 84 39 70 38 54 Z',
    ear: 'M39 54 C31 50 29 64 36 67 C39 68 40 63 40 60 Z',
    neck: 'M53 74 L53 96 Q60 101 67 96 L67 74 Z',
    body: 'M16 120 C16 104 28 94 46 90 C54 88 66 88 74 90 C92 94 104 104 104 120 Z',
    hairBack: [],
    hairFront: ['M36 52 C34 30 46 17 63 17 C78 17 88 30 84 50 C82 42 78 37 70 34 C60 31 48 34 42 42 C40 46 38 48 36 52 Z'],
    eyeDX: 10, eyeY: 58, browW: 2.2, blush: false, mouth: 'smirk',
    collar: <Part d="M42 92 C50 84 70 84 78 92 C72 100 48 100 42 92 Z" fill={v('c-navy')} shade={[3, 3]} stroke={SEAM} ink={INK_SOFT} />,
    accent: (
      <>
        <Line d="M36 56 C32 18 88 18 84 56" width={5.4} color={INK} />
        <Line d="M36 56 C32 18 88 18 84 56" width={3.4} color={v('c-metal')} />
        <Part d={ellipse(35, 60, 5.6, 9)} fill={v('c-red')} shade={[2, 3]} stroke={SEAM} />
        <Part d={ellipse(85, 60, 5.6, 9)} fill={v('c-red')} shade={[2, 3]} stroke={SEAM} />
      </>
    ),
  },
};

function Mouth({ kind }: { kind: Look['mouth'] }) {
  switch (kind) {
    case 'grin':
      return (
        <g>
          <path d="M51 69 Q60 82 69 69 Z" fill={v('c-mouth')} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M55 75 Q60 79 65 75 Q60 72 55 75 Z" fill={v('c-blush')} />
        </g>
      );
    case 'smirk': return <Line d="M53 72 Q60 76 68 69" width={1.8} />;
    case 'soft': return <Line d="M54 71 Q60 75 66 71" width={1.8} />;
    default: return <Line d="M52 70 Q60 78 68 70" width={1.8} />;
  }
}

export function Avatar({ id, size = 64 }: { id: AvatarId; size?: number }) {
  const clip = useId().replace(/:/g, '');
  const L = LOOKS[id];
  const n = Number(id.slice(1));
  const xs = [60 - L.eyeDX, 60 + L.eyeDX];
  const sil = [
    ...L.hairBack.map((d) => ({ d })),
    { d: L.body }, { d: L.neck }, { d: L.ear }, { d: mir(L.ear) }, { d: L.head },
  ];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Аватар ${n}`} style={{ display: 'block' }}>
      <defs><clipPath id={`a${clip}`}><circle cx={60} cy={60} r={57} /></clipPath></defs>
      <circle cx={60} cy={60} r={57} fill={L.bg} />
      <g clipPath={`url(#a${clip})`}>
        <Silhouette shapes={sil} />
        {L.hairBack.map((d, i) => <Part key={i} d={d} fill={L.hair} shade={[6, 5]} light={[2, 2]} stroke={0} />)}
        <Part d={L.body} fill={L.outfit} shade={[10, 5]} stroke={0} />
        <Part d={L.neck} fill={L.skin} shade={[5, 4]} light={null} stroke={0}>
          <rect x={44} y={66} width={32} height={14} fill={v('c-shade')} />
        </Part>
        {L.collar}
        <Part d={L.ear} fill={L.skin} shade={[2, 2]} stroke={0} />
        <Part d={mir(L.ear)} fill={L.skin} shade={[-2, 2]} stroke={0} />
        <Part d={L.head} fill={L.skin} shade={[8, 3]} stroke={0}>
          {L.blush && xs.map((x) => <ellipse key={x} cx={x + (x < 60 ? -3 : 3)} cy={L.eyeY + 10} rx={6} ry={3.4} fill={v('c-blush')} opacity={0.5} />)}
          <path d={L.hairFront[0]} fill={v('c-shade')} transform="translate(2 5)" />
        </Part>
        {L.hairFront.map((d, i) => <Part key={i} d={d} fill={L.hair} shade={[4, 4]} light={[2, 2]} />)}
        {L.accent}
        {L.freckles && [[46, 66], [50, 69], [43, 70], [74, 66], [70, 69], [77, 70]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={0.9} fill={v('c-freckle')} />)}
        {xs.map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={L.eyeY} rx={2.5} ry={3.2} fill={v('c-eye')} />
            <circle cx={x + 0.9} cy={L.eyeY - 1.2} r={0.9} fill={v('c-cream')} />
            <Line d={`M${x - 4.5} ${L.eyeY - 7.5} Q${x} ${L.eyeY - 10} ${x + 4.5} ${L.eyeY - 7.5}`} width={L.browW} />
          </g>
        ))}
        <Line d="M58.5 63 Q60 66 62 64" width={1.2} color={INK_SOFT} />
        <Mouth kind={L.mouth} />
        {L.glasses && (
          <g fill={v('c-glass')} stroke={INK} strokeWidth={1.4}>
            {xs.map((x) => <circle key={x} cx={x} cy={L.eyeY} r={7.6} />)}
            <path d={`M${xs[0] + 7.6} ${L.eyeY - 1} Q60 ${L.eyeY - 4} ${xs[1] - 7.6} ${L.eyeY - 1}`} fill="none" />
          </g>
        )}
      </g>
      <circle cx={60} cy={60} r={57} fill="none" stroke={INK_BG} strokeWidth={2} />
    </svg>
  );
}
