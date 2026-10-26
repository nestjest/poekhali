// Style v2 primitives: pastel cel-shading in pure SVG (docs/world.md §9).
// Light comes from the upper-left. A part = base fill (+ details clipped inside) + one hard shadow
// crescent on the lower-right + one thin highlight on the upper-left + (optionally) its own outline.
// A whole figure gets ONE outline along its outer edge (`Silhouette`), so arms, neck and body read as one body.
import { useId, type ReactNode } from 'react';

export const v = (name: string) => `var(--${name})`;
export const INK = v('c-ink');
export const INK_SOFT = v('c-ink-soft');
export const INK_BG = v('c-ink-bg');

/** Visible width of the outer contour of a figure (thin, like a pencil line). */
export const OUTLINE = 2;
/** Own outline of pieces lying over the figure (fringe on the face, a hand in front). */
export const OVER = 1.6;
/** Inner seams and folds. */
export const SEAM = 1.2;
export const DETAIL = 1.5;

interface PartProps {
  d: string;
  fill: string;
  /** Shadow offset: bigger → wider shadow crescent. */
  shade?: [number, number];
  /** Highlight offset; `null` turns the highlight off. */
  light?: [number, number] | null;
  /** Own outline width; 0 = none (the figure silhouette draws it). */
  stroke?: number;
  ink?: string;
  /** Details painted inside the shape (stripes, blush, cast shadows) — under the shading. */
  children?: ReactNode;
  transform?: string;
}

/** «Everything except the shape»: a huge frame + the shape, even-odd. Moved, it leaves a crescent inside the shape. */
const outside = (d: string) => `M-5000 -5000 H5000 V5000 H-5000 Z ${d}`;

export function Part({ d, fill, shade = [10, 6], light = [3, 3], stroke = OVER, ink = INK, children, transform }: PartProps) {
  // One clipPath per part (no masks or filters: they are slow on weak school PCs).
  const id = useId().replace(/:/g, '');
  return (
    <g transform={transform}>
      <defs><clipPath id={`c${id}`}><path d={d} /></clipPath></defs>
      <path d={d} fill={fill} />
      <g clipPath={`url(#c${id})`}>
        {children}
        <path d={outside(d)} fillRule="evenodd" fill={v('c-shade')} transform={`translate(${-shade[0]} ${-shade[1]})`} />
        {light && <path d={outside(d)} fillRule="evenodd" fill={v('c-light')} transform={`translate(${light[0]} ${light[1]})`} />}
      </g>
      {stroke > 0 && <path d={d} fill="none" stroke={ink} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />}
    </g>
  );
}

/** One outline around the union of shapes: each shape is stroked twice as wide UNDER the fills,
 *  so only the outer edge of the whole figure stays visible — no seams between body, arms and neck. */
export function Silhouette({ shapes, width = OUTLINE, ink = INK }: { shapes: { d: string; transform?: string }[]; width?: number; ink?: string }) {
  return (
    <g fill={ink} stroke={ink} strokeWidth={width * 2} strokeLinejoin="round" strokeLinecap="round">
      {shapes.map((s, i) => <path key={i} d={s.d} transform={s.transform} />)}
    </g>
  );
}

/** A thin line (fold, seam, nose, brow). */
export function Line({ d, width = DETAIL, color = INK, opacity }: { d: string; width?: number; color?: string; opacity?: number }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />;
}

/** Soft contact shadow (radial gradient, no blur filter). */
export function SoftShadow({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <g>
      <defs>
        <radialGradient id={`g${id}`}>
          <stop offset="0%" stopColor={v('c-ink')} stopOpacity={0.24} />
          <stop offset="100%" stopColor={v('c-ink')} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#g${id})`} />
    </g>
  );
}
