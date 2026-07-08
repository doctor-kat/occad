import { describe, it, expect } from "vitest";
import {
  orderKey,
  compareBuildOrder,
  isRolledBack,
  rollbackIndexForThreshold,
  rollbackThresholdForIndex,
  type OrderableItem,
} from "./buildOrder";

const item = (id: string, createdAt: number, sequence?: number): OrderableItem => ({
  id,
  createdAt,
  ...(sequence !== undefined ? { sequence } : {}),
});

describe("orderKey", () => {
  it("uses createdAt when no sequence is set", () => {
    expect(orderKey(item("a", 100))).toBe(100);
  });

  it("prefers an explicit sequence over createdAt", () => {
    expect(orderKey(item("a", 100, 250))).toBe(250);
  });

  it("treats sequence 0 as a real override (not falsy-skipped)", () => {
    expect(orderKey(item("a", 100, 0))).toBe(0);
  });
});

describe("compareBuildOrder", () => {
  it("orders by key ascending", () => {
    const items = [item("a", 300), item("b", 100), item("c", 200)];
    items.sort(compareBuildOrder);
    expect(items.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks createdAt ties by id deterministically", () => {
    // Same millisecond — without a tiebreaker the order would depend on
    // Array.sort stability / input order. Both input orderings must agree.
    const forward = [item("zeta", 100), item("alpha", 100)].sort(compareBuildOrder);
    const reverse = [item("alpha", 100), item("zeta", 100)].sort(compareBuildOrder);
    expect(forward.map((i) => i.id)).toEqual(["alpha", "zeta"]);
    expect(reverse.map((i) => i.id)).toEqual(["alpha", "zeta"]);
  });

  it("produces a total order independent of input permutation", () => {
    const base = [
      item("a", 100),
      item("b", 100), // tie with a -> id breaks it
      item("c", 50),
      item("d", 100, 75), // sequence override lands between c(50) and a(100)
    ];
    const expected = ["c", "d", "a", "b"]; // 50, 75, 100/a, 100/b
    // Shuffle a few permutations; all must sort to the same total order.
    const permutations = [
      [base[0], base[1], base[2], base[3]],
      [base[3], base[2], base[1], base[0]],
      [base[2], base[0], base[3], base[1]],
    ];
    for (const perm of permutations) {
      expect([...perm].sort(compareBuildOrder).map((i) => i.id)).toEqual(expected);
    }
  });

  it("lets a reordered item (sequence) jump position without touching createdAt", () => {
    const items = [item("first", 100), item("second", 200), item("third", 300)];
    // Move "third" to the front by giving it a sequence below "first".
    const moved = items.map((i) => (i.id === "third" ? { ...i, sequence: 50 } : i));
    moved.sort(compareBuildOrder);
    expect(moved.map((i) => i.id)).toEqual(["third", "first", "second"]);
  });
});

describe("history rollback bar", () => {
  describe("isRolledBack", () => {
    it("rolls back nothing when the bar is undefined", () => {
      expect(isRolledBack(item("a", 100))).toBe(false);
      expect(isRolledBack(item("a", 100), null)).toBe(false);
    });

    it("rolls back items strictly past the bar (the item at the bar stays active)", () => {
      expect(isRolledBack(item("a", 100), 150)).toBe(false); // above
      expect(isRolledBack(item("a", 150), 150)).toBe(false); // exactly at
      expect(isRolledBack(item("a", 200), 150)).toBe(true); // below
    });

    it("uses the sequence override, not createdAt", () => {
      expect(isRolledBack(item("a", 999, 50), 100)).toBe(false);
    });
  });

  describe("index ↔ threshold round-trips", () => {
    const keys = [100, 200, 300];

    it("undefined threshold = bar at the bottom (all active)", () => {
      expect(rollbackIndexForThreshold(keys, undefined)).toBe(3);
    });

    it("counts active items at/above the bar", () => {
      expect(rollbackIndexForThreshold(keys, 250)).toBe(2);
      expect(rollbackIndexForThreshold(keys, 50)).toBe(0);
    });

    it("index at/beyond the end clears the bar (no rollback)", () => {
      expect(rollbackThresholdForIndex(keys, 3)).toBeUndefined();
      expect(rollbackThresholdForIndex(keys, 99)).toBeUndefined();
    });

    it("index 0 rolls everything back", () => {
      const t = rollbackThresholdForIndex(keys, 0);
      expect(rollbackIndexForThreshold(keys, t)).toBe(0);
    });

    it("a mid threshold slots between neighbours and round-trips", () => {
      for (let i = 0; i <= keys.length; i++) {
        const t = rollbackThresholdForIndex(keys, i);
        expect(rollbackIndexForThreshold(keys, t)).toBe(i);
      }
    });
  });
});
