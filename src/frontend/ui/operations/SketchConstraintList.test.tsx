import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { SketchConstraintList } from './SketchConstraintList';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import type { Sketch } from '@/cad/types';

const sketch = {
  id: 'sk1',
  name: 'Sketch 1',
  elements: [],
  primitives: [],
  constraints: [
    { id: 'c1', type: 'horizontal_l', l_id: 'L_l1' },
    { id: 'c2', type: 'vertical_l', l_id: 'L_l2' },
  ],
} as unknown as Sketch;

describe('SketchConstraintList', () => {
  beforeEach(() => {
    useViewportStore.setState({ selectedConstraintId: null });
  });

  it('renders one row per constraint with friendly labels', () => {
    renderWithProviders(<SketchConstraintList sketch={sketch} onRemove={vi.fn()} />);
    expect(screen.getByText('Horizontal')).toBeInTheDocument();
    expect(screen.getByText('Vertical')).toBeInTheDocument();
  });

  it('clicking a row selects (then deselects) the constraint in the store', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SketchConstraintList sketch={sketch} onRemove={vi.fn()} />);
    await user.click(screen.getByTestId('constraint-row-c1'));
    expect(useViewportStore.getState().selectedConstraintId).toBe('c1');
    await user.click(screen.getByTestId('constraint-row-c1'));
    expect(useViewportStore.getState().selectedConstraintId).toBeNull();
  });

  it('reflects the selected constraint as the highlighted row', () => {
    useViewportStore.setState({ selectedConstraintId: 'c2' });
    renderWithProviders(<SketchConstraintList sketch={sketch} onRemove={vi.fn()} />);
    expect(screen.getByTestId('constraint-row-c2')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('constraint-row-c1')).toHaveAttribute('data-selected', 'false');
  });

  it('delete removes the constraint without selecting the row', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderWithProviders(<SketchConstraintList sketch={sketch} onRemove={onRemove} />);
    await user.click(screen.getByTestId('constraint-delete-c1'));
    expect(onRemove).toHaveBeenCalledWith('c1');
    expect(useViewportStore.getState().selectedConstraintId).toBeNull();
  });
});
