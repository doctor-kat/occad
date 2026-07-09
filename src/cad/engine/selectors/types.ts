/**
 * Selector system — shared types (ROADMAP §9.1, TODO.md).
 *
 * A clean-room port of CadQuery's *selector concept*: a small declarative DSL
 * (`>Z`, `|Z`, `%plane`, `>Z[1]`, `and`/`or`/`not`, …) that picks edges/faces by
 * geometry instead of by fragile ordinal index. This module holds only the
 * serializable/pure shapes; extraction from OCC lives in `describe.ts`, parsing
 * in `grammar.ts`, and matching in `evaluate.ts` — all pure and unit-testable.
 */

export enum Axis {
  X = 'X',
  Y = 'Y',
  Z = 'Z',
}

