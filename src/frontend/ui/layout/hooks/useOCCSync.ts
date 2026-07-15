import { useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import * as occClient from '@/worker/bridge/occWorkerClient';
import { useOccStore } from '@/frontend/shared/occStore';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { projectApi } from '@/frontend/shared/projectApi';
import { syncElementsFromPrimitives } from '@/cad/sketch/solver';
import { resolveTessellationQuality } from '@/cad/types';
import { shouldRebuild, type RebuildInputs } from '@/cad/solid/rebuild/rebuildScheduler';
import type {
  CADProject,
  SketchPlane,
  TessellationLevel,
} from '@/cad/types';
import { PlaneType } from '@/cad/types';

interface UseOCCSyncArgs {
  project: CADProject;
  tessellationLevel: TessellationLevel;
}

/**
 * The remaining irreducible glue between the OCC worker client (occWorkerClient +
 * occStore) and app state: forwards worker orchestration events into projectApi /
 * viewportStore, and drives rebuild/remesh/clear via the pure rebuildScheduler
 * policy. Components read worker output state directly from useOccStore and call
 * occWorkerClient functions imperatively — this hook returns nothing.
 */
export function useOCCSync(args: UseOCCSyncArgs): void {
  // Keep a ref to the latest args so the event subscribers (registered once on
  // mount) always invoke the current callbacks rather than stale closures.
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  });

  useEffect(() => {
    const unsubscribers = [
      occClient.on('sketchBuilt', (sketchId, _meshData, solvedSketch) => {
        if (solvedSketch) {
          // The solver only updates `primitives`; without this, `elements` (what
          // SketchOverlay renders) stays at its pre-solve position and a driving
          // dimension shows two copies of the shape — see syncElementsFromPrimitives.
          const synced = {
            ...solvedSketch,
            elements: syncElementsFromPrimitives(solvedSketch.elements, solvedSketch.primitives),
          };
          projectApi.updateSketchState(sketchId, synced);
        }
      }),

      occClient.on('featureBuilt', () => {
        notifications.show({ color: 'green', message: 'Feature built successfully' });
      }),

      occClient.on('rebuildComplete', () => {
        notifications.show({ color: 'green', message: 'Rebuild complete' });
      }),

      occClient.on('faceGeometry', (faceId, origin, normal, boundaryEdges) => {
        const { pendingSketchOnFace, setPendingSketchOnFace } = useViewportStore.getState();
        if (pendingSketchOnFace !== faceId) return;

        const { project } = argsRef.current;

        const plane: SketchPlane = {
          type: PlaneType.CUSTOM,
          planeRef: `face-${faceId}`,
          offset: 0,
          origin,
          normal,
        };

        const newSketch = projectApi.addSketch(`Sketch ${project.sketches.length + 1}`, plane);

        // Import boundary edges as external fixed primitives
        if (boundaryEdges && boundaryEdges.length > 0) {
          const externalPrims = boundaryEdges.map((edgeTag) => ({
            id: crypto.randomUUID(),
            type: 'line' as const, // Placeholder, worker will refine
            data: {},
            fixed: true,
            isExternal: true,
            sourceId: edgeTag,
          }));
          const updatedSketch = { ...newSketch, primitives: externalPrims };
          projectApi.updateSketchState(newSketch.id, updatedSketch);
          occClient.buildSketch(updatedSketch);
        }

        projectApi.startSketchEdit(newSketch.id);
        projectApi.selectTreeItem(newSketch.id);
        notifications.show({
          color: 'blue',
          message: `Sketch created on Face ${faceId + 1} with ${boundaryEdges?.length || 0} imported edges`,
        });
        setPendingSketchOnFace(null);
      }),

      occClient.on('refsEnriched', (enrichments) => {
        // Persist lazily-captured fingerprints (no version bump -> no rebuild loop).
        projectApi.applyRefEnrichments(enrichments);
      }),

      occClient.on('sketchRefsEnriched', (enrichments) => {
        // Persist external-geometry fingerprints (no version bump). See step 3c.
        projectApi.applySketchRefEnrichments(enrichments);
      }),

      occClient.on('error', (message, featureId) => {
        if (featureId) {
          useViewportStore.getState().setItemError(featureId, message);
        } else {
          notifications.show({ color: 'red', title: 'Error', message });
          useViewportStore.getState().setPendingSketchOnFace(null);
        }
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  // Rebuild/remesh/clear driven by the pure rebuildScheduler policy.
  const prevInputsRef = useRef<RebuildInputs | null>(null);
  const status = useOccStore((s) => s.status);

  useEffect(() => {
    if (status !== 'ready') return;

    const next: RebuildInputs = {
      projectId: args.project.id,
      version: args.project.version,
      tessellationLevel: args.tessellationLevel,
    };

    const verdict = shouldRebuild(prevInputsRef.current, next);

    switch (verdict) {
      case 'clear':
        occClient.clearMesh();
        if (next.version !== 0) {
          useViewportStore.getState().clearAllItemErrors();
          occClient.rebuild(args.project, resolveTessellationQuality(next.tessellationLevel));
        }
        break;
      case 'rebuild':
        useViewportStore.getState().clearAllItemErrors();
        occClient.rebuild(args.project, resolveTessellationQuality(next.tessellationLevel));
        break;
      case 'remesh':
        occClient.rebuild(args.project, resolveTessellationQuality(next.tessellationLevel));
        break;
      case 'none':
        break;
    }

    prevInputsRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.project.id, args.project.version, args.tessellationLevel, status]);
}
