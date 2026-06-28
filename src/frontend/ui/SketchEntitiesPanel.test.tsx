import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { SketchEntitiesPanel } from './SketchEntitiesPanel';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { SketchElementType } from '@/cad/types';
import type { Sketch } from '@/cad/types';

const sketch = {
  id: 'sk1',
  name: 'Sketch 1',
  elements: [
    { type: SketchElementType.LINE, id: 'l1', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    { type: SketchElementType.LINE, id: 'l2', start: { x: 0, y: 0 }, end: { x: 0, y: 10 }, construction: true },
    { type: SketchElementType.CIRCLE, id: 'c1', center: { x: 5, y: 5 }, radius: 3 },
  ],
  primitives: [],
  constraints: [],
} as unknown as Sketch;

describe('SketchEntitiesPanel', () => {
  beforeEach(() => {
    useViewportStore.setState({ selectedSketchElementIds: [], hoveredSketchElementId: null });
  });

  it('renders one labelled row per entity with a per-type index', () => {
    renderWithProviders(<SketchEntitiesPanel sketch={sketch} />);
    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
    expect(screen.getByText('Circle 1')).toBeInTheDocument();
  });

  it('flags construction geometry', () => {
    renderWithProviders(<SketchEntitiesPanel sketch={sketch} />);
    expect(screen.getByText('constr')).toBeInTheDocument();
  });

  it('shows an empty hint when the sketch has no entities', () => {
    renderWithProviders(<SketchEntitiesPanel sketch={{ ...sketch, elements: [] }} />);
    expect(screen.getByText(/No sketch entities yet/i)).toBeInTheDocument();
  });

  it('clicking a row toggles it in the selection set', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SketchEntitiesPanel sketch={sketch} />);
    await user.click(screen.getByTestId('sketch-entity-c1'));
    expect(useViewportStore.getState().selectedSketchElementIds).toContain('c1');
    await user.click(screen.getByTestId('sketch-entity-c1'));
    expect(useViewportStore.getState().selectedSketchElementIds).not.toContain('c1');
  });

  it('reflects the current selection set as selected rows', () => {
    useViewportStore.setState({ selectedSketchElementIds: ['l1'] });
    renderWithProviders(<SketchEntitiesPanel sketch={sketch} />);
    expect(screen.getByTestId('sketch-entity-l1')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('sketch-entity-c1')).toHaveAttribute('data-selected', 'false');
  });

  it('hovering a row sets the shared hovered entity id', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SketchEntitiesPanel sketch={sketch} />);
    await user.hover(screen.getByTestId('sketch-entity-l1'));
    expect(useViewportStore.getState().hoveredSketchElementId).toBe('l1');
    await user.unhover(screen.getByTestId('sketch-entity-l1'));
    expect(useViewportStore.getState().hoveredSketchElementId).toBeNull();
  });

  it('delete button removes the entity without toggling selection', async () => {
    const user = userEvent.setup();
    const onRemoveElement = vi.fn();
    renderWithProviders(<SketchEntitiesPanel sketch={sketch} onRemoveElement={onRemoveElement} />);
    await user.click(screen.getByTestId('sketch-entity-delete-l1'));
    expect(onRemoveElement).toHaveBeenCalledWith('l1');
    expect(useViewportStore.getState().selectedSketchElementIds).not.toContain('l1');
  });
});
