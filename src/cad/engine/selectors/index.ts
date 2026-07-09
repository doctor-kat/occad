/**
 * Selector system — public entry point (ROADMAP §9.1).
 *
 * `selectSubShapes(descriptors, "|Z")` parses a selector string and returns the
 * matching sub-shape indices. Pure (no OCC); pair with `describe.ts` to turn an
 * OCC body into descriptors, and with `fingerprint.computeFingerprint` to turn
 * the resulting indices into stable, topology-proof `StableRef`s.
 */

import type { SelectorNode } from './SelectorNode';
import type { SubShapeDescriptor } from './SubShapeDescriptor';
import { parse, SelectorSyntaxError } from './grammar';
import { evaluate, type EvalOptions } from './evaluate';

export * from './types';
export * from './Vec3';
export * from './SubShapeDescriptor';
export * from './SelectorNode';
export { parse, tokenize, SelectorSyntaxError } from './grammar';
export { evaluate, type EvalOptions } from './evaluate';

/** Parse + evaluate a selector string against pre-extracted descriptors. */
export function selectSubShapes(
  descriptors: SubShapeDescriptor[],
  selector: string,
  options?: EvalOptions
): number[] {
  const ast: SelectorNode = parse(selector);
  return evaluate(ast, descriptors, options);
}

export { SelectorSyntaxError as SelectorError };
