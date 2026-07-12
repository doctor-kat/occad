import {
  CADProject,
  SketchElement,
  SketchElementType,
  Workplane,
  Point3D,
  Vector3D,
  PlaneType,
  orderKey,
} from '@/cad/types';

/**
 * Smallest gap used when snapping a reordered feature to just after its
 * consumed sketch. In the epoch-ms ordering domain this is far below any real
 * timestamp granularity, so it slots the feature immediately after the sketch
 * without disturbing other items.
 */
export const REORDER_EPSILON = 1e-6;

/**
 * Sequence to give a newly added sketch/feature so it lands just *before* the
 * rollback bar (i.e. as the last "present" item) instead of at the very end
 * where it would fall past the bar and be immediately rolled back / hidden.
 * Returns `undefined` when there is no active bar (append normally by createdAt).
 * See ROADMAP.md §8 "Insert feature while rolled back".
 */
export function sequenceAtBar(prev: CADProject): number | undefined {
  if (prev.rollbackBar == null) return undefined;
  const bar = prev.rollbackBar;
  const activeKeys = [...prev.sketches, ...prev.features]
    .flatMap((item) => {
      const k = orderKey(item);
      return k <= bar ? [k] : [];
    })
    .sort((a, b) => a - b);
  const lastActive = activeKeys.length ? activeKeys[activeKeys.length - 1] : bar - 1;
  return (lastActive + bar) / 2;
}

/** Create a Workplane (gp_Ax3) from plane definition */
export function createWorkplane(type: PlaneType, origin?: Point3D, normal?: Vector3D, offset: number = 0): Workplane {
  let finalOrigin: Point3D = origin || { x: 0, y: 0, z: 0 };
  let finalNormal: Vector3D = normal || { x: 0, y: 0, z: 1 };
  let xAxis: Vector3D = { x: 1, y: 0, z: 0 };
  let yAxis: Vector3D = { x: 0, y: 1, z: 0 };

  if (type === PlaneType.XY) {
    finalNormal = { x: 0, y: 0, z: 1 };
    xAxis = { x: 1, y: 0, z: 0 };
    yAxis = { x: 0, y: 1, z: 0 };
    finalOrigin = { x: 0, y: 0, z: offset };
  } else if (type === PlaneType.XZ) {
    // normal must equal xAxis × yAxis to keep the basis right-handed (matches XY/YZ below);
    // with xAxis=+X and yAxis=+Z that cross product is -Y, not +Y.
    finalNormal = { x: 0, y: -1, z: 0 };
    xAxis = { x: 1, y: 0, z: 0 };
    yAxis = { x: 0, y: 0, z: 1 };
    finalOrigin = { x: 0, y: offset, z: 0 };
  } else if (type === PlaneType.YZ) {
    finalNormal = { x: 1, y: 0, z: 0 };
    xAxis = { x: 0, y: 1, z: 0 };
    yAxis = { x: 0, y: 0, z: 1 };
    finalOrigin = { x: offset, y: 0, z: 0 };
  } else if (type === PlaneType.CUSTOM && normal) {
    // For custom planes, we need to derive xAxis and yAxis
    // Logic similar to OCC's gp_Ax2: choose an arbitrary X direction perpendicular to normal
    if (Math.abs(normal.x) < 0.9) {
      // Use (1,0,0) as reference
      const vx = 1, vy = 0, vz = 0;
      // Cross product: xAxis = reference X normal
      xAxis = {
        x: vy * normal.z - vz * normal.y,
        y: vz * normal.x - vx * normal.z,
        z: vx * normal.y - vy * normal.x
      };
    } else {
      // Use (0,1,0) as reference
      const vx = 0, vy = 1, vz = 0;
      xAxis = {
        x: vy * normal.z - vz * normal.y,
        y: vz * normal.x - vx * normal.z,
        z: vx * normal.y - vy * normal.x
      };
    }
    // Normalize xAxis
    const len = Math.sqrt(xAxis.x ** 2 + xAxis.y ** 2 + xAxis.z ** 2);
    xAxis = { x: xAxis.x / len, y: xAxis.y / len, z: xAxis.z / len };

    // yAxis = normal X xAxis
    yAxis = {
      x: normal.y * xAxis.z - normal.z * xAxis.y,
      y: normal.z * xAxis.x - normal.x * xAxis.z,
      z: normal.x * xAxis.y - normal.y * xAxis.x
    };
  }

  return { origin: finalOrigin, normal: finalNormal, xAxis, yAxis };
}

/** Check whether sketch elements form a closed wire (simplified heuristic). */
export function checkIfSketchClosed(elements: SketchElement[]): boolean {
  if (elements.length === 0) {
    return false;
  }

  // Rectangles, circles and ellipses are always closed
  const hasClosedElement = elements.some(
    (el) => el.type === SketchElementType.RECTANGLE || el.type === SketchElementType.CIRCLE || el.type === SketchElementType.ELLIPSE
  );

  if (hasClosedElement) return true;

  // For line-based sketches, check if first and last points match
  if (elements.length >= 3) {
    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];

    if (firstElement.type === SketchElementType.LINE && lastElement.type === SketchElementType.LINE) {
      const firstStart = firstElement.start;
      const lastEnd = lastElement.end;
      const tolerance = 0.001;

      return (
        Math.abs(firstStart.x - lastEnd.x) < tolerance &&
        Math.abs(firstStart.y - lastEnd.y) < tolerance
      );
    }
  }

  return false;
}

/** Migrate old persisted projects that lack isVisible on sketches and reference geometry */
export function migrateProject(raw: CADProject): CADProject {
  const needsMigration = raw.sketches.some(
    (s) => (s as any).isVisible === undefined || s.points === undefined || s.constraints === undefined
  );

  if (!needsMigration) return raw;

  const sketchIdsUsedByFeatures = new Set(
    raw.features.flatMap((f) => (f.sketchId ? [f.sketchId] : []))
  );

  return {
    ...raw,
    sketches: raw.sketches.map((sketch) => {
      const newSketch = { ...sketch };
      if (newSketch.points === undefined) {
        newSketch.points = [];
      }
      if (newSketch.constraints === undefined) {
        newSketch.constraints = [];
      }
      if ((newSketch as any).isVisible === undefined) {
        // Respect legacy `visible` property if it exists
        if ((newSketch as any).visible !== undefined) {
          (newSketch as any).isVisible = !!(newSketch as any).visible;
        } else {
          // Default: consumed sketches hidden, standalone visible
          const isConsumed = sketchIdsUsedByFeatures.has(sketch.id);
          (newSketch as any).isVisible = !isConsumed;
        }
      }
      return newSketch;
    }),
    referenceGeometry: raw.referenceGeometry.map((ref) => {
      if ((ref as any).isVisible !== undefined) return ref;
      // Respect legacy `visible` property if it exists
      if ((ref as any).visible !== undefined) {
        return { ...ref, isVisible: !!(ref as any).visible };
      }
      // Default: reference geometry hidden
      return { ...ref, isVisible: false };
    }),
  };
}
