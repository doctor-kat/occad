import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import { SelectionDisplay } from './SelectionDisplay';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import type { CADProject } from '@/cad/types';

/**
 * SelectionDisplay is a DOM/Mantine readout (not an R3F component), so it's
 * tested with @testing-library/react rather than the test renderer. It maps the
 * current selection to a label with a fixed precedence: a selected tree item
 * (plane → sketch → feature) wins over a picked face → edge → vertex; sub-shape
 * indices are shown 1-based.
 */

const project = {
  id: 'p',
  name: 'P',
  version: 1,
  referenceGeometry: [{ id: 'front-plane', name: 'Front Plane' }],
  sketches: [{ id: 's1', name: 'Sketch 1' }],
  features: [{ id: 'f1', name: 'Extrude 1' }],
  createdAt: 0,
  updatedAt: 0,
} as unknown as CADProject;

beforeEach(() => {
  useViewportStore.setState({ selectedFaceId: null, selectedEdgeIndex: null, selectedVertexIndex: null });
});

describe('SelectionDisplay', () => {
  it('shows "Nothing selected" with no selection', () => {
    renderWithProviders(<SelectionDisplay />);
    expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
  });

  it('shows the name of a selected plane, sketch or feature tree item', () => {
    const { unmount: u1 } = renderWithProviders(
      <SelectionDisplay selectedTreeItem="front-plane" project={project} />
    );
    expect(screen.getByText(/Front Plane/)).toBeInTheDocument();
    u1();

    const { unmount: u2 } = renderWithProviders(
      <SelectionDisplay selectedTreeItem="s1" project={project} />
    );
    expect(screen.getByText(/Sketch 1/)).toBeInTheDocument();
    u2();

    renderWithProviders(<SelectionDisplay selectedTreeItem="f1" project={project} />);
    expect(screen.getByText(/Extrude 1/)).toBeInTheDocument();
  });

  it('falls back to "Nothing selected" for an unknown tree item', () => {
    renderWithProviders(<SelectionDisplay selectedTreeItem="missing" project={project} />);
    expect(screen.getByText(/Nothing selected/)).toBeInTheDocument();
  });

  it('shows the picked face / edge / vertex 1-based', () => {
    useViewportStore.setState({ selectedFaceId: 0 });
    const { unmount: u1 } = renderWithProviders(<SelectionDisplay />);
    expect(screen.getByText(/Face 1/)).toBeInTheDocument();
    u1();

    useViewportStore.setState({ selectedFaceId: null, selectedEdgeIndex: 2 });
    const { unmount: u2 } = renderWithProviders(<SelectionDisplay />);
    expect(screen.getByText(/Edge 3/)).toBeInTheDocument();
    u2();

    useViewportStore.setState({ selectedEdgeIndex: null, selectedVertexIndex: 4 });
    renderWithProviders(<SelectionDisplay />);
    expect(screen.getByText(/Vertex 5/)).toBeInTheDocument();
  });

  it('prefers a tree item over a picked sub-shape', () => {
    useViewportStore.setState({ selectedFaceId: 7 });
    renderWithProviders(<SelectionDisplay selectedTreeItem="front-plane" project={project} />);
    expect(screen.getByText(/Front Plane/)).toBeInTheDocument();
    expect(screen.queryByText(/Face 8/)).not.toBeInTheDocument();
  });

  it('prefers a face over an edge/vertex when several are set', () => {
    useViewportStore.setState({ selectedFaceId: 0, selectedEdgeIndex: 1, selectedVertexIndex: 2 });
    renderWithProviders(<SelectionDisplay />);
    expect(screen.getByText(/Face 1/)).toBeInTheDocument();
    expect(screen.queryByText(/Edge 2/)).not.toBeInTheDocument();
  });
});
