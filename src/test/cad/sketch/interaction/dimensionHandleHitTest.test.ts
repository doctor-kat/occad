import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { hitsDimensionHandle, DIMENSION_HANDLE_USERDATA_KEY } from '@/cad/sketch/interaction/dimensionHandleHitTest';

/**
 * Regression coverage for the "dragging a dimension label starts a box-select"
 * bug (fixed once via a `viewportStore.draggingDimensionLabel` flag set from the
 * label mesh's onPointerDown — but that fix assumed r3f's own event dispatcher
 * fires before SketchOverlay's raw canvas `pointerdown` listener, when in fact
 * the opposite is guaranteed: React fires child effects before parent effects,
 * so the deeply-nested SketchOverlay's listener attaches, and therefore fires,
 * before r3f's own top-level dispatcher — the flag was never set in time).
 *
 * `hitsDimensionHandle` sidesteps event ordering entirely: it raycasts straight
 * against the scene using the same camera/pointer math SketchOverlay already
 * has, so there's nothing to race.
 *
 * It also had to move off a "nearest hit wins" model: SketchOverlay's own
 * semi-transparent background click-plane sits at a small z-offset from the
 * workplane, and dimension handles sit at a different small z-offset on
 * whichever side of it the workplane's normal happens to put them — so for
 * some workplane orientations the background plane (untagged) is *nearer*
 * the camera than the dimension handle it's stacked on top of, and a
 * nearest-only check picked the wrong one. These are invisible hit-test
 * proxies, not opaque occluding geometry, so any tagged hit along the ray
 * counts, regardless of distance.
 */
function camera() {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

function centeredRaycaster() {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera());
  return raycaster;
}

describe('hitsDimensionHandle', () => {
  it('returns true when the nearest hit is tagged as a dimension handle', () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 2));
    mesh.userData[DIMENSION_HANDLE_USERDATA_KEY] = true;
    scene.add(mesh);

    expect(hitsDimensionHandle(centeredRaycaster(), scene)).toBe(true);
  });

  it('returns false when the nearest hit is untagged sketch geometry (e.g. the sketch plane)', () => {
    const scene = new THREE.Scene();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100));
    scene.add(plane);

    expect(hitsDimensionHandle(centeredRaycaster(), scene)).toBe(false);
  });

  it('returns false when nothing is hit (empty space)', () => {
    const scene = new THREE.Scene();
    expect(hitsDimensionHandle(centeredRaycaster(), scene)).toBe(false);
  });

  it('returns true for a tagged hit behind an untagged one — nearest-hit-only would miss this', () => {
    const scene = new THREE.Scene();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(10, 10));
    back.position.z = -5;
    back.userData[DIMENSION_HANDLE_USERDATA_KEY] = true;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(10, 10));
    front.position.z = 5;
    scene.add(back, front);
    scene.updateMatrixWorld(true); // positions only take effect in raycasting once matrixWorld is current

    expect(hitsDimensionHandle(centeredRaycaster(), scene)).toBe(true);
  });

  it('returns false when every hit along the ray is untagged, even with several stacked meshes', () => {
    const scene = new THREE.Scene();
    for (const z of [-5, 0, 5]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 10));
      m.position.z = z;
      scene.add(m);
    }
    scene.updateMatrixWorld(true);

    expect(hitsDimensionHandle(centeredRaycaster(), scene)).toBe(false);
  });
});
