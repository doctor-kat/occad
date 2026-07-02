import { forwardRef, type CSSProperties, type SVGProps } from 'react';

export interface CadIconProps extends SVGProps<SVGSVGElement> {
  /** Width & height in pixels. Default 24. */
  size?: number | string;
}

/**
 * Design palette from the "CAD Icon System" canvas.
 *
 * `--ink` defaults to `currentColor` so glyphs inherit the surrounding text
 * color and stay legible on any background (the source canvas hard-codes a
 * dark ink for a light page). Every variable can be overridden per-usage via
 * `style` — e.g. `<LineIcon style={{ '--accent': 'var(--mantine-color-cyan-5)' }} />`.
 */
const paletteVars = {
  '--ink': 'currentColor',
  '--sw': 1.7,
  '--accent': '#2563c4',
  // Filled faces (Extrude Boss, Shell, Rib, …). The source canvas uses opaque
  // pale tints (#dde8fb) meant for a light page; those read as bright white
  // patches on the dark app theme. Resolve to a translucent wash of the accent
  // instead — a subtle fill that tracks the accent color and never goes white.
  '--accent-tint': 'color-mix(in srgb, var(--accent) 20%, transparent)',
  '--accent2': '#2f9e5f',
  '--accent2-tint': 'color-mix(in srgb, var(--accent2) 20%, transparent)',
  '--sec': '#d97328',
  '--sec-tint': 'color-mix(in srgb, var(--sec) 20%, transparent)',
} as CSSProperties;

const rootStyle: CSSProperties = {
  display: 'block',
  overflow: 'visible',
  fill: 'none',
  stroke: 'var(--ink)',
  strokeWidth: 'var(--sw)',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/**
 * Base wrapper for every generated CAD glyph. Renders a 32×32 viewBox SVG,
 * supplies the design palette as CSS custom properties, and forwards all
 * standard SVG props (`className`, `style`, `onClick`, `aria-*`, …).
 */
export const CadIcon = forwardRef<SVGSVGElement, CadIconProps>(
  ({ size = 24, style, children, ...rest }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={{ ...paletteVars, ...rootStyle, ...style }}
      {...rest}
    >
      {children}
    </svg>
  ),
);

CadIcon.displayName = 'CadIcon';
