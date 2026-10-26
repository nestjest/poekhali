import type { ReactNode } from 'react';
import { CharacterArt } from './Character';
import type { CharacterId, Mood } from './Character';
import { Rocket, Satellite, Spark, Star } from './shapes';
import { INK, INK_BG, Line, Part, SoftShadow, v } from './v2/shade';
import { Bg, Glow, Veil, mix, oval, rrect } from './v2/scene';
import './art.css';

const SIGN = mix('c-navy', 'c-ink', 62);

/** «Окно заданий»: the customer behind the bureau's task window (style v2). viewBox 800x420, the person is a 240x300 waist-up figure. */
export function ClientCounter({
  clientId, mood, children,
}: { clientId: CharacterId; mood: Mood; children?: ReactNode }) {
  const flags: ReactNode[] = [];
  const colors = ['c-red', 'c-orange', 'c-mustard'];
  [[112, 6], [560, 6]].forEach(([x0, k]) => {
    for (let i = 0; i < 6; i++) {
      const x = x0 + i * 24;
      flags.push(
        <Part key={`${x0}${i}`} d={`M${x} 74 h22 l-11 ${24 + k} z`} fill={v(colors[i % 3])} shade={[3, 3]} light={null} stroke={1.4} ink={INK_BG} />,
      );
    }
  });
  return (
    <svg
      viewBox="0 0 800 420" width="100%" role="group" aria-label="Окно заданий"
      style={{ display: 'block', height: 'auto', maxWidth: '100%' }}
    >
      {/* wall */}
      <rect x={0} y={0} width={800} height={420} rx={20} fill={v('c-wall')} />
      <path d="M0 296 H800 V400 Q800 420 780 420 H20 Q0 420 0 400 Z" fill={v('c-wall-2')} />

      {/* sign plate */}
      <Line d="M300 8 V0 M500 8 V0" color={INK_BG} width={2.4} />
      <Part d={rrect(250, 8, 300, 42, 14)} fill={SIGN} shade={[5, 5]} />
      <rect x={258} y={14} width={284} height={30} rx={9} fill="none" stroke={v('c-cream')} strokeWidth={1.6} strokeDasharray="2 7" strokeLinecap="round" opacity={0.8} />
      <text
        x={400} y={30} textAnchor="middle" dominantBaseline="central" fontFamily="var(--font-ui)" fontWeight={800}
        fontSize={22} fill={v('c-cream')} textLength={200} lengthAdjust="spacingAndGlyphs"
      >
        Приём заданий
      </text>
      <Star x={272} y={29} r={8} />
      <Star x={528} y={29} r={8} />

      {/* window opening onto the back room */}
      <Bg d={rrect(90, 70, 620, 250, 16)} fill={v('c-wood')} shade={[10, 8]} />
      <rect x={110} y={90} width={580} height={220} rx={6} fill={v('c-window-far')} stroke={INK_BG} strokeWidth={1.6} />
      <g opacity={0.5}>
        <Line d="M120 250 H680" color={v('c-wood-2')} width={5} />
        <rect x={456} y={190} width={40} height={60} rx={5} fill={v('c-metal')} />
        <rect x={520} y={200} width={34} height={50} rx={4} fill={v('c-navy')} />
      </g>

      {/* cubesat model on a shelf behind the customer (left) */}
      <Bg d={rrect(128, 236, 118, 10, 4)} fill={v('c-wood')} shade={[0, 3]} />
      <g transform="translate(168 212)"><Satellite s={0.78} cube soft /></g>
      <Bg d={rrect(212, 208, 24, 28, 4)} fill={v('c-orange')} shade={[4, 3]} />
      {/* framed rocket picture (right) */}
      <Bg d={rrect(582, 106, 86, 112, 8)} fill={v('c-wood')} shade={[6, 5]} />
      <Bg d={rrect(591, 115, 68, 94, 4)} fill={mix('c-navy', 'c-ink', 78)} shade={[5, 4]} />
      <g transform="translate(626 200) scale(0.26)"><Rocket sw={7} soft /></g>
      <Spark x={603} y={134} r={6} />
      <Spark x={646} y={150} r={4} />
      <Veil k={0.8} />

      {/* the customer behind the counter */}
      <svg x={256} y={26} width={288} height={360} viewBox="0 0 240 300" overflow="hidden">
        <CharacterArt id={clientId} mood={mood} />
      </svg>

      {/* bunting over the corners */}
      <Line d="M112 74 Q178 98 244 74" color={INK_BG} width={1.8} />
      <Line d="M560 74 Q626 98 692 74" color={INK_BG} width={1.8} />
      {flags}

      {/* lamp light in the evening */}
      <Glow time="day" cx={619} cy={240} r={200} k={0.9} />

      {/* counter */}
      <SoftShadow cx={400} cy={302} rx={330} ry={10} />
      <Part d={rrect(60, 306, 680, 114, 10)} fill={v('c-wood-2')} shade={[0, 10]} light={null}>
        <Line d="M84 346 H716 M84 378 H716" color={INK} width={1.4} opacity={0.2} />
      </Part>
      <Part d={rrect(40, 290, 720, 26, 10)} fill={v('c-wood')} shade={[0, 6]} light={[0, 2]} />

      {/* call bell */}
      <SoftShadow cx={166} cy={292} rx={40} ry={5} />
      <Part d="M142 288 C142 262 190 262 190 288 Z" fill={v('c-mustard')} shade={[4, 3]} />
      <circle cx={166} cy={260} r={4.6} fill={v('c-mustard')} stroke={INK} strokeWidth={1.4} />
      <Part d={rrect(134, 284, 64, 8, 4)} fill={v('c-wood-2')} shade={[0, 2]} light={null} stroke={1.2} />

      {/* desk lamp */}
      <Part d={rrect(588, 280, 62, 10, 5)} fill={v('c-steel')} shade={[0, 3]} light={null} stroke={1.3} />
      <Line d="M619 282 L640 254 L618 232" color={INK} width={6} />
      <Line d="M619 282 L640 254 L618 232" color={v('c-steel')} width={3} />
      <Part d="M586 242 L630 220 L644 244 Z" fill={v('c-red')} shade={[5, 4]} stroke={1.4} />
      <path d={oval(612, 246, 10, 3)} fill={v('c-mustard')} />

      {children}
    </svg>
  );
}
