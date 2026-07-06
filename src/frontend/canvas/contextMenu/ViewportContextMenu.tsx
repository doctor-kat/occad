import { Menu, Box } from '@mantine/core';
import type { CADProject, SketchElement } from '@/cad/types';
import { compareBuildOrder } from '@/cad/types';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { computeSketchChain } from './contextTarget';

export interface ViewportContextMenuProps {
  project: CADProject;
  /** Currently selected feature-tree item id (used to pick the face menu's target feature). */
  selectedTreeItem: string | null;
  /** Sketch currently being edited (its elements back the sketch-entity menu). */
  activeSketchId: string | null;
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
 * Postponed items are shown **disabled** rather than hidden, so the menu shape
 * is stable and the gaps are discoverable:
 *  - Face → Edit Feature / Edit Sketch need face→feature attribution.
 *  - Edge → Select Loop needs edge/face adjacency topology from the worker.
 *  - Sketch entity → Select Midpoint needs a midpoint-reference primitive.
 * See ROADMAP.md "§6b Remaining".
 */
export function ViewportContextMenu({
  project,
  selectedTreeItem,
  activeSketchId,
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

  // Face suppress/delete act on the selected feature-tree feature if there is
  // one, else the tip (last-built) feature — an interim rule until per-face
  // feature attribution lands (then these will target the clicked face's owner).
  const orderedFeatures = [...project.features].sort(compareBuildOrder);
  const tipFeature = orderedFeatures[orderedFeatures.length - 1];
  const selectedFeature = project.features.find((f) => f.id === selectedTreeItem);
  const targetFeature = selectedFeature ?? tipFeature;

  const activeSketch = activeSketchId ? project.sketches.find((s) => s.id === activeSketchId) : undefined;

  const close = () => closeContextMenu();

  const renderItems = () => {
    switch (target.kind) {
      case 'face':
        return (
          <>
            <Menu.Item disabled>Edit Feature</Menu.Item>
            <Menu.Item disabled>Edit Sketch</Menu.Item>
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
            <Menu.Item disabled>Select Loop</Menu.Item>
            <Menu.Divider />
            <Menu.Item onClick={() => { clearSelection(); close(); }}>Clear Selection</Menu.Item>
          </>
        );

      case 'sketch-entity': {
        const elements = activeSketch?.elements ?? [];
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
            <Menu.Item disabled>Select Midpoint</Menu.Item>
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
