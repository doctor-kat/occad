import { describe, it, expect } from 'vitest';
import { arcElementFrom, lastEndTangent } from '@/cad/sketch/geometry/arcElementFactory';
import { SketchElementType } from '@/cad/types';
import type { SketchElement } from '@/cad/types';
import type { ArcGeometry } from '@/cad/sketch/geometry/arcGeometry';

describe('arcElementFrom', () => {
  it('builds an ARC element from solved arc geometry', () => {
    const geometry: ArcGeometry = {
      center: { x: 1, y: 2 },
      radius: 5,
      startAngle: 0,
      endAngle: Math.PI,
    };
    const el = arcElementFrom(geometry);
    expect(el.type).toBe(SketchElementType.ARC);
    expect(el).toMatchObject({
      center: { x: 1, y: 2 },
      radius: 5,
      startAngle: 0,
      endAngle: Math.PI,
    });
    expect(el.id).toBeTruthy();
  });
});

describe('lastEndTangent', () => {
  it('falls back to +X for an empty sketch', () => {
    expect(lastEndTangent([])).toEqual({ x: 1, y: 0 });
  });

  it('skips construction lines and uses the last real element', () => {
    const elements: SketchElement[] = [
      {
        type: SketchElementType.LINE,
        id: 'l1',
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
      },
      {
        type: SketchElementType.LINE,
        id: 'l2-construction',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 10 },
        construction: true,
      },
    ];
    expect(lastEndTangent(elements)).toEqual({ x: 1, y: 0 });
  });
});
