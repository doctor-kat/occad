import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CadIcon, LineIcon, ExtrudeBossIcon, cadIconManifest } from './index';
import * as icons from './cad-icons';

describe('CadIcon', () => {
  it('renders a 32x32 viewBox svg sized by the size prop', () => {
    const { container } = render(<CadIcon size={40} data-testid="i" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 32 32');
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '40');
  });

  it('defaults --ink to currentColor so glyphs inherit text color', () => {
    const { container } = render(<CadIcon />);
    const svg = container.querySelector('svg')!;
    expect(svg.style.getPropertyValue('--ink')).toBe('currentColor');
    expect(svg.style.stroke).toBe('var(--ink)');
  });

  it('forwards arbitrary svg props (className, onClick target, aria)', () => {
    const { container } = render(<CadIcon className="tool" aria-label="Line" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveClass('tool');
    expect(svg).toHaveAttribute('aria-label', 'Line');
  });
});

describe('CAD icon set', () => {
  it('LineIcon draws its geometry inside the base svg', () => {
    const { container } = render(<LineIcon />);
    expect(container.querySelector('svg line')).toBeInTheDocument();
    // accent detail dots preserved from the source
    expect(container.querySelectorAll('svg circle').length).toBe(2);
  });

  it('feature glyphs preserve their multi-color fills', () => {
    const { container } = render(<ExtrudeBossIcon />);
    const tinted = [...container.querySelectorAll('svg path')].some((p) =>
      (p as SVGElement).style.fill.includes('var(--accent-tint)'),
    );
    expect(tinted).toBe(true);
  });

  it('every manifest entry maps to an exported component', () => {
    expect(cadIconManifest.length).toBe(83);
    for (const meta of cadIconManifest) {
      const Comp = (icons as Record<string, unknown>)[meta.name];
      expect(typeof Comp, `${meta.name} should be exported`).toBe('function');
      const { container } = render(<Comp size={16} />);
      // each glyph renders at least one drawable element
      expect(container.querySelector('svg')!.children.length).toBeGreaterThan(0);
    }
  });
});
