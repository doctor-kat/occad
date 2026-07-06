import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import { ViewportContextMenu } from './ViewportContextMenu';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import type { CADProject } from '@/cad/types';

function makeProject(): CADProject {
  const now = Date.now();
  return {
    id: 'p', name: 'P', version: 1, referenceGeometry: [],
    sketches: [
      { id: 'sk1', name: 'Sketch1', plane: { type: 'xy' }, elements: [], primitives: [], constraints: [], isClosed: true, createdAt: now, updatedAt: now },
    ],
    features: [
      { id: 'ft1', name: 'Boss1', type: 'extrude-boss', sketchId: 'sk1', parentIds: [], isSuppressed: false, isVisible: true, createdAt: now, updatedAt: now },
    ],
    createdAt: now, updatedAt: now,
  } as unknown as CADProject;
}

function baseProps() {
  return {
    project: makeProject(),
    selectedTreeItem: null,
    activeSketchId: null,
    onEditItem: vi.fn(),
    onSelectLoop: vi.fn(),
    onToggleSuppressFeature: vi.fn(),
    onDeleteFeature: vi.fn(),
    onUpdateSketchElements: vi.fn(),
  };
}

describe('ViewportContextMenu — face attribution', () => {
  beforeEach(() => {
    // Open the menu on face id 0.
    useViewportStore.getState().openContextMenu({ x: 10, y: 10, target: { kind: 'face', faceId: 0 } });
  });

  it('Edit Feature targets the owning feature when the face is attributed', () => {
    const props = baseProps();
    // Face 0 is owned by ft1 (extrude), whose sketch is sk1.
    renderWithProviders(<ViewportContextMenu {...props} faceOwners={['ft1']} />);
    fireEvent.click(screen.getByText(/Edit Feature Boss1/));
    expect(props.onEditItem).toHaveBeenCalledWith('ft1');
  });

  it('Edit Sketch targets the owning feature\'s sketch', () => {
    const props = baseProps();
    renderWithProviders(<ViewportContextMenu {...props} faceOwners={['ft1']} />);
    fireEvent.click(screen.getByText(/Edit Sketch Sketch1/));
    expect(props.onEditItem).toHaveBeenCalledWith('sk1');
  });

  it('Suppress targets the owning feature', () => {
    const props = baseProps();
    renderWithProviders(<ViewportContextMenu {...props} faceOwners={['ft1']} />);
    fireEvent.click(screen.getByText(/Suppress Boss1/));
    expect(props.onToggleSuppressFeature).toHaveBeenCalledWith('ft1');
  });

  it('Select Loop requests the picked edge on the edge menu', () => {
    useViewportStore.getState().openContextMenu({ x: 10, y: 10, target: { kind: 'edge', edgeIndex: 3 } });
    const props = baseProps();
    renderWithProviders(<ViewportContextMenu {...props} />);
    fireEvent.click(screen.getByText('Select Loop'));
    expect(props.onSelectLoop).toHaveBeenCalledWith(3);
  });

  it('disables Edit Feature/Sketch when the face is owner-less', () => {
    const props = baseProps();
    renderWithProviders(<ViewportContextMenu {...props} faceOwners={[null]} />);
    // Falls back to tip feature for suppress/delete, but edit stays disabled.
    expect(screen.getByText('Edit Feature').closest('button')).toBeDisabled();
    expect(screen.getByText('Edit Sketch').closest('button')).toBeDisabled();
  });
});
