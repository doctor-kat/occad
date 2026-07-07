import { Menu, Box } from '@mantine/core';
import type { CADProject, SketchElement } from '@/cad/types';
import { compareBuildOrder } from '@/cad/types';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { computeSketchChain } from './contextTarget';
import { midpointOf } from './sketchMidpoint';

export interface ViewportContextMenuProps {
  project: CADProject;
  /** Currently selected feature-tree item id (used to pick the face menu's target feature). */
  selectedTreeItem: string | null;
  /** Sketch currently being edited (its elements back the sketch-entity menu). */
  activeSketchId: string | null;
  /**
   * Owning feature id per CAD face (from the current mesh's `faceOwners`),
   * indexed by the face id a pick reports. Lets the face menu target the feature
   * that actually owns the clicked face (Edit Feature/Sketch, accurate
   * Suppress/Delete) instead of falling back to the tip feature.
   */
  faceOwners?: (string | null)[] | null;
  /** Open a feature or sketch for editing (feature panel / sketch edit mode). */
  onEditItem: (id: string) => void;
  /** Highlight the whole edge loop (bounding wire) containing the picked edge. */
  onSelectLoop: (edgeIndex: number) => void;
  /** Materialize (or reuse) a line's midpoint reference point, tie it there
   *  parametrically, and select it. Given the picked line's element id. */
  onSelectMidpoint: (lineId: string) => void;
  /** Toggle a feature's suppression (bumps version → rebuild). */
  onToggleSuppressFeature: (featureId: string) => void;
  /** Delete a feature (callback owns any confirmation UI). */
  onDeleteFeature: (featureId: string) => void;
  /** Replace the active sketch's elements (used to delete sketch entities). */
  onUpdateSketchElements: (sketchId: string, elements: SketchElement[]) => void;
}

/**
 * SolidWorks-style viewport right-click menu (ROADMAP §6b). A DOM overlay
 * positioned at the cursor; its contents come from what the click resolved to
 * (see resolveContextTarget). Rendered once at the CADLayout level so it can use
 * the project + feature/sketch actions directly.
 *
 * The face menu resolves the clicked face to its owning feature via the mesh's
 * `faceOwners` attribution (see faceAttribution.ts): Edit Feature / Edit Sketch
 * target that feature (and its sketch), and Suppress/Delete act on it. When a
 * face can't be attributed (owner-less), the menu falls back to the selected
 * tree feature, else the tip feature.
 *
 * Sketch entity → Select Midpoint materializes a construction point at a line's
 * midpoint and ties it there parametrically (onSelectMidpoint → CADLayout, which
 * adds a midpoint constraint so the point tracks the line); disabled for non-lines.
 */
export function ViewportContextMenu({
  project,
  selectedTreeItem,
  activeSketchId,
  faceOwners,
  onEditItem,
  onSelectLoop,
  onSelectMidpoint,
  onToggleSuppressFeature,
  onDeleteFeature,
  onUpdateSketchElements,
}: ViewportContextMenuProps) {
  const contextMenu = useViewportStore((s) => s.contextMenu);
  const closeContextMenu = useViewportStore((s) => s.closeContextMenu);
  const requestCameraView = useViewportStore((s) => s.requestCameraView);
  const setSketchElementSelection = useViewportStore((s) => s.setSketchElementSelection);
  const selectedSketchElementIds = useViewportStore((s) => s.selectedSketchElementIds);
  const clearSelection = useViewportStore((s) => s.clearSelection);

  if (!contextMenu) return null;
  const { x, y, target } = contextMenu;

  // Resolve the clicked face to its owning feature (face-accurate). Fall back to
  // the selected tree feature, else the tip (last-built) feature, when the face
  // is owner-less or the target isn't a face.
  const orderedFeatures = [...project.features].sort(compareBuildOrder);
  const tipFeature = orderedFeatures[orderedFeatures.length - 1];
  const selectedFeature = project.features.find((f) => f.id === selectedTreeItem);
  const ownerId = target.kind === 'face' ? faceOwners?.[target.faceId] ?? null : null;
  const ownerFeature = ownerId ? project.features.find((f) => f.id === ownerId) : undefined;
  const targetFeature = ownerFeature ?? selectedFeature ?? tipFeature;
  // The sketch behind the owning feature (Edit Sketch), when it is sketch-based.
  const ownerSketch =
    ownerFeature?.sketchId
      ? project.sketches.find((s) => s.id === ownerFeature.sketchId)
      : undefined;

  const activeSketch = activeSketchId ? project.sketches.find((s) => s.id === activeSketchId) : undefined;

  const close = () => closeContextMenu();

  const renderItems = () => {
    switch (target.kind) {
      case 'face':
        return (
          <>
            <Menu.Item
              disabled={!ownerFeature}
              onClick={() => {
                if (ownerFeature) onEditItem(ownerFeature.id);
                close();
              }}
            >
              Edit Feature{ownerFeature ? ` ${ownerFeature.name}` : ''}
            </Menu.Item>
            <Menu.Item
              disabled={!ownerSketch}
              onClick={() => {
                if (ownerSketch) onEditItem(ownerSketch.id);
                close();
              }}
            >
              Edit Sketch{ownerSketch ? ` ${ownerSketch.name}` : ''}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              disabled={!targetFeature}
              onClick={() => {
                if (targetFeature) onToggleSuppressFeature(targetFeature.id);
                close();
              }}
            >
              {targetFeature?.isSuppressed ? 'Unsuppress' : 'Suppress'}
              {targetFeature ? ` ${targetFeature.name}` : ''}
            </Menu.Item>
            <Menu.Item
              color="red"
              disabled={!targetFeature}
              onClick={() => {
                if (targetFeature) onDeleteFeature(targetFeature.id);
                close();
              }}
            >
              Delete{targetFeature ? ` ${targetFeature.name}` : ''}
            </Menu.Item>
          </>
        );

      case 'edge':
        return (
          <>
            <Menu.Item
              onClick={() => {
                onSelectLoop(target.edgeIndex);
                close();
              }}
            >
              Select Loop
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item onClick={() => { clearSelection(); close(); }}>Clear Selection</Menu.Item>
          </>
        );

      case 'sketch-entity': {
        const elements = activeSketch?.elements ?? [];
        const targetElement = elements.find((e) => e.id === target.elementId);
        // midpointOf is non-null only for straight lines — the sole case with a
        // single well-defined midpoint to select.
        const canMidpoint = !!targetElement && !!midpointOf(targetElement);
        return (
          <>
            <Menu.Item
              onClick={() => {
                setSketchElementSelection(computeSketchChain(elements, target.elementId));
                close();
              }}
            >
              Select Chain
            </Menu.Item>
            <Menu.Item
              disabled={!canMidpoint}
              onClick={() => {
                onSelectMidpoint(target.elementId);
                close();
              }}
            >
              Select Midpoint
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              color="red"
              onClick={() => {
                if (activeSketch) {
                  // Delete the whole current selection when the clicked entity is
                  // part of it; otherwise just the clicked entity.
                  const toDelete = selectedSketchElementIds.includes(target.elementId)
                    ? new Set(selectedSketchElementIds)
                    : new Set([target.elementId]);
                  onUpdateSketchElements(
                    activeSketch.id,
                    elements.filter((el) => !toDelete.has(el.id)),
                  );
                }
                close();
              }}
            >
              Delete
            </Menu.Item>
          </>
        );
      }

      case 'camera':
        return (
          <>
            <Menu.Item onClick={() => { requestCameraView('fit'); close(); }}>Zoom to Fit</Menu.Item>
            <Menu.Divider />
            <Menu.Label>Standard Views</Menu.Label>
            <Menu.Item onClick={() => { requestCameraView('front'); close(); }}>Front</Menu.Item>
            <Menu.Item onClick={() => { requestCameraView('back'); close(); }}>Back</Menu.Item>
            <Menu.Item onClick={() => { requestCameraView('top'); close(); }}>Top</Menu.Item>
            <Menu.Item onClick={() => { requestCameraView('bottom'); close(); }}>Bottom</Menu.Item>
            <Menu.Item onClick={() => { requestCameraView('left'); close(); }}>Left</Menu.Item>
            <Menu.Item onClick={() => { requestCameraView('right'); close(); }}>Right</Menu.Item>
            <Menu.Item onClick={() => { requestCameraView('iso'); close(); }}>Isometric</Menu.Item>
          </>
        );
    }
  };

  return (
    <Menu opened onClose={close} position="bottom-start" withinPortal shadow="md" width={200}>
      <Menu.Target>
        {/* Zero-size anchor pinned at the cursor; the dropdown opens from here. */}
        <Box style={{ position: 'fixed', left: x, top: y, width: 0, height: 0 }} />
      </Menu.Target>
      <Menu.Dropdown onContextMenu={(e) => e.preventDefault()}>{renderItems()}</Menu.Dropdown>
    </Menu>
  );
}
