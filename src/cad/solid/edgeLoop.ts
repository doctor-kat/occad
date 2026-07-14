/**
 * "Select Loop" support: pick the closed edge loop containing a picked edge.
 *
 * A loop is a topological wire — the ring of edges bounding a face. The OCC
 * extraction (walking the body's wires and their edges) lives in the worker;
 * this pure helper does the selection given the extracted wire membership, so it
 * can be unit tested without the WASM kernel.
 */

/**
 * Given every wire in the body as a list of its (global 0-based) edge indices,
 * return the edges of the loop containing `edgeIndex` — the first wire that
 * includes it (an edge shared by two wires is arbitrary but stable). Returns
 * `[edgeIndex]` when no wire contains it (e.g. a free edge), so the caller always
 * gets a non-empty selection to highlight.
 */
export function pickLoop(wires: number[][], edgeIndex: number): number[] {
  for (const wire of wires) {
    if (wire.includes(edgeIndex)) {
      // De-dupe (a wire can list an edge twice — seam edges) and keep order.
      return Array.from(new Set(wire));
    }
  }
  return [edgeIndex];
}
