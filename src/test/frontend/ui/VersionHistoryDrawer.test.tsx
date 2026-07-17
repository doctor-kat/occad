import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { VersionHistoryDrawer } from '@/frontend/ui/history/VersionHistoryDrawer';
import { useProjectStore } from '@/frontend/shared/projectStore';
import { createNewProject } from '@/cad/types';

function addFeature(id: string, name: string) {
  useProjectStore.getState().dispatch({
    type: 'ADD_FEATURE',
    feature: {
      id,
      name,
      type: 'extrude-boss',
      parameters: { depth: 10 },
      parentIds: [],
      isSuppressed: false,
      isVisible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as any,
  });
}

describe('VersionHistoryDrawer', () => {
  beforeEach(() => {
    useProjectStore.getState().dispatch({ type: 'REPLACE', project: createNewProject() });
    useProjectStore.getState().endSketchSession();
  });

  it('lists versions newest-first and marks the current one', async () => {
    addFeature('f1', 'Extrude 1');
    addFeature('f2', 'Extrude 2');

    renderWithProviders(<VersionHistoryDrawer opened onClose={vi.fn()} />);

    const labels = await screen.findAllByText(/Added Extrude/);
    // Newest first.
    expect(labels.map((n) => n.textContent)).toEqual(['Added Extrude 2', 'Added Extrude 1']);
    expect(screen.getByText('current')).toBeInTheDocument();
  });

  it('restores the clicked version and closes the drawer', async () => {
    const onClose = vi.fn();
    addFeature('f1', 'Extrude 1');
    const s = () => useProjectStore.getState();
    const lenBefore = s().timeline.entries.length;
    const rootLabel = s().timeline.entries[0].label;

    renderWithProviders(<VersionHistoryDrawer opened onClose={onClose} />);
    await userEvent.click(await screen.findByText(rootLabel));

    // Branch-append: nothing destroyed, a "Restored to" entry added, model rewound.
    await waitFor(() => expect(s().timeline.entries).toHaveLength(lenBefore + 1));
    expect(s().timeline.entries.at(-1)!.label).toBe(`Restored to ${rootLabel}`);
    expect(s().project.features).toHaveLength(0);
    expect(onClose).toHaveBeenCalled();
  });
});
