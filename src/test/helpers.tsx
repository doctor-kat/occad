import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { mantineTheme } from "@/frontend/shared/theme/mantine";
import { vi } from "vitest";

function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={mantineTheme} forceColorScheme="dark">
      <Notifications />
      <ModalsProvider>{children}</ModalsProvider>
    </MantineProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

/** Mock of the occWorkerClient module's imperative surface, for tests that
 * mock "@/worker/bridge/occWorkerClient" wholesale (worker-output state now
 * lives in useOccStore instead — seed that separately via useOccStore.setState). */
export function createMockOccWorkerClient() {
  return {
    buildSketch: vi.fn(),
    solveSketch: vi.fn(),
    extrudeSketch: vi.fn(),
    revolveSketch: vi.fn(),
    rebuild: vi.fn(),
    deleteShape: vi.fn(),
    getFaceGeometry: vi.fn(),
    resolveSelector: vi.fn(),
    exportShapeRaw: vi.fn(),
    measureShapeRaw: vi.fn(),
    measureBetweenRaw: vi.fn(),
    getEdgeLoopRaw: vi.fn(),
    clearMesh: vi.fn(),
    retry: vi.fn(),
    currentFeatureShapeId: null as string | null,
    resolveSelectorAsync: vi.fn(),
    exportShape: vi.fn(),
    measureShape: vi.fn(),
    measureBetween: vi.fn(),
    getEdgeLoop: vi.fn(),
  };
}
