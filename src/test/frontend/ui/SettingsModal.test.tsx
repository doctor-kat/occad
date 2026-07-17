import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { SettingsModal } from '@/frontend/ui/settings/SettingsModal';
import { useProjectStore } from '@/frontend/shared/projectStore';
import { createNewProject } from '@/cad/types';

describe('SettingsModal', () => {
  beforeEach(() => {
    useProjectStore.getState().dispatch({ type: 'REPLACE', project: createNewProject() });
    // navigator.storage is absent in jsdom — stub the estimate the meter reads.
    vi.stubGlobal('navigator', {
      ...navigator,
      storage: { estimate: async () => ({ usage: 2_000_000, quota: 100_000_000 }) },
    });
  });

  it('renders the storage meter and per-bucket breakdown when opened', async () => {
    renderWithProviders(<SettingsModal opened onClose={vi.fn()} />);

    expect(await screen.findByText('Browser storage')).toBeInTheDocument();
    // formatBytes is binary (KiB-based), so 2e6 / 1e8 render as 1.9 MB / 95 MB.
    await waitFor(() => expect(screen.getByText(/1\.9 MB of 95 MB used \(2\.0%\)/)).toBeInTheDocument());
    expect(screen.getByText('Project (localStorage)')).toBeInTheDocument();
    expect(screen.getByText(/Version history \(1 versions?\)/)).toBeInTheDocument();
  });

  it('requires confirmation before clearing version history', async () => {
    const user = userEvent.setup();
    const s = () => useProjectStore.getState();
    s().dispatch({
      type: 'ADD_FEATURE',
      feature: {
        id: 'f1',
        name: 'Extrude 1',
        type: 'extrude-boss',
        parameters: { depth: 10 },
        parentIds: [],
        isSuppressed: false,
        isVisible: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any,
    });
    expect(s().timeline.entries.length).toBeGreaterThan(1);

    renderWithProviders(<SettingsModal opened onClose={vi.fn()} />);

    // First click only arms the confirmation — history is untouched.
    await user.click(await screen.findByText('Clear version history'));
    expect(s().timeline.entries.length).toBeGreaterThan(1);

    await user.click(screen.getByText('Delete history'));
    await waitFor(() => expect(s().timeline.entries).toHaveLength(1));
    // Clearing history leaves the model itself alone.
    expect(s().project.features).toHaveLength(1);
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<SettingsModal opened={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Browser storage')).not.toBeInTheDocument();
  });
});
