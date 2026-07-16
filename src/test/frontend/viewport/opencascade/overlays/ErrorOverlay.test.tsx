import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/helpers';
import { ErrorOverlay } from '@/frontend/viewport/opencascade/overlays/ErrorOverlay';

describe('ErrorOverlay', () => {
  it('shows the error message and a retry button', () => {
    renderWithProviders(<ErrorOverlay error="WASM failed to load" onRetry={() => {}} />);
    expect(screen.getByText('OpenCascade Error')).toBeInTheDocument();
    expect(screen.getByText('WASM failed to load')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls onRetry when the retry button is clicked', async () => {
    const onRetry = vi.fn();
    renderWithProviders(<ErrorOverlay error="boom" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
