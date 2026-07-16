import { describe, it, expect } from 'vitest';
import { parse, tokenize, SelectorSyntaxError } from '@/cad/solid/selectors/grammar';
import type { SelectorNode } from '@/cad/solid/selectors/SelectorNode';

describe('selector grammar — primaries', () => {
  it('parses directional min/max', () => {
    expect(parse('>Z')).toEqual({ kind: 'dirMinMax', axis: 'Z', max: true, nth: undefined });
    expect(parse('<x')).toEqual({ kind: 'dirMinMax', axis: 'X', max: false, nth: undefined });
  });

  it('parses the >> alias same as >', () => {
    expect(parse('>>Y')).toEqual({ kind: 'dirMinMax', axis: 'Y', max: true, nth: undefined });
  });

  it('parses an nth index', () => {
    expect(parse('>Z[1]')).toEqual({ kind: 'dirMinMax', axis: 'Z', max: true, nth: 1 });
    expect(parse('<Y[0]')).toEqual({ kind: 'dirMinMax', axis: 'Y', max: false, nth: 0 });
  });

  it('parses parallel / perpendicular / directed', () => {
    expect(parse('|Z')).toEqual({ kind: 'parallel', axis: 'Z' });
    expect(parse('#X')).toEqual({ kind: 'perpendicular', axis: 'X' });
    expect(parse('+Z')).toEqual({ kind: 'directed', axis: 'Z', positive: true });
    expect(parse('-y')).toEqual({ kind: 'directed', axis: 'Y', positive: false });
  });

  it('parses type / radius / near', () => {
    expect(parse('%Plane')).toEqual({ kind: 'type', geomType: 'plane' });
    expect(parse('radius(2)')).toEqual({ kind: 'radiusNth', nth: 2, max: false });
    expect(parse('near(1, -2, 3.5)')).toEqual({ kind: 'near', point: { x: 1, y: -2, z: 3.5 } });
  });
});

describe('selector grammar — composition & precedence', () => {
  it('treats juxtaposition as AND', () => {
    expect(parse('>Z %plane')).toEqual<SelectorNode>({
      kind: 'and',
      left: { kind: 'dirMinMax', axis: 'Z', max: true, nth: undefined },
      right: { kind: 'type', geomType: 'plane' },
    });
  });

  it('binds AND tighter than OR', () => {
    // "A or B C" === "A or (B and C)"
    const ast = parse('|X or |Y #Z') as Extract<SelectorNode, { kind: 'or' }>;
    expect(ast.kind).toBe('or');
    expect(ast.left).toEqual({ kind: 'parallel', axis: 'X' });
    expect(ast.right).toEqual({
      kind: 'and',
      left: { kind: 'parallel', axis: 'Y' },
      right: { kind: 'perpendicular', axis: 'Z' },
    });
  });

  it('honors parentheses over precedence', () => {
    const ast = parse('(|X or |Y) #Z') as Extract<SelectorNode, { kind: 'and' }>;
    expect(ast.kind).toBe('and');
    expect(ast.left).toEqual({
      kind: 'or',
      left: { kind: 'parallel', axis: 'X' },
      right: { kind: 'parallel', axis: 'Y' },
    });
    expect(ast.right).toEqual({ kind: 'perpendicular', axis: 'Z' });
  });

  it('parses not / exc as unary complement', () => {
    expect(parse('not %plane')).toEqual({ kind: 'not', operand: { kind: 'type', geomType: 'plane' } });
    expect(parse('exc |Z')).toEqual({ kind: 'not', operand: { kind: 'parallel', axis: 'Z' } });
  });

  it('is whitespace-insensitive and case-insensitive for keywords', () => {
    expect(parse('%plane AND >Z')).toEqual(parse('%plane >z'));
  });
});

describe('selector grammar — errors', () => {
  it('rejects empty input', () => {
    expect(() => parse('   ')).toThrow(SelectorSyntaxError);
  });

  it('rejects unknown tokens', () => {
    expect(() => parse('>Q')).toThrow(SelectorSyntaxError);
    expect(() => parse('@foo')).toThrow(SelectorSyntaxError);
  });

  it('rejects unbalanced parentheses', () => {
    expect(() => parse('(>Z')).toThrow(SelectorSyntaxError);
    expect(() => parse('>Z)')).toThrow(SelectorSyntaxError);
  });

  it('tokenize skips whitespace and yields primitives', () => {
    expect(tokenize('  >Z ')).toEqual([
      { t: 'prim', node: { kind: 'dirMinMax', axis: 'Z', max: true, nth: undefined } },
    ]);
  });
});
