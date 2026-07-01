/**
 * Selector DSL — tokenizer + recursive-descent parser → {@link SelectorNode} AST.
 *
 * Pure string→AST (no OCC, no descriptors). Grammar (loosest→tightest binding):
 *
 *   or    := and ( 'or' and )*
 *   and   := unary ( ('and')? unary )*        // juxtaposition = implicit AND
 *   unary := ('not' | 'exc') unary | primary
 *   primary := '(' or ')' | TOKEN
 *
 * Primaries: `>Z` `<Z` `>>Z` `>Z[1]` · `|Z` · `#Z` · `+Z` `-Z` · `%plane` ·
 * `radius(2)` · `near(1,2,3)`. Axis ∈ {X,Y,Z}, case-insensitive.
 *
 * A clean-room reimplementation of the *semantics* documented in CadQuery's
 * `selectors.py` (Apache-2.0, reference only) — no source is copied.
 */

import type { Axis, SelectorNode } from './types';

class SelectorSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelectorSyntaxError';
  }
}

type Token =
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'and' }
  | { t: 'or' }
  | { t: 'not' }
  | { t: 'prim'; node: SelectorNode };

const up = (s: string) => s.toUpperCase() as Axis;

/** Ordered scanners; each tries to match at the string start and yields a token
 *  (or null to skip, for whitespace). First match wins, so order matters. */
const SCANNERS: [RegExp, (m: RegExpMatchArray) => Token | null][] = [
  [/^\s+/, () => null],
  [/^\(/, () => ({ t: 'lparen' })],
  [/^\)/, () => ({ t: 'rparen' })],
  [/^(and|or|not|exc)\b/i, (m) => {
    const k = m[1].toLowerCase();
    return { t: k === 'or' ? 'or' : k === 'and' ? 'and' : 'not' };
  }],
  [/^near\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i,
    (m) => ({ t: 'prim', node: { kind: 'near', point: { x: +m[1], y: +m[2], z: +m[3] } } })],
  [/^radius\(\s*(\d+)\s*\)/i,
    (m) => ({ t: 'prim', node: { kind: 'radiusNth', nth: +m[1], max: false } })],
  [/^%([A-Za-z]+)/,
    (m) => ({ t: 'prim', node: { kind: 'type', geomType: m[1].toLowerCase() } })],
  // `>Z`, `<Z`, `>>Z` (alias), `>Z[1]` — backref \1 forces the doubled char to match.
  [/^([<>])\1?([XYZ])(?:\[(\d+)\])?/i,
    (m) => ({ t: 'prim', node: { kind: 'dirMinMax', axis: up(m[2]), max: m[1] === '>', nth: m[3] !== undefined ? +m[3] : undefined } })],
  [/^\|([XYZ])/i, (m) => ({ t: 'prim', node: { kind: 'parallel', axis: up(m[1]) } })],
  [/^#([XYZ])/i, (m) => ({ t: 'prim', node: { kind: 'perpendicular', axis: up(m[1]) } })],
  [/^([+\-])([XYZ])/i, (m) => ({ t: 'prim', node: { kind: 'directed', axis: up(m[2]), positive: m[1] === '+' } })],
];

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let rest = input;
  while (rest.length > 0) {
    let matched = false;
    for (const [re, make] of SCANNERS) {
      const m = rest.match(re);
      if (!m) continue;
      const tok = make(m);
      if (tok) tokens.push(tok);
      rest = rest.slice(m[0].length);
      matched = true;
      break;
    }
    if (!matched) throw new SelectorSyntaxError(`Unexpected token near "${rest}"`);
  }
  return tokens;
}

/** Parse a selector string into an AST. Throws {@link SelectorSyntaxError}. */
export function parse(input: string): SelectorNode {
  const tokens = tokenize(input);
  if (tokens.length === 0) throw new SelectorSyntaxError('Empty selector');

  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const startsTerm = (tok: Token | undefined) =>
    !!tok && (tok.t === 'prim' || tok.t === 'lparen' || tok.t === 'not');

  const parseOr = (): SelectorNode => {
    let left = parseAnd();
    while (peek()?.t === 'or') {
      pos++;
      left = { kind: 'or', left, right: parseAnd() };
    }
    return left;
  };

  const parseAnd = (): SelectorNode => {
    let left = parseUnary();
    // Explicit `and`, or implicit juxtaposition (next token starts a new term).
    while (peek()?.t === 'and' || startsTerm(peek())) {
      if (peek()?.t === 'and') pos++;
      left = { kind: 'and', left, right: parseUnary() };
    }
    return left;
  };

  const parseUnary = (): SelectorNode => {
    if (peek()?.t === 'not') {
      pos++;
      return { kind: 'not', operand: parseUnary() };
    }
    return parsePrimary();
  };

  const parsePrimary = (): SelectorNode => {
    const tok = peek();
    if (!tok) throw new SelectorSyntaxError('Unexpected end of selector');
    if (tok.t === 'lparen') {
      pos++;
      const inner = parseOr();
      if (peek()?.t !== 'rparen') throw new SelectorSyntaxError('Missing ")"');
      pos++;
      return inner;
    }
    if (tok.t === 'prim') {
      pos++;
      return tok.node;
    }
    throw new SelectorSyntaxError(`Unexpected token "${tok.t}"`);
  };

  const ast = parseOr();
  if (pos !== tokens.length) throw new SelectorSyntaxError('Trailing tokens in selector');
  return ast;
}

export { SelectorSyntaxError };
