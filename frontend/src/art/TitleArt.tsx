import type { ReactNode } from 'react';
import { Cloud, Rocket, Satellite, Spark, Star } from './shapes';
import { INK_BG, Part, v } from './v2/shade';
import { Bg, FirTree, Glow, Hangar, Lattice, Ridge, Sky, Tree, circ, smooth } from './v2/scene';
import './art.css';

/** Full-bleed title-screen art (viewBox 1600x900, slice): a pastel poster of a launch over the Earth. No text. */
export function TitleArt() {
  const rays: string[] = [];
  const ox = 700, oy = 800;
  for (let i = 0; i < 16; i++) {
    const a = (-175 + i * 12) * (Math.PI / 180);
    const b = a + 0.1;
    const R = 2400;
    rays.push(`M${ox} ${oy} L${ox + Math.cos(a) * R} ${oy + Math.sin(a) * R} L${ox + Math.cos(b) * R} ${oy + Math.sin(b) * R} Z`);
  }
  const sparks: [number, number, number][] = [
    [130, 110, 14], [330, 60, 9], [520, 150, 12], [760, 70, 10], [1010, 130, 14], [1180, 50, 9], [1420, 120, 12], [1530, 260, 9],
    [90, 330, 9], [250, 470, 12], [1500, 470, 10], [660, 300, 8], [1280, 330, 8],
  ];
  const puffs: ReactNode[] = [];
  const nx = 840, ny = 600;
  for (let t = 6; t >= 1; t--) {
    const cx = nx - 38 * t - (t % 2) * 10;
    const cy = ny + 49 * t;
    puffs.push(<Bg key={t} d={circ(cx, cy, 24 + t * 7)} fill={v('c-cream')} shade={[8 + t, 6 + t]} stroke={2} />);
  }
  return (
    <svg
      viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"
      aria-hidden="true" focusable="false" style={{ display: 'block' }}
    >
      <Sky time="morning" x={-10} y={-10} w={1620} h={920} />
      <path d={rays.join(' ')} fill={v('c-orange')} opacity={0.16} pointerEvents="none" />
      <Glow time="evening" cx={ox} cy={oy} r={560} k={0.9} color="c-mustard" />

      {sparks.map(([x, y, r]) => <Spark key={`${x}${y}`} x={x} y={y} r={r} />)}

      {/* moon */}
      <Bg d={circ(250, 220, 62)} fill={v('c-cream')} shade={[16, 14]} stroke={2}>
        <circle cx={228} cy={200} r={11} fill={v('c-metal')} opacity={0.8} />
        <circle cx={274} cy={246} r={15} fill={v('c-metal')} opacity={0.8} />
        <circle cx={268} cy={188} r={7} fill={v('c-metal')} opacity={0.8} />
      </Bg>

      {/* orbit with a small spacecraft */}
      <g transform="rotate(-18 420 330)">
        <ellipse cx={420} cy={330} rx={360} ry={96} fill="none" stroke={v('c-cream')} strokeWidth={4} strokeDasharray="4 14" strokeLinecap="round" opacity={0.9} />
      </g>
      <g transform="translate(748 238) rotate(-18)"><Satellite s={0.7} /></g>

      <Cloud x={1180} y={250} s={0.9} delay={0} op={0.9} />
      <Cloud x={120} y={560} s={0.7} delay={18} op={0.85} />

      {/* the Earth's limb, bottom right */}
      <circle cx={1500} cy={1480} r={852} fill={v('c-cream')} opacity={0.38} />
      <Part d={circ(1500, 1480, 820)} fill={v('c-navy')} shade={[60, 40]} light={[10, 10]} stroke={3} ink={INK_BG}>
        <path d={smooth([[1190, 830], [1230, 770], [1330, 748], [1400, 780], [1410, 850], [1330, 884], [1250, 868]])} fill={v('c-green')} />
        <path d={smooth([[1490, 720], [1570, 690], [1640, 700], [1650, 800], [1560, 800], [1500, 760]])} fill={v('c-green')} />
        <path d="M1000 910 Q1100 790 1300 724" fill="none" stroke={v('c-cream')} strokeWidth={6} strokeLinecap="round" opacity={0.5} />
      </Part>

      {/* land with the bureau silhouette (bottom left) */}
      <Ridge pts={[[-30, 790], [220, 740], [470, 778], [740, 800], [1000, 910]]} bottom={910} fill={v('c-grass')} />
      <Hangar x={60} y={690} w={250} h={96} />
      <Lattice x={330} y={640} w={30} h={146} rows={5} />
      <FirTree x={520} y={810} s={0.8} />
      <FirTree x={590} y={822} s={0.55} tone="c-grass" />
      <Tree x={30} y={840} s={0.7} tone="c-grass" seed={2} />

      {/* smoke trail and the rocket flying up-right */}
      {puffs}
      <g transform={`translate(${nx} ${ny}) rotate(38) scale(1.7)`}>
        <Rocket flame sw={1.5} />
      </g>
      <Star x={1120} y={240} r={16} />
      <Star x={1290} y={480} r={11} />
    </svg>
  );
}
