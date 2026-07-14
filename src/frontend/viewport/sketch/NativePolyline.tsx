import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import type { PolyPoint } from './PolyPoint';

/** No-op raycast: visible but never an intersection target (see SketchOverlay). */
const NO_RAYCAST = () => null;

export interface NativePolylineProps {
  /** Ordered vertices of the polyline (close it yourself by repeating the first point). */
  points: PolyPoint[];
  color: string;
  opacity?: number;
  /** Dashed (used for construction / external geometry). */
  dashed?: boolean;
  position?: [number, number, number];
  renderOrder?: number;
}

/**
 * A polyline rendered with a **native** `THREE.Line` + `LineBasicMaterial` —
 * deliberately NOT drei's `<Line>` (which is a `Line2`/`LineMaterial` fat line).
 *
 * Why this exists: the fat-line (`Line2`) shader renders nothing on some GPU /
 * ANGLE driver backends, so sketch entities and the draw preview were invisible
 * for some users while the native grid/crosshair (also `LineBasicMaterial`) drew
 * fine. Native GL lines are width-1 (the GPU ignores `linewidth > 1` on most
 * platforms) but render reliably everywhere, which matters far more here than a
 * fat stroke. Hover/selection are conveyed by color, not width.
 */
export function NativePolyline({
  points,
  color,
  opacity = 1,
  dashed = false,
  position = [0, 0, 0],
  renderOrder = 1,
}: NativePolylineProps) {
  const geometry = useMemo(() => {
    const verts = points.map((p) =>
      Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : p
    );
    const geo = new THREE.BufferGeometry().setFromPoints(verts);
    if (dashed) {
      // `Line.computeLineDistances()` lives on the object, not the geometry; populate
      // the cumulative `lineDistance` attribute ourselves so the dashed material works.
      const dist = new Float32Array(verts.length);
      for (let i = 1; i < verts.length; i++) {
        dist[i] = dist[i - 1] + verts[i].distanceTo(verts[i - 1]);
      }
      geo.setAttribute('lineDistance', new THREE.BufferAttribute(dist, 1));
    }
    return geo;
    // points is rebuilt by callers each render; serialize so we only recompute on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points), dashed]);

  // Dispose the GPU buffer when the geometry is replaced or the line unmounts.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <line geometry={geometry} position={position} renderOrder={renderOrder} raycast={NO_RAYCAST}>
      {dashed ? (
        <lineDashedMaterial color={color} transparent opacity={opacity} dashSize={1.5} gapSize={1} depthTest={false} />
      ) : (
        <lineBasicMaterial color={color} transparent opacity={opacity} depthTest={false} />
      )}
    </line>
  );
}
