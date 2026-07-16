import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers';
import { LoadingOverlay } from '@/frontend/viewport/opencascade/overlays/LoadingOverlay';

describe('LoadingOverlay', () => {
  it('shows the provided message', () => {
    renderWithProviders(<LoadingOverlay message="Initializing kernel" />);
    expect(screen.getByText('Initializing kernel')).toBeInTheDocument();
  });

  it('falls back to "Loading…" when the message is empty', () => {
    renderWithProviders(<LoadingOverlay message="" />);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });
});
