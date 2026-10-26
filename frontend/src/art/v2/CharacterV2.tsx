// Style v2 characters: one figure, one outline. Every person has their own anatomy — head and jaw, ears,
// neck, shoulders, eyes, brows, nose, mouth, marks and a voluminous hairstyle. The outer contour is drawn
// once around the whole figure (`Silhouette`), inner seams are thin; only pieces lying OVER the figure
// (fringe, a hand at the chin, crossed arms) get their own thin outline. Space 240×300, light from the upper-left.
import type { ReactNode } from 'react';
import type { Mood } from '../mood';
import { INK, INK_SOFT, Line, OVER, Part, SEAM, Silhouette, v } from './shade';

export type V2Id = 'olga' | 'vika' | 'max' | 'gromov' | 'zoya' | 'sokolov' | 'kira' | 'tamara' | 'fedor' | 'ilya';
export const V2_IDS: V2Id[] = ['olga', 'vika', 'max', 'gromov', 'zoya', 'sokolov', 'kira', 'tamara', 'fedor', 'ilya'];
export const V2_NAMES: Record<V2Id, string> = {
  olga: 'Ольга', vika: 'Вика', max: 'Макс', gromov: 'Андрей Ильич Громов', zoya: 'Зоя Андреевна',
  sokolov: 'Сергей Павлович Соколов', kira: 'Кира', tamara: 'Тамара Ильинична', fedor: 'Фёдор Кузьмич', ilya: 'Илья',
};

type Pose = 'down' | 'wave' | 'shrug' | 'cross' | 'chin';
const POSE: Record<Mood, Pose> = { neutral: 'down', joy: 'wave', puzzled: 'shrug', annoyed: 'cross', thinking: 'chin' };
const MIRROR = 'matrix(-1 0 0 1 240 0)';

/** Mirrors an absolute path (M L C Q Z only) about the vertical axis x = cx: for symmetric locks, ears, collars. */
const mir = (d: string, cx = 121) => {
  let i = 0;
  return d.replace(/[MLCQZ]|-?\d+(?:\.\d+)?/g, (t) => {
    if (/[A-Z]/.test(t)) { i = 0; return t; }
    const n = Number(t);
    return String(i++ % 2 === 0 ? 2 * cx - n : n);
  });
};

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

// ------------------------------------------------------------------ the "passport" of a face and body
interface FaceSpec {
  eyeY: number; eyeDX: number;
  eye: 'dot' | 'round' | 'sleepy' | 'narrow' | 'wide';
  lashes?: boolean;
  browGap: number; browLen: number; browW: number; browColor?: string;
  nose: 'button' | 'dots' | 'long' | 'pointy' | 'wide' | 'round' | 'sharp'; noseY: number;
  mouthY: number; mouthW: number; mouthColor?: string;
  blush?: boolean; freckles?: boolean;
  lines?: string[];
  glasses?: 'round' | 'rect' | 'cat';
  moustache?: string; moustacheColor?: string;
  /** Stubble dots on the lower face: from row y0 to y1, half-width hw at the top. */
  stubble?: { y0: number; y1: number; hw: number };
}

/** A lock of hair: shape + light strand (sheen) + thin inner strands. */
interface Lock { d: string; hl?: string; strands?: string; shade?: [number, number]; color?: string }

interface Spec {
  skin: string; hair: string;
  head: string; chinY: number; markAt: [number, number];
  headDrop: number;                         // how low the head sits on the neck (bigger → shorter neck)
  ears?: [string, string];
  neck: string; body: string;
  shoulder: { x: number; y: number };      // outer point of the left shoulder; the right one is mirrored
  outfit: string;
  face: FaceSpec;
  hairBack: Lock[]; hairFront: Lock[]; hairAccent?: ReactNode;
  bodyDetails?: ReactNode; chest?: ReactNode; neckwear?: ReactNode;
}

// ------------------------------------------------------------------ people
function spec(id: V2Id): Spec {
  switch (id) {
    // Вика, ~30: oval face, slim, big curly ponytail, fringe swept to the side, a curl at the temple.
    case 'vika': return {
      skin: v('c-skin-1'), hair: v('c-hair-ginger'),
      head: 'M83 106 C81 77 98 58 121 58 C144 58 160 77 159 106 C158 132 143 156 121 159 C100 156 85 133 83 106 Z',
      chinY: 159, markAt: [182, 60], headDrop: 18,
      ears: ['M86 104 C76 100 74 116 79 122 C83 127 88 124 89 118 Z', 'M156 104 C166 100 168 116 163 122 C159 127 154 124 153 118 Z'],
      neck: 'M110 146 L110 192 Q121 199 132 192 L132 146 Z',
      body: 'M52 300 C51 247 59 210 84 197 C98 190 144 190 158 197 C183 210 191 247 190 300 Z',
      shoulder: { x: 62, y: 200 },
      outfit: v('c-navy'),
      face: { eyeY: 114, eyeDX: 16, eye: 'round', browGap: 12, browLen: 13, browW: 2.2, nose: 'button', noseY: 126, mouthY: 140, mouthW: 13, blush: true },
      hairBack: [
        { d: 'M148 64 C162 44 194 40 210 60 C224 76 220 96 228 110 C236 126 226 144 214 148 C222 160 214 178 198 178 C202 166 196 156 188 150 C182 136 186 120 178 106 C170 92 158 80 148 64 Z',
          hl: 'M176 56 C192 52 206 60 212 72', strands: 'M196 96 C202 110 204 122 214 134 M180 112 C186 128 186 142 194 156' },
        { d: 'M82 112 C74 76 96 50 122 50 C150 50 168 74 162 112 C158 98 146 84 122 82 C100 82 88 96 82 112 Z', shade: [10, 4] },
      ],
      hairFront: [
        { d: 'M84 102 C82 74 100 54 124 54 C148 54 164 70 162 94 C156 86 148 80 138 80 C134 88 126 92 118 92 C112 100 102 104 94 106 C90 104 86 104 84 102 Z',
          hl: 'M104 62 C116 56 132 56 144 62', strands: 'M118 64 Q126 72 128 82', shade: [5, 6] },
        { d: 'M86 100 C78 112 78 128 84 140 C88 148 96 146 94 138 C90 128 92 116 96 106 Z', shade: [3, 3] },
      ],
      hairAccent: <Part d={ellipse(152, 62, 6, 7)} fill={v('c-red')} shade={[2, 2]} light={null} />,
      bodyDetails: (
        <>
          <rect x={40} y={252} width={160} height={11} fill={v('c-red')} />
          <Line d="M98 214 Q102 232 100 246" width={SEAM} color={INK_SOFT} />
        </>
      ),
      chest: (
        <>
          <Part d="M102 192 L121 226 L140 192 Z" fill={v('c-cream')} shade={[4, 6]} light={null} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M100 191 L121 228 L110 240 L90 199 Z" fill={v('c-navy')} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M142 191 L121 228 L132 240 L152 199 Z" fill={v('c-navy')} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M146 214 L152 220 L146 226 L140 220 Z" fill={v('c-mustard')} shade={[2, 2]} light={null} stroke={SEAM} />
        </>
      ),
      neckwear: (
        <g>
          <Line d="M100 186 C100 206 142 206 142 186" width={4.5} color={v('c-metal')} />
          <Line d="M100 186 C100 206 142 206 142 186" width={SEAM} color={INK_SOFT} />
          <Part d={ellipse(99, 188, 7, 9)} fill={v('c-metal')} shade={[3, 3]} />
          <Part d={ellipse(143, 188, 7, 9)} fill={v('c-metal')} shade={[3, 3]} />
        </g>
      ),
    };

    // Зоя Андреевна, ~50: round wide face, soft chin, big wavy bob covering the ears, soft round shoulders, bag strap.
    case 'zoya': return {
      skin: v('c-skin-2'), hair: v('c-hair-brown'),
      head: 'M74 112 C73 81 94 62 120 62 C147 62 168 81 167 112 C166 140 149 163 120 165 C92 163 75 141 74 112 Z',
      chinY: 165, markAt: [192, 58], headDrop: 14,
      neck: 'M105 152 L105 198 Q120 206 135 198 L135 152 Z',
      body: 'M32 300 C32 250 42 216 76 204 C95 197 145 197 164 204 C198 216 208 250 208 300 Z',
      shoulder: { x: 46, y: 208 },
      outfit: v('c-green'),
      face: {
        eyeY: 120, eyeDX: 18, eye: 'dot', browGap: 13, browLen: 12, browW: 2.4, nose: 'dots', noseY: 132, mouthY: 146, mouthW: 14, blush: true,
        lines: ['M98 140 Q100 146 104 149', 'M142 140 Q140 146 136 149'], glasses: 'round',
      },
      hairBack: [
        { d: 'M60 140 C46 126 46 104 56 90 C56 66 76 48 100 44 C112 36 134 36 148 44 C172 48 190 68 188 92 C198 106 196 126 186 138 C192 152 184 168 168 168 C160 172 152 166 150 158 L92 158 C88 168 76 172 68 166 C56 162 54 150 60 140 Z',
          hl: 'M74 70 C86 56 104 50 120 50', strands: 'M64 112 C62 126 66 138 72 148 M178 104 C182 120 180 132 174 144', shade: [10, 6] },
      ],
      hairFront: [
        { d: 'M76 110 C70 82 90 58 120 58 C150 58 172 78 168 108 C162 96 154 88 144 86 C142 94 134 100 124 98 C118 104 108 106 98 104 C90 104 82 106 76 110 Z',
          hl: 'M98 66 C112 60 130 60 144 66', strands: 'M110 70 Q118 80 120 92', shade: [6, 7] },
        { d: 'M78 108 C66 116 64 136 70 152 C74 160 84 158 84 150 C80 138 82 124 88 114 Z', shade: [3, 3] },
        { d: 'M162 108 C174 116 176 136 170 152 C166 160 156 158 156 150 C160 138 158 124 152 114 Z', shade: [3, 3] },
      ],
      bodyDetails: (
        <g>
          <Line d="M121 236 L121 300" width={SEAM} color={INK_SOFT} />
          {[248, 272, 296].map((y) => <circle key={y} cx={129} cy={y} r={3.2} fill={v('c-mustard')} stroke={INK_SOFT} strokeWidth={1} />)}
        </g>
      ),
      chest: (
        <>
          <Part d="M100 200 L121 234 L142 200 Z" fill={v('c-cream')} shade={[4, 6]} light={null} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M100 200 L114 214 L103 220 L94 204 Z" fill={v('c-cream')} shade={[2, 2]} light={null} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M142 200 L128 214 L139 220 L148 204 Z" fill={v('c-cream')} shade={[2, 2]} light={null} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M60 212 C100 234 160 266 202 300 L178 300 C138 270 92 244 50 226 Z" fill={v('c-wood-2')} shade={[4, 5]} stroke={SEAM} ink={INK_SOFT} />
          <g fill="none" stroke={v('c-mustard')} strokeWidth={1.8}>
            <ellipse cx={152} cy={230} rx={9} ry={3.6} />
            <ellipse cx={152} cy={230} rx={9} ry={3.6} transform="rotate(60 152 230)" />
            <ellipse cx={152} cy={230} rx={9} ry={3.6} transform="rotate(-60 152 230)" />
          </g>
          <circle cx={152} cy={230} r={2.2} fill={v('c-red')} />
        </>
      ),
    };

    // Громов, ~60: long face with a square jaw, receding fluffy grey hair, bushy moustache, broad square shoulders, suit.
    case 'gromov': return {
      skin: v('c-skin-1'), hair: v('c-hair-grey'),
      head: 'M86 102 C86 74 100 56 121 56 C142 56 156 74 156 102 L156 134 C156 156 142 170 121 170 C100 170 86 156 86 134 Z',
      chinY: 170, markAt: [180, 54], headDrop: 10,
      ears: ['M89 106 C76 100 72 122 79 130 C84 136 91 132 91 124 Z', 'M153 106 C166 100 170 122 163 130 C158 136 151 132 151 124 Z'],
      neck: 'M103 156 L103 200 Q121 208 139 200 L139 156 Z',
      body: 'M26 300 C26 244 36 210 74 198 C94 191 148 191 168 198 C206 210 216 244 216 300 Z',
      shoulder: { x: 38, y: 202 },
      outfit: v('c-suit'),
      face: {
        eyeY: 114, eyeDX: 15, eye: 'sleepy', browGap: 10, browLen: 17, browW: 4, browColor: v('c-hair-grey'), nose: 'long', noseY: 132, mouthY: 152, mouthW: 12,
        lines: ['M106 84 Q121 80 136 84', 'M110 90 Q121 88 132 90', 'M91 117 L95 119 M151 117 L147 119', 'M106 148 Q103 154 105 160', 'M136 148 Q139 154 137 160'],
        glasses: 'rect',
        moustache: 'M100 143 C104 134 116 135 121 141 C126 135 138 134 142 143 C140 149 132 151 126 148 C124 147 122 146 121 145 C120 146 118 147 116 148 C110 151 102 149 100 143 Z',
      },
      hairBack: [
        { d: 'M88 128 C78 116 76 96 84 82 C88 74 96 68 102 66 C98 80 96 100 98 120 C96 126 92 130 88 128 Z', strands: 'M88 96 Q90 108 91 118', shade: [4, 4] },
        { d: 'M154 128 C164 116 166 96 158 82 C154 74 146 68 140 66 C144 80 146 100 144 120 C146 126 150 130 154 128 Z', strands: 'M154 96 Q152 108 151 118', shade: [4, 4] },
      ],
      hairFront: [{ d: 'M98 66 C104 52 136 50 146 62 C140 60 132 60 124 62 C116 60 106 62 98 66 Z', shade: [3, 3] }],
      bodyDetails: <Line d="M70 236 Q76 266 72 296" width={SEAM} color={INK_SOFT} />,
      chest: (
        <>
          <Part d="M100 196 L121 242 L142 196 Z" fill={v('c-cream')} shade={[4, 6]} light={null} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M116 204 L126 204 L130 272 L121 282 L112 272 Z" fill={v('c-red')} shade={[3, 5]} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M98 195 L121 250 L106 262 L82 204 Z" fill={v('c-suit')} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
          <Part d="M144 195 L121 250 L136 262 L160 204 Z" fill={v('c-suit')} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
          <path d="M150 226 L153 233 L160 233 L154 238 L157 245 L150 241 L143 245 L146 238 L140 233 L147 233 Z" fill={v('c-mustard')} stroke={INK_SOFT} strokeWidth={1} />
        </>
      ),
    };

    // Ольга, ~40: full soft oval face, smooth chin-length bob with a side-swept fringe, slim neck, sloping shoulders, navy jacket.
    case 'olga': {
      const jacket = 'color-mix(in srgb, var(--c-navy) 74%, var(--c-suit))';
      const lapel = 'M103 204 L121 246 L106 258 L82 214 Z';
      const sideLock = 'M84 100 C76 118 74 138 78 150 C84 160 98 156 100 148 C92 144 90 134 92 120 C93 112 96 106 98 100 Z';
      return {
        skin: v('c-skin-2'), hair: 'color-mix(in srgb, var(--c-hair-brown) 52%, var(--c-hair-dark))',
        head: 'M80 108 C78 80 98 60 121 60 C144 60 164 80 162 108 C161 134 146 158 121 162 C96 158 81 134 80 108 Z',
        chinY: 162, markAt: [186, 58], headDrop: 20,
        neck: 'M111 148 L111 206 Q121 212 131 206 L131 148 Z',
        body: 'M44 300 C44 262 48 232 74 218 C92 208 150 208 168 218 C194 232 198 262 198 300 Z',
        shoulder: { x: 54, y: 214 },
        outfit: jacket,
        face: {
          eyeY: 116, eyeDX: 15, eye: 'round', lashes: true, browGap: 12, browLen: 12, browW: 1.9, nose: 'button', noseY: 130,
          mouthY: 143, mouthW: 15, mouthColor: v('c-mouth'), blush: true,
        },
        hairBack: [
          { d: 'M121 44 C92 44 70 64 69 96 C68 120 66 138 72 152 C78 162 96 160 102 150 L140 150 C146 160 164 162 170 152 C176 138 174 120 173 96 C172 64 150 44 121 44 Z',
            hl: 'M84 66 C94 54 108 48 124 48', strands: 'M76 100 C74 118 76 134 80 146 M166 100 C168 118 166 134 162 146', shade: [10, 6] },
        ],
        hairFront: [
          { d: 'M80 106 C76 78 96 54 122 54 C148 54 168 74 163 106 C160 104 158 102 156 100 C146 98 132 94 124 88 C118 84 112 80 108 78 C106 90 96 102 86 110 C83 109 81 108 80 106 Z',
            hl: 'M98 64 C112 57 134 57 150 65', strands: 'M118 62 Q126 72 128 84 M138 62 Q146 74 150 88', shade: [5, 6] },
          { d: sideLock, strands: 'M86 112 Q84 130 88 146', shade: [3, 3] },
          { d: mir(sideLock), strands: 'M156 112 Q158 130 154 146', shade: [3, 3] },
        ],
        hairAccent: <Part d="M96 82 C100 78 106 78 108 82 C106 88 100 90 96 88 Z" fill={v('c-mustard')} shade={[2, 2]} light={null} stroke={SEAM} />,
        bodyDetails: <Line d="M121 250 L121 300" width={SEAM} color={INK_SOFT} />,
        chest: (
          <>
            <Part d="M104 207 L121 246 L138 207 Z" fill={v('c-cream')} shade={[4, 6]} light={null} stroke={SEAM} ink={INK_SOFT} />
            <Part d={lapel} fill={jacket} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
            <Part d={mir(lapel)} fill={jacket} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
            <circle cx={127} cy={272} r={3} fill={v('c-cream')} stroke={INK_SOFT} strokeWidth={1} />
            <circle cx={127} cy={292} r={3} fill={v('c-cream')} stroke={INK_SOFT} strokeWidth={1} />
            <g transform="translate(98 238)">
              <circle r={9} fill={v('c-mustard')} stroke={INK_SOFT} strokeWidth={1} />
              <g transform="rotate(38)">
                <path d="M0 -7 C3.4 -4 3.4 2 2.2 5.5 H-2.2 C-3.4 2 -3.4 -4 0 -7 Z" fill={v('c-cream')} stroke={INK_SOFT} strokeWidth={0.9} />
                <path d="M-2.2 3 L-5 6.4 L-2.2 5.6 Z M2.2 3 L5 6.4 L2.2 5.6 Z" fill={v('c-red')} />
                <circle cy={-2} r={1.2} fill={v('c-navy')} />
              </g>
            </g>
          </>
        ),
      };
    }

    // Соколов, ~48: wide angular face with a flat chin, flat-top crop with grey temples, narrow eyes, headset, uniform shirt with epaulets.
    case 'sokolov': {
      const shirt = 'color-mix(in srgb, var(--c-navy) 42%, var(--c-cream))';
      const epaulet = 'M88 197 L46 206 L51 221 L90 211 Z';
      const ear = 'M85 104 C75 100 73 114 77 122 C80 128 86 126 87 120 Z';
      const temple = 'M83 96 C82 86 86 80 93 77 C95 86 97 98 95 110 L88 116 C85 108 83 102 83 96 Z';
      const collar = 'M100 197 L122 216 L110 234 L92 204 Z';
      return {
        skin: v('c-skin-3'), hair: v('c-hair-dark'),
        head: 'M82 100 C82 74 98 58 121 58 C144 58 160 74 160 100 C160 122 158 136 150 148 L136 162 Q121 168 106 162 L92 148 C84 136 82 122 82 100 Z',
        chinY: 166, markAt: [184, 56], headDrop: 8,
        ears: [ear, mir(ear)],
        neck: 'M104 150 L104 202 Q121 208 138 202 L138 150 Z',
        body: 'M30 300 C30 252 34 222 54 210 C70 202 80 200 96 198 L146 198 C162 200 172 202 188 210 C208 222 212 252 212 300 Z',
        shoulder: { x: 40, y: 204 },
        outfit: shirt,
        face: {
          eyeY: 112, eyeDX: 15, eye: 'narrow', browGap: 10, browLen: 16, browW: 3.4, browColor: v('c-hair-dark'), nose: 'sharp', noseY: 132,
          mouthY: 147, mouthW: 17, lines: ['M104 134 Q101 142 103 150', 'M138 134 Q141 142 139 150', 'M106 86 Q121 83 136 86', 'M121 154 L121 160'],
          stubble: { y0: 138, y1: 160, hw: 30 },
        },
        hairBack: [],
        hairFront: [
          { d: 'M83 98 C79 70 94 46 121 46 C148 46 165 70 159 98 C157 90 153 82 147 78 C136 74 106 74 95 78 C89 82 85 90 83 98 Z',
            hl: 'M96 56 C112 49 134 49 148 57', strands: 'M100 56 L102 70 M112 51 L113 70 M124 49 L124 70 M136 51 L135 70 M148 57 L146 72', shade: [4, 7] },
          { d: temple, color: v('c-hair-grey'), shade: [3, 3], strands: 'M89 88 L91 106' },
          { d: mir(temple), color: v('c-hair-grey'), shade: [3, 3], strands: 'M153 88 L151 106' },
        ],
        hairAccent: (
          <g>
            <Line d="M86 108 C82 70 100 54 121 54 C142 54 160 70 156 108" width={6.4} color={INK} />
            <Line d="M86 108 C82 70 100 54 121 54 C142 54 160 70 156 108" width={4} color={v('c-metal')} />
            <Part d={ellipse(81, 114, 7, 12)} fill={v('c-metal')} shade={[3, 4]} stroke={OVER} />
            <Part d={ellipse(81, 114, 3.4, 7)} fill={v('c-suit')} shade={[1, 2]} light={null} stroke={0} />
            <Line d="M80 125 C80 146 92 158 106 153" width={3.4} color={INK} />
            <Line d="M80 125 C80 146 92 158 106 153" width={1.8} color={v('c-metal')} />
            <Part d={ellipse(107, 153, 4.2, 3.4)} fill={v('c-suit')} shade={[2, 2]} light={null} stroke={SEAM} />
          </g>
        ),
        bodyDetails: <Line d="M121 218 L121 300" width={SEAM} color={INK_SOFT} />,
        chest: (
          <>
            <Part d={collar} fill={shirt} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
            <Part d={mir(collar)} fill={shirt} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
            {[240, 262, 284].map((y) => <circle key={y} cx={121} cy={y} r={3} fill={v('c-cream')} stroke={INK_SOFT} strokeWidth={1} />)}
            <Part d="M140 236 L172 236 L172 266 L156 274 L140 266 Z" fill={shirt} shade={[4, 5]} light={null} stroke={SEAM} ink={INK_SOFT} />
            <Part d="M140 236 L172 236 L172 246 L156 252 L140 246 Z" fill={shirt} shade={[3, 4]} light={null} stroke={SEAM} ink={INK_SOFT} />
            <Line d="M149 230 L149 244" width={2.4} color={v('c-red')} />
            <Part d={epaulet} fill={v('c-suit')} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT}>
              <Line d="M86 204 L50 213" width={2.2} color={v('c-mustard')} />
            </Part>
            <Part d={mir(epaulet)} fill={v('c-suit')} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT}>
              <Line d={mir('M86 204 L50 213')} width={2.2} color={v('c-mustard')} />
            </Part>
          </>
        ),
      };
    }

    // Кира, ~28: narrow heart-shaped face with a pointed chin, asymmetric cut (long on one side, shaved above the other ear), cat-eye glasses, pencil, turtleneck.
    case 'kira': {
      const knit = 'color-mix(in srgb, var(--c-green) 56%, var(--c-navy))';
      return {
        skin: v('c-skin-1'), hair: 'color-mix(in srgb, var(--c-hair-dark) 70%, var(--c-navy))',
        head: 'M88 104 C86 76 102 60 122 60 C142 60 157 76 155 104 C154 126 143 146 133 154 C128 159 124 161 121 161 C118 161 114 159 109 154 C99 146 89 126 88 104 Z',
        chinY: 161, markAt: [184, 52], headDrop: 14,
        ears: ['M90 108 C82 104 80 116 84 122 C87 126 91 124 91 119 Z', 'M153 106 C163 101 166 115 161 122 C158 127 153 125 153 119 Z'],
        neck: 'M110 148 L110 204 Q121 210 132 204 L132 148 Z',
        body: 'M62 300 C62 262 68 226 92 212 C104 205 138 205 150 212 C174 226 180 262 180 300 Z',
        shoulder: { x: 68, y: 206 },
        outfit: knit,
        face: {
          eyeY: 114, eyeDX: 15, eye: 'round', lashes: true, browGap: 13, browLen: 14, browW: 2.1, nose: 'sharp', noseY: 130,
          mouthY: 142, mouthW: 13, mouthColor: v('c-mouth'), glasses: 'cat',
        },
        hairBack: [
          { d: 'M122 46 C98 46 74 62 74 104 C74 128 76 148 84 160 C96 160 102 150 104 142 L110 80 L150 80 C158 62 146 46 122 46 Z',
            hl: 'M92 60 C104 52 118 50 130 52', shade: [10, 6] },
        ],
        hairFront: [
          { d: 'M86 112 C82 82 100 56 124 54 C146 52 160 66 160 88 C156 80 150 74 144 72 C134 82 118 86 106 94 C100 100 96 108 94 118 C94 130 96 142 100 152 C94 156 88 154 85 148 C80 136 84 122 86 112 Z',
            hl: 'M104 62 C118 55 138 54 152 62', strands: 'M122 60 Q124 70 116 82 M100 104 Q96 124 98 146 M140 64 Q144 70 144 74', shade: [5, 7] },
          { d: 'M157 86 C162 96 162 104 160 112 C157 104 156 98 152 92 Z', shade: [2, 2] },
        ],
        hairAccent: (
          <g>
            <Part d="M159 102 L174 70 L180 73 L165 106 Z" fill={v('c-mustard')} shade={[2, 2]} stroke={SEAM} />
            <Part d="M174 70 L176 66 L182 69 L180 73 Z" fill={v('c-red')} shade={[1, 1]} light={null} stroke={SEAM} />
            <circle cx={158} cy={127} r={2.6} fill={v('c-mustard')} stroke={INK_SOFT} strokeWidth={0.9} />
          </g>
        ),
        neckwear: <Part d="M97 184 C108 192 134 192 145 184 C150 194 150 204 144 211 C132 217 110 217 98 211 C92 204 92 194 97 184 Z" fill={knit} shade={[5, 5]} stroke={SEAM} ink={INK_SOFT} />,
        chest: (
          <>
            <Line d="M105 214 L114 264 M137 214 L128 264" width={1.8} color={INK_SOFT} />
            <Part d="M108 262 H134 V292 H108 Z" fill={v('c-cream')} shade={[4, 5]} light={null} stroke={SEAM} ink={INK_SOFT}>
              <rect x={108} y={262} width={26} height={8} fill={v('c-navy')} />
              <circle cx={121} cy={281} r={4.5} fill={v('c-skin-2')} />
            </Part>
          </>
        ),
      };
    }

    // Тамара Ильинична, ~60: pear-shaped face (narrow forehead, heavy jaw), huge puffy greying perm, short neck in a big scarf, honey cardigan.
    case 'tamara': {
      const cardigan = 'color-mix(in srgb, var(--c-mustard) 62%, var(--c-orange))';
      return {
        skin: v('c-skin-1'), hair: 'color-mix(in srgb, var(--c-hair-grey) 78%, var(--c-hair-brown))',
        head: 'M88 104 C86 80 102 62 121 62 C140 62 156 80 154 104 C158 120 156 140 146 150 C138 158 128 161 121 161 C114 161 104 158 96 150 C86 140 84 120 88 104 Z',
        chinY: 161, markAt: [194, 52], headDrop: 20,
        neck: 'M104 150 L104 214 Q121 220 138 214 L138 150 Z',
        body: 'M40 300 C40 258 48 230 76 218 C96 210 146 210 166 218 C194 230 202 258 202 300 Z',
        shoulder: { x: 50, y: 216 },
        outfit: cardigan,
        face: {
          eyeY: 116, eyeDX: 16, eye: 'sleepy', browGap: 12, browLen: 12, browW: 1.8, browColor: v('c-hair-grey'), nose: 'round', noseY: 130,
          mouthY: 145, mouthW: 14, mouthColor: v('c-mouth'), blush: true,
          lines: ['M94 120 L90 123 M94 125 L91 128', 'M148 120 L152 123 M148 125 L151 128', 'M102 138 Q99 146 102 152', 'M140 138 Q143 146 140 152', 'M106 86 Q121 83 136 86'],
        },
        hairBack: [
          { d: 'M62 110 C48 100 50 78 66 72 C62 54 82 38 102 44 C112 30 138 30 146 44 C166 38 184 54 178 72 C194 78 194 100 180 110 C190 122 182 134 166 132 C160 138 150 134 148 130 L94 130 C92 134 82 138 76 132 C62 134 52 122 62 110 Z',
            hl: 'M72 66 C84 50 104 44 122 46 M170 76 C176 84 178 94 174 102', strands: 'M96 52 C100 60 100 68 96 74 M146 52 C142 60 142 68 146 74', shade: [10, 7] },
        ],
        hairFront: [
          { d: 'M84 96 C82 74 98 56 121 56 C144 56 160 74 158 96 C152 84 144 78 136 74 C128 84 112 84 106 74 C98 78 90 86 84 96 Z',
            hl: 'M98 64 C112 58 132 58 146 64', strands: 'M110 66 Q116 74 112 82 M132 66 Q136 74 132 80', shade: [5, 6] },
        ],
        bodyDetails: (
          <g>
            <Line d="M121 236 L121 300" width={SEAM} color={INK_SOFT} />
            {[256, 278].map((y) => <circle key={y} cx={134} cy={y} r={4} fill={v('c-cream')} stroke={INK_SOFT} strokeWidth={1} />)}
            <Part d="M150 270 H182 V298 H150 Z" fill={cardigan} shade={[4, 4]} light={null} stroke={SEAM} ink={INK_SOFT} />
          </g>
        ),
        chest: (
          <>
            <Part d="M82 192 C96 180 146 180 160 192 C174 204 176 224 160 232 C140 240 102 240 82 232 C66 224 68 204 82 192 Z" fill={v('c-red')} shade={[6, 6]} stroke={SEAM} ink={INK_SOFT}>
              <g stroke={v('c-cream')} strokeWidth={4} fill="none" opacity={0.9}>
                <path d="M70 202 C100 214 142 214 172 202" />
                <path d="M68 220 C100 232 142 232 174 220" />
              </g>
            </Part>
            <Part d="M90 226 C86 248 88 268 96 286 L118 282 C112 266 112 246 116 230 Z" fill={v('c-red')} shade={[5, 5]} stroke={SEAM} ink={INK_SOFT}>
              <g stroke={v('c-cream')} strokeWidth={4} fill="none" opacity={0.9}>
                <path d="M84 248 H120" />
                <path d="M84 266 H120" />
              </g>
            </Part>
            <Line d="M96 286 L96 294 M102 285 L102 295 M108 284 L108 294 M114 283 L114 293" width={1.6} color={v('c-red')} />
            <g transform="translate(160 244)">
              {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx={0} cy={-6} rx={3.8} ry={5.6} transform={`rotate(${r})`} fill={v('c-cream')} stroke={INK_SOFT} strokeWidth={0.9} />)}
              <circle r={3.2} fill={v('c-mustard')} stroke={INK_SOFT} strokeWidth={0.9} />
            </g>
          </>
        ),
      };
    }

    // Фёдор Кузьмич, ~55: big round ruddy face, bushy grey-brown beard and moustache, fur ushanka with flaps, thick neck, barrel chest in a reindeer sweater.
    case 'fedor': {
      const sweater = 'color-mix(in srgb, var(--c-navy) 82%, var(--c-suit))';
      const flap = 'M78 92 C72 106 70 124 75 138 C80 148 91 146 91 138 C90 124 90 110 92 96 Z';
      const beard = 'color-mix(in srgb, var(--c-hair-brown) 44%, var(--c-hair-grey))';
      const deer = (x: number, y: number) => (
        <g key={x} transform={`translate(${x} ${y})`} fill={v('c-cream')} stroke={v('c-cream')} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx={0} cy={0} rx={11} ry={6} stroke="none" />
          <path d="M8 -3 L13 -12 M-7 5 L-8 13 M-3 5 L-3 13 M4 5 L4 13 M8 4 L9 12" fill="none" />
          <ellipse cx={15} cy={-13} rx={4.2} ry={3} stroke="none" />
          <path d="M14 -16 L12 -23 M12.5 -19.5 L8.5 -21 M17 -16 L19 -22 M18.5 -19 L22 -20" fill="none" strokeWidth={1.6} />
          <circle cx={19} cy={-12.5} r={1.5} fill={v('c-red')} stroke="none" />
        </g>
      );
      return {
        skin: v('c-skin-2'), hair: v('c-hair-grey'),
        head: 'M80 112 C79 84 98 66 121 66 C144 66 163 84 162 112 C161 138 146 164 121 166 C96 164 81 138 80 112 Z',
        chinY: 166, markAt: [190, 56], headDrop: 22,
        neck: 'M100 156 L100 206 Q121 214 142 206 L142 156 Z',
        body: 'M20 300 C20 258 30 232 64 220 C88 210 154 210 178 220 C212 232 222 258 222 300 Z',
        shoulder: { x: 32, y: 218 },
        outfit: sweater,
        face: {
          eyeY: 116, eyeDX: 17, eye: 'dot', browGap: 11, browLen: 15, browW: 4.2, browColor: beard, nose: 'round', noseY: 126,
          mouthY: 159, mouthW: 14, blush: true, lines: ['M96 118 L91 121 M96 124 L92 127', 'M146 118 L151 121 M146 124 L150 127'],
          moustache: 'M97 146 C101 134 114 135 121 141 C128 135 141 134 145 146 C143 155 134 157 128 153 C125 151 123 150 121 150 C119 150 117 151 114 153 C108 157 99 155 97 146 Z',
          moustacheColor: beard,
        },
        hairBack: [],
        hairFront: [
          { d: 'M78 92 C72 58 94 32 121 32 C148 32 170 58 164 92 C150 84 92 84 78 92 Z', color: 'color-mix(in srgb, var(--c-wood-2) 70%, var(--c-hair-brown))',
            hl: 'M92 50 C102 40 118 36 132 38', shade: [8, 8] },
          { d: 'M76 86 C76 76 84 72 92 74 L150 74 C158 72 166 76 166 86 C168 90 164 95 158 93 C152 97 144 92 138 94 C132 97 126 92 121 94 C115 97 109 92 104 94 C98 97 92 92 86 93 C79 95 74 90 76 86 Z',
            color: v('c-hair-grey'), hl: 'M86 80 C100 76 142 76 156 80', strands: 'M96 84 Q98 90 96 94 M112 82 Q114 90 112 94 M130 82 Q132 90 130 94 M146 84 Q148 90 146 94', shade: [6, 6] },
          { d: flap, color: v('c-hair-grey'), strands: 'M80 104 Q78 124 82 142 M86 98 Q84 120 86 144', shade: [4, 4] },
          { d: mir(flap), color: v('c-hair-grey'), strands: 'M162 104 Q164 124 160 142 M156 98 Q158 120 156 144', shade: [4, 4] },
          { d: 'M84 124 C80 146 84 172 100 186 C108 194 114 198 121 198 C128 198 134 194 142 186 C158 172 162 146 158 124 C154 134 148 140 142 142 C134 138 126 136 121 136 C116 136 108 138 100 142 C94 140 88 134 84 124 Z',
            color: beard, hl: 'M92 150 C94 164 102 178 112 186', strands: 'M96 152 Q100 170 110 184 M146 152 Q142 170 132 184 M121 172 L121 192 M108 164 Q112 176 118 190 M134 164 Q130 176 124 190', shade: [8, 8] },
        ],
        neckwear: <Part d="M92 200 C100 192 142 192 150 200 L154 216 C142 226 100 226 88 216 Z" fill={v('c-cream')} shade={[5, 5]} stroke={SEAM} ink={INK_SOFT} />,
        bodyDetails: (
          <g>
            <g fill={v('c-cream')} opacity={0.95}>
              {Array.from({ length: 14 }, (_, i) => <path key={`a${i}`} d={`M${34 + i * 12} 232 l6 -8 l6 8 Z`} />)}
              {Array.from({ length: 14 }, (_, i) => <path key={`b${i}`} d={`M${34 + i * 12} 290 l6 8 l6 -8 Z`} />)}
            </g>
            <Line d="M40 236 H202 M40 286 H202" width={1.6} color={v('c-cream')} />
            {deer(98, 264)}{deer(146, 264)}
          </g>
        ),
      };
    }

    // Илья, ~25: wide face with a strong jaw, ears that stick out, spiky messy crop, freckles and stubble, khaki ranger jacket with a fir patch.
    case 'ilya': {
      const khaki = 'color-mix(in srgb, var(--c-green) 60%, var(--c-mustard))';
      const dark = 'color-mix(in srgb, var(--c-green) 55%, var(--c-navy))';
      const ear = 'M84 108 C74 103 72 119 77 126 C81 131 87 128 88 122 Z';
      const side = 'M82 100 L86 122 L92 118 L92 98 Z';
      const collar = 'M98 197 L121 230 L108 240 L88 206 Z';
      return {
        skin: v('c-skin-2'), hair: 'color-mix(in srgb, var(--c-hair-brown) 62%, var(--c-mustard))',
        head: 'M82 102 C80 74 100 58 121 58 C142 58 162 74 160 102 C160 118 158 134 150 146 C144 156 134 162 121 162 C108 162 98 156 92 146 C84 134 82 118 82 102 Z',
        chinY: 162, markAt: [186, 48], headDrop: 14,
        ears: [ear, mir(ear)],
        neck: 'M107 150 L107 204 Q121 210 135 204 L135 150 Z',
        body: 'M38 300 C38 252 46 220 76 207 C94 199 148 199 166 207 C196 220 204 252 204 300 Z',
        shoulder: { x: 44, y: 206 },
        outfit: khaki,
        face: {
          eyeY: 114, eyeDX: 16, eye: 'wide', browGap: 13, browLen: 13, browW: 2.8, nose: 'wide', noseY: 130,
          mouthY: 144, mouthW: 20, freckles: true, stubble: { y0: 138, y1: 158, hw: 29 },
        },
        hairBack: [
          { d: 'M88 92 C80 66 92 44 120 40 C150 38 166 62 156 92 C150 78 140 70 121 70 C102 70 92 78 88 92 Z', shade: [6, 5] },
          { d: 'M112 50 C110 36 118 26 130 22 C128 32 130 42 136 50 Z', shade: [3, 3] },
        ],
        hairFront: [
          { d: 'M82 100 C78 78 86 58 104 50 C110 40 124 32 140 35 C152 34 162 42 164 54 C168 70 166 88 160 100 C156 92 154 88 150 84 L146 94 L138 82 L130 92 L122 80 L112 92 L104 82 L98 92 C92 92 86 96 82 100 Z',
            hl: 'M98 54 C114 42 136 40 152 48', strands: 'M110 54 Q114 44 124 40 M126 50 Q132 44 142 42 M142 56 Q150 52 156 56', shade: [5, 6] },
          { d: side, shade: [2, 2] },
          { d: mir(side), shade: [2, 2] },
        ],
        neckwear: <Part d="M100 196 L121 226 L142 196 Z" fill={v('c-cream')} shade={[4, 6]} light={null} stroke={SEAM} ink={INK_SOFT} />,
        bodyDetails: <Line d="M121 232 L121 300" width={SEAM} color={INK_SOFT} />,
        chest: (
          <>
            <Part d={collar} fill={khaki} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
            <Part d={mir(collar)} fill={khaki} shade={[4, 4]} stroke={SEAM} ink={INK_SOFT} />
            <Line d="M121 230 L121 300" width={SEAM} color={INK_SOFT} />
            <Part d="M82 252 H112 V280 H82 Z" fill={khaki} shade={[4, 4]} light={null} stroke={SEAM} ink={INK_SOFT} />
            <Part d="M82 252 H112 V262 L97 268 L82 262 Z" fill={khaki} shade={[3, 4]} light={null} stroke={SEAM} ink={INK_SOFT} />
            <circle cx={97} cy={263} r={2.4} fill={v('c-mustard')} stroke={INK_SOFT} strokeWidth={0.9} />
            <Part d="M138 232 H162 V252 C162 260 150 264 150 264 C150 264 138 260 138 252 Z" fill={dark} shade={[3, 4]} light={null} stroke={SEAM} ink={INK_SOFT}>
              <path d="M150 237 L144 246 H147 L142 254 H158 L153 246 H156 Z" fill={v('c-cream')} />
              <rect x={148.5} y={254} width={3} height={4} fill={v('c-cream')} />
            </Part>
          </>
        ),
      };
    }

    // Макс, 19: narrow face with a pointed chin, big ears, messy mop with a cowlick, freckles, long neck, lanky, hoodie.
    default: return {
      skin: v('c-skin-2'), hair: v('c-hair-dark'),
      head: 'M89 104 C87 76 102 60 122 60 C142 60 156 76 154 104 C152 128 140 154 121 159 C103 154 91 130 89 104 Z',
      chinY: 159, markAt: [178, 50], headDrop: 12,
      ears: ['M92 100 C74 90 68 118 78 128 C85 135 94 130 94 120 Z', 'M151 100 C169 90 175 118 165 128 C158 135 149 130 149 120 Z'],
      neck: 'M112 146 L112 202 Q121 208 130 202 L130 146 Z',
      body: 'M58 300 C58 254 64 218 88 204 C100 198 142 198 154 204 C178 218 184 254 184 300 Z',
      shoulder: { x: 66, y: 210 },
      outfit: v('c-orange'),
      face: { eyeY: 112, eyeDX: 14, eye: 'round', browGap: 13, browLen: 12, browW: 2, nose: 'pointy', noseY: 125, mouthY: 140, mouthW: 18, freckles: true },
      hairBack: [
        { d: 'M118 50 C114 36 122 24 134 20 C130 30 132 40 138 48 Z', shade: [3, 3] },
        { d: 'M150 56 C158 46 170 46 176 52 C168 54 162 60 160 68 Z', shade: [3, 3] },
        { d: 'M82 114 C70 80 86 46 120 42 C156 38 178 66 166 112 C162 96 150 84 124 82 C100 82 88 96 82 114 Z', shade: [8, 4] },
      ],
      hairFront: [{
        d: 'M80 104 C76 84 82 62 98 52 C110 44 136 42 152 50 C168 58 172 78 166 98 C162 92 158 88 154 86 C156 94 154 100 150 104 C146 96 140 90 134 88 C134 96 130 102 124 106 C122 98 118 92 112 90 C110 98 104 104 98 106 C98 98 96 92 92 90 C88 96 84 100 80 104 Z',
        hl: 'M100 56 C114 48 136 48 150 56', strands: 'M106 64 Q110 76 108 88 M128 60 Q132 72 130 84 M146 64 Q150 74 150 82', shade: [5, 6],
      }],
      neckwear: (
        <Part d="M84 210 C88 190 154 190 158 210 C150 224 92 224 84 210 Z" fill={v('c-orange')} shade={[5, 6]} stroke={SEAM} ink={INK_SOFT}>
          <path d="M96 204 C104 214 138 214 146 204 C138 208 104 208 96 204 Z" fill={v('c-shade')} />
        </Part>
      ),
      bodyDetails: (
        <g>
          <Line d="M108 222 L104 262 M134 222 L138 262" width={1.8} color={INK_SOFT} />
          <circle cx={104} cy={264} r={2.8} fill={v('c-cream')} stroke={INK_SOFT} strokeWidth={1} />
          <circle cx={138} cy={264} r={2.8} fill={v('c-cream')} stroke={INK_SOFT} strokeWidth={1} />
          <Line d="M90 282 Q121 290 152 282" width={SEAM} color={INK_SOFT} />
          <Part d={ellipse(150, 240, 10, 10)} fill={v('c-navy')} shade={[2, 2]} light={null} stroke={SEAM} ink={INK_SOFT} />
          <circle cx={150} cy={240} r={2.6} fill={v('c-mustard')} />
        </g>
      ),
    };
  }
}

// ------------------------------------------------------------------ faces from the passport
function Eyes({ f, mood }: { f: FaceSpec; mood: Mood }) {
  const xs = [120 - f.eyeDX, 120 + f.eyeDX];
  if (mood === 'joy') {
    return <>{xs.map((x) => <Line key={x} d={`M${x - 4} ${f.eyeY + 1} Q${x} ${f.eyeY - 4} ${x + 4} ${f.eyeY + 1}`} width={2.2} />)}</>;
  }
  const size = { dot: [2.6, 3.2], round: [3.4, 4.2], sleepy: [3, 2.5], narrow: [3.2, 2.6], wide: [3.6, 4.8] }[f.eye];
  const ry = mood === 'puzzled' ? size[1] * 1.3 : size[1];
  const [dx, dy] = mood === 'thinking' ? [1.6, -1.6] : [0, 0];
  return (
    <>
      {xs.map((x) => (
        <g key={x}>
          <ellipse cx={x + dx} cy={f.eyeY + dy} rx={size[0]} ry={ry} fill={v('c-eye')} />
          {f.eye !== 'sleepy' && f.eye !== 'narrow' && <circle cx={x + dx + 1.1} cy={f.eyeY + dy - 1.4} r={1} fill={v('c-cream')} />}
          {f.eye === 'sleepy' && <Line d={`M${x - 6} ${f.eyeY - 2.5} Q${x} ${f.eyeY - 6} ${x + 6} ${f.eyeY - 2.5}`} width={1.6} />}
          {f.eye === 'narrow' && <Line d={`M${x - 6} ${f.eyeY - 2.2} L${x + 6} ${f.eyeY - 2.2}`} width={2} />}
          {f.lashes && <Line d={x < 120 ? `M${x - size[0]} ${f.eyeY - 1} L${x - size[0] - 3.5} ${f.eyeY - 4}` : `M${x + size[0]} ${f.eyeY - 1} L${x + size[0] + 3.5} ${f.eyeY - 4}`} width={1.6} />}
        </g>
      ))}
    </>
  );
}

function Brows({ f, mood }: { f: FaceSpec; mood: Mood }) {
  const y = f.eyeY - f.browGap;
  const h = f.browLen / 2;
  const brow = (cx: number, side: 1 | -1) => {
    const inner = cx - side * h, outer = cx + side * h;
    switch (mood) {
      case 'joy': return `M${inner} ${y - 2} Q${cx} ${y - 7} ${outer} ${y - 3}`;
      case 'annoyed': return `M${inner} ${y + 3} L${outer} ${y - 2}`;
      case 'puzzled': return side < 0 ? `M${inner} ${y - 4} Q${cx} ${y - 9} ${outer} ${y - 4}` : `M${inner} ${y + 1} L${outer} ${y + 1}`;
      case 'thinking': return side < 0 ? `M${inner} ${y} L${outer} ${y}` : `M${inner} ${y - 3} Q${cx} ${y - 8} ${outer} ${y - 4}`;
      default: return `M${inner} ${y} Q${cx} ${y - 3} ${outer} ${y + 1}`;
    }
  };
  const sides: [number, 1 | -1][] = [[120 - f.eyeDX, -1], [120 + f.eyeDX, 1]];
  return (
    <>
      {sides.map(([cx, s]) => (
        <g key={cx}>
          {f.browColor && <Line d={brow(cx, s)} width={f.browW + 1.4} color={INK_SOFT} />}
          <Line d={brow(cx, s)} width={f.browW} color={f.browColor ?? INK} />
        </g>
      ))}
    </>
  );
}

function Nose({ f }: { f: FaceSpec }) {
  const y = f.noseY;
  switch (f.nose) {
    case 'dots': return <g><circle cx={117.5} cy={y} r={1.2} fill={INK} /><circle cx={122.5} cy={y} r={1.2} fill={INK} /></g>;
    case 'long': return <Line d={`M121 ${y - 16} C118 ${y - 8} 115 ${y - 2} 117 ${y + 1} Q121 ${y + 4} 125 ${y}`} width={1.4} />;
    case 'wide': return <Line d={`M114 ${y - 1} Q117 ${y + 4} 121 ${y + 2} Q125 ${y + 4} 128 ${y - 1}`} width={1.4} />;
    case 'sharp': return <Line d={`M123 ${y - 14} L120 ${y + 1} L124 ${y + 2}`} width={1.4} />;
    case 'round': return (
      <g>
        <ellipse cx={121} cy={y} rx={7} ry={6} fill={v('c-blush')} opacity={0.75} />
        <Line d={`M115 ${y + 3} Q121 ${y + 8} 127 ${y + 3}`} width={1.2} color={INK_SOFT} />
      </g>
    );
    case 'pointy': return <Line d={`M122 ${y - 8} L116 ${y + 1} Q119 ${y + 3} 123 ${y + 2}`} width={1.4} />;
    default: return <Line d={`M117 ${y} Q120 ${y + 3} 123 ${y}`} width={1.4} />;
  }
}

function Mouth({ f, mood }: { f: FaceSpec; mood: Mood }) {
  const y = f.mouthY, h = f.mouthW / 2;
  switch (mood) {
    case 'joy':
      return (
        <g>
          <path d={`M${120 - h - 1} ${y - 1} Q120 ${y + 13} ${120 + h + 1} ${y - 1} Z`} fill={v('c-mouth')} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <path d={`M${120 - h / 2} ${y + 6} Q120 ${y + 10} ${120 + h / 2} ${y + 6} Q120 ${y + 3} ${120 - h / 2} ${y + 6} Z`} fill={v('c-blush')} />
        </g>
      );
    case 'puzzled': return <ellipse cx={121} cy={y + 2} rx={3} ry={3.8} fill={v('c-mouth')} stroke={INK} strokeWidth={1.3} />;
    case 'annoyed': return <Line d={`M${120 - h} ${y + 2} Q120 ${y - 2} ${120 + h} ${y + 2}`} width={1.8} color={f.mouthColor} />;
    case 'thinking': return <Line d={`M${120 - h + 3} ${y + 2} Q123 ${y + 1} ${120 + h} ${y - 3}`} width={1.8} color={f.mouthColor} />;
    default: return <Line d={`M${120 - h} ${y} Q120 ${y + 5} ${120 + h} ${y}`} width={1.8} color={f.mouthColor} />;
  }
}

function Stubble({ f }: { f: FaceSpec }) {
  const { y0, y1, hw } = f.stubble!;
  const dots: [number, number][] = [];
  let row = 0;
  for (let y = y0; y <= y1; y += 4.5, row++) {
    const w = hw * (1 - Math.pow((y - y0) / (y1 - y0), 1.6) * 0.72);
    for (let x = 120 - w + (row % 2) * 2.2; x <= 120 + w; x += 4.5) {
      if (Math.abs(x - 120) < f.mouthW / 2 + 3 && Math.abs(y - f.mouthY) < 5) continue;
      dots.push([x, y]);
    }
  }
  return <g fill={INK_SOFT} opacity={0.75}>{dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.75} />)}</g>;
}

function Face({ s, mood }: { s: Spec; mood: Mood }) {
  const f = s.face;
  const eyes = [120 - f.eyeDX, 120 + f.eyeDX];
  const half = f.glasses === 'round' ? 11 : 12;
  return (
    <g>
      {f.lines?.map((d) => <Line key={d} d={d} width={SEAM} color={INK_SOFT} />)}
      {f.freckles && [[101, 127], [106, 131], [97, 132], [139, 127], [134, 131], [143, 132]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill={v('c-freckle')} />)}
      {f.stubble && <Stubble f={f} />}
      <Eyes f={f} mood={mood} />
      <Brows f={f} mood={mood} />
      <Nose f={f} />
      <Mouth f={f} mood={mood} />
      {f.moustache && <Part d={f.moustache} fill={f.moustacheColor ?? v('c-hair-grey')} shade={[3, 3]} light={null} stroke={OVER} />}
      {f.glasses === 'round' && eyes.map((x) => <circle key={x} cx={x} cy={f.eyeY} r={11} fill={v('c-glass')} stroke={INK} strokeWidth={1.6} />)}
      {f.glasses === 'rect' && eyes.map((x) => <rect key={x} x={x - 12} y={f.eyeY - 8} width={24} height={16} rx={5} fill={v('c-glass')} stroke={INK} strokeWidth={1.6} />)}
      {f.glasses === 'cat' && eyes.map((x, i) => {
        const o = i === 0 ? -1 : 1; // outer side
        const y = f.eyeY;
        return <path key={x} d={`M${x - o * 11} ${y - 3} Q${x - o * 4} ${y - 8} ${x + o * 11} ${y - 8} Q${x + o * 14} ${y - 4} ${x + o * 11} ${y + 3} Q${x + o * 6} ${y + 10} ${x - o * 3} ${y + 8} Q${x - o * 11} ${y + 6} ${x - o * 11} ${y - 3} Z`} fill={v('c-glass')} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />;
      })}
      {f.glasses && <Line d={`M${eyes[0] + half} ${f.eyeY - 1} Q120 ${f.eyeY - 5} ${eyes[1] - half} ${f.eyeY - 1}`} width={1.6} />}
    </g>
  );
}

function MoodMark({ mood, at: [x, y] }: { mood: Mood; at: [number, number] }) {
  if (mood === 'joy') return <path d={`M${x} ${y - 12} C${x + 2} ${y - 4} ${x + 4} ${y - 2} ${x + 12} ${y} C${x + 4} ${y + 2} ${x + 2} ${y + 4} ${x} ${y + 12} C${x - 2} ${y + 4} ${x - 4} ${y + 2} ${x - 12} ${y} C${x - 4} ${y - 2} ${x - 2} ${y - 4} ${x} ${y - 12} Z`} fill={v('c-mustard')} stroke={INK} strokeWidth={1.2} />;
  if (mood === 'puzzled') return <text x={x - 7} y={y + 10} fontSize={30} fontWeight={800} fontFamily="var(--font-ui)" fill={v('c-red')} stroke={INK} strokeWidth={1}>?</text>;
  if (mood === 'thinking') return <g fill={v('c-cream')} stroke={INK} strokeWidth={1.2}><circle cx={x - 10} cy={y + 8} r={3} /><circle cx={x} cy={y - 3} r={5} /><circle cx={x + 13} cy={y - 18} r={7} /></g>;
  if (mood === 'annoyed') return <Line d={`M${x - 7} ${y - 3} Q${x - 3} ${y} ${x - 7} ${y + 4} M${x} ${y - 6} Q${x + 2} ${y} ${x + 6} ${y - 2}`} width={2.4} color={v('c-red')} />;
  return null;
}

// ------------------------------------------------------------------ arms from each person's shoulders
interface ArmPiece { d: string; fill: 'sleeve' | 'skin'; mirror?: boolean; front?: boolean; seam?: string }

const openHand = (cx: number, cy: number) =>
  `M${cx - 11} ${cy + 4} C${cx - 13} ${cy - 6} ${cx - 12} ${cy - 16} ${cx - 8} ${cy - 22} C${cx - 6} ${cy - 25} ${cx - 2} ${cy - 24} ${cx - 2} ${cy - 20} C${cx - 1} ${cy - 26} ${cx + 4} ${cy - 27} ${cx + 5} ${cy - 21} C${cx + 7} ${cy - 25} ${cx + 12} ${cy - 23} ${cx + 11} ${cy - 16} C${cx + 11} ${cy - 10} ${cx + 12} ${cy - 6} ${cx + 16} ${cy - 10} C${cx + 20} ${cy - 12} ${cx + 21} ${cy - 6} ${cx + 17} ${cy - 2} C${cx + 13} ${cy + 4} ${cx + 8} ${cy + 8} ${cx} ${cy + 8} C${cx - 6} ${cy + 8} ${cx - 10} ${cy + 7} ${cx - 11} ${cy + 4} Z`;
const palmUp = (cx: number, cy: number) =>
  `M${cx + 10} ${cy - 8} C${cx} ${cy - 12} ${cx - 12} ${cy - 11} ${cx - 18} ${cy - 5} C${cx - 22} ${cy} ${cx - 18} ${cy + 5} ${cx - 11} ${cy + 3} C${cx - 4} ${cy + 9} ${cx + 6} ${cy + 9} ${cx + 11} ${cy + 4} Z`;
/** Finger tips peeking from under a crossed arm. */
const tucked = (cx: number, cy: number, dir: 1 | -1) =>
  `M${cx} ${cy - 7} C${cx + dir * 10} ${cy - 9} ${cx + dir * 16} ${cy - 4} ${cx + dir * 15} ${cy + 1} C${cx + dir * 14} ${cy + 6} ${cx + dir * 4} ${cy + 7} ${cx} ${cy + 6} Z`;
const tuckedLines = (cx: number, cy: number, dir: 1 | -1) =>
  `M${cx + dir * 6} ${cy - 7} Q${cx + dir * 8} ${cy} ${cx + dir * 6} ${cy + 6} M${cx + dir * 11} ${cy - 6} Q${cx + dir * 13} ${cy} ${cx + dir * 11} ${cy + 5}`;
const fistLines = (cx: number, cy: number) =>
  `M${cx - 6} ${cy - 11} Q${cx - 8} ${cy - 3} ${cx - 6} ${cy + 5} M${cx + 1} ${cy - 12} Q${cx - 1} ${cy - 3} ${cx + 1} ${cy + 7} M${cx + 8} ${cy - 10} Q${cx + 6} ${cy - 2} ${cx + 8} ${cy + 5}`;
const fist = (cx: number, cy: number) =>
  `M${cx - 12} ${cy + 2} C${cx - 14} ${cy - 8} ${cx - 6} ${cy - 14} ${cx + 2} ${cy - 13} C${cx + 10} ${cy - 12} ${cx + 15} ${cy - 6} ${cx + 14} ${cy + 2} C${cx + 13} ${cy + 9} ${cx + 6} ${cy + 13} ${cx - 2} ${cy + 12} C${cx - 8} ${cy + 11} ${cx - 11} ${cy + 8} ${cx - 12} ${cy + 2} Z`;

function armPieces(s: Spec, pose: Pose): ArmPiece[] {
  const { x: lx, y: sy } = s.shoulder;
  const rx = 240 - lx;
  const down = `M${lx + 16} ${sy - 4} C${lx + 2} ${sy + 2} ${lx - 8} ${sy + 24} ${lx - 10} ${sy + 52} C${lx - 12} ${sy + 76} ${lx - 8} ${sy + 98} ${lx - 6} 300 L${lx + 22} 300 C${lx + 20} ${sy + 96} ${lx + 20} ${sy + 70} ${lx + 24} ${sy + 48} C${lx + 26} ${sy + 34} ${lx + 30} ${sy + 22} ${lx + 34} ${sy + 12} Z`;
  const downSeam = `M${lx + 34} ${sy + 12} C${lx + 30} ${sy + 22} ${lx + 26} ${sy + 34} ${lx + 24} ${sy + 48} C${lx + 20} ${sy + 70} ${lx + 20} ${sy + 96} ${lx + 22} 300`;
  // Raised arm in one piece: upper arm out to a rounded elbow, forearm straight up, the same width all the way.
  // Wide-shouldered figures: the raised arm and the open palm stay inside the 240-wide frame.
  const wl = Math.max(lx, 46);
  const wave = `M${wl + 14} ${sy - 4} C${wl + 4} ${sy + 2} ${wl - 4} ${sy + 8} ${wl - 12} ${sy + 14} C${wl - 14} ${sy - 4} ${wl - 16} ${sy - 24} ${wl - 18} ${sy - 40} L${wl - 40} ${sy - 38} C${wl - 40} ${sy - 14} ${wl - 42} ${sy + 12} ${wl - 36} ${sy + 30} C${wl - 32} ${sy + 42} ${wl - 18} ${sy + 44} ${wl - 6} ${sy + 38} C${wl + 4} ${sy + 34} ${wl + 12} ${sy + 30} ${wl + 20} ${sy + 28} Z`;
  const shrug = `M${lx + 16} ${sy - 4} C${lx + 2} ${sy + 2} ${lx - 8} ${sy + 24} ${lx - 10} ${sy + 48} C${lx - 12} ${sy + 60} ${Math.max(lx - 20, 12)} ${sy + 66} ${Math.max(lx - 32, 10)} ${sy + 66} L${Math.max(lx - 34, 8)} ${sy + 86} C${lx - 14} ${sy + 88} ${lx + 2} ${sy + 86} ${lx + 12} ${sy + 74} C${lx + 20} ${sy + 60} ${lx + 26} ${sy + 36} ${lx + 34} ${sy + 12} Z`;
  const cy = s.chinY + s.headDrop;
  switch (pose) {
    case 'wave': return [
      { d: down, fill: 'sleeve', seam: downSeam },
      // The raised arm passes in front of the hair: it gets its own thin outline.
      { d: wave, fill: 'sleeve', mirror: true, front: true },
      { d: openHand(wl - 29, sy - 46), fill: 'skin', mirror: true, front: true },
    ];
    case 'shrug': return [
      { d: shrug, fill: 'sleeve' }, { d: shrug, fill: 'sleeve', mirror: true },
      { d: palmUp(Math.max(lx - 38, 24), sy + 76), fill: 'skin' }, { d: palmUp(Math.max(lx - 38, 24), sy + 76), fill: 'skin', mirror: true },
    ];
    case 'cross': return [
      { d: down, fill: 'sleeve' }, { d: down, fill: 'sleeve', mirror: true },
      { d: `M${lx - 2} ${sy + 44} C${lx + 26} ${sy + 38} ${rx - 26} ${sy + 38} ${rx + 2} ${sy + 44} C${rx + 8} ${sy + 56} ${rx + 6} ${sy + 70} ${rx - 4} ${sy + 78} C${rx - 30} ${sy + 90} ${lx + 30} ${sy + 90} ${lx + 4} ${sy + 78} C${lx - 6} ${sy + 70} ${lx - 8} ${sy + 56} ${lx - 2} ${sy + 44} Z`,
        fill: 'sleeve', front: true, seam: `M120 ${sy + 48} Q118 ${sy + 66} 121 ${sy + 84}` },
      { d: tucked(lx + 10, sy + 58, 1), fill: 'skin', front: true, seam: tuckedLines(lx + 10, sy + 58, 1) },
      { d: tucked(rx - 10, sy + 70, -1), fill: 'skin', front: true, seam: tuckedLines(rx - 10, sy + 70, -1) },
    ];
    case 'chin': return [
      { d: down, fill: 'sleeve', seam: downSeam }, { d: down, fill: 'sleeve', mirror: true },
      { d: `M${rx + 8} ${sy + 66} C${rx + 4} ${sy + 84} ${rx - 12} ${sy + 92} ${rx - 26} ${sy + 86} C${rx - 42} ${sy + 76} 150 ${cy + 40} 138 ${cy + 26} L156 ${cy + 12} C168 ${cy + 28} ${rx - 18} ${sy + 52} ${rx - 6} ${sy + 58} Z`, fill: 'sleeve', front: true },
      { d: fist(142, cy + 6), fill: 'skin', front: true, seam: fistLines(142, cy + 6) },
    ];
    default: return [{ d: down, fill: 'sleeve', seam: downSeam }, { d: down, fill: 'sleeve', mirror: true, seam: downSeam }];
  }
}

function ArmFill({ a, s }: { a: ArmPiece; s: Spec }) {
  const fill = a.fill === 'skin' ? s.skin : s.outfit;
  // Mirrored pieces flip the shading offsets back, so the light still comes from the upper-left.
  return (
    <g transform={a.mirror ? MIRROR : undefined}>
      <Part d={a.d} fill={fill} shade={a.mirror ? [-8, 4] : [8, 4]} light={a.mirror ? [-3, 3] : [3, 3]} stroke={a.front ? OVER : 0} />
      {a.seam && <Line d={a.seam} width={SEAM} color={INK_SOFT} />}
    </g>
  );
}

function HairFill({ lock, color, own }: { lock: Lock; color: string; own: boolean }) {
  return (
    <Part d={lock.d} fill={lock.color ?? color} shade={lock.shade ?? [8, 7]} light={[2, 3]} stroke={own ? OVER : 0}>
      {lock.hl && <Line d={lock.hl} width={3.2} color={v('c-hair-light')} />}
      {lock.strands && <Line d={lock.strands} width={SEAM} color={INK_SOFT} />}
    </Part>
  );
}

/** Nestable art: a <g> in the 240×300 space. `drop` paints the soft shadow of the figure on the wall. */
export function CharacterV2Art({ id, mood = 'neutral', drop = false }: { id: V2Id; mood?: Mood; drop?: boolean }) {
  const s = spec(id);
  const arms = armPieces(s, POSE[mood]);
  const head = `translate(0 ${s.headDrop})`;
  const back = arms.filter((a) => !a.front);
  const silhouette: { d: string; transform?: string }[] = [
    ...s.hairBack.map((l) => ({ d: l.d, transform: head })),
    { d: s.body }, { d: s.neck },
    ...back.map((a) => ({ d: a.d, transform: a.mirror ? MIRROR : undefined })),
    ...(s.ears ?? []).map((d) => ({ d, transform: head })),
    { d: s.head, transform: head },
  ];
  return (
    <g>
      {drop && <g transform="translate(16 10)" fill={v('c-drop')}>{silhouette.map((p, i) => <path key={i} d={p.d} transform={p.transform} />)}</g>}
      <Silhouette shapes={silhouette} />
      <g transform={head}>{s.hairBack.map((l, i) => <HairFill key={i} lock={l} color={s.hair} own={false} />)}</g>
      <Part d={s.body} fill={s.outfit} shade={[14, 6]} stroke={0}>{s.bodyDetails}</Part>
      {back.map((a, i) => <ArmFill key={i} a={a} s={s} />)}
      <Part d={s.neck} fill={s.skin} shade={[6, 4]} light={null} stroke={0}>
        <rect x={90} y={s.chinY + s.headDrop - 14} width={60} height={20} fill={v('c-shade')} />
      </Part>
      {s.neckwear}
      {s.chest}
      <g transform={head}>
        {s.ears?.map((d) => <Part key={d} d={d} fill={s.skin} shade={[3, 3]} stroke={0} />)}
        <Part d={s.head} fill={s.skin} shade={[11, 3]} stroke={OVER}>
          {s.face.blush && [120 - s.face.eyeDX - 4, 120 + s.face.eyeDX + 4].map((x) => (
            <ellipse key={x} cx={x} cy={s.face.eyeY + 15} rx={8} ry={4.5} fill={v('c-blush')} opacity={0.5} />
          ))}
          {s.hairFront[0] && <path d={s.hairFront[0].d} fill={v('c-shade')} transform="translate(3 7)" />}
        </Part>
        {s.hairFront.map((l, i) => <HairFill key={i} lock={l} color={s.hair} own />)}
        {s.hairAccent}
        <Face s={s} mood={mood} />
        <MoodMark mood={mood} at={s.markAt} />
      </g>
      {arms.filter((a) => a.front).map((a, i) => <ArmFill key={`f${i}`} a={a} s={s} />)}
    </g>
  );
}

export function CharacterV2({ id, mood = 'neutral', size = 240, title }: { id: V2Id; mood?: Mood; size?: number; title?: string }) {
  return (
    <svg viewBox="0 0 240 300" width={size} height={size * 1.25} role="img" aria-label={title ?? V2_NAMES[id]} style={{ display: 'block', overflow: 'visible' }}>
      <CharacterV2Art id={id} mood={mood} />
    </svg>
  );
}
