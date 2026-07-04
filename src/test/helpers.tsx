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

export function createMockUseOpenCascade() {
  return {
    status: "ready" as const,
    progress: "",
    error: null,
    mesh: null,
    currentShapeId: null,
    currentFeatureShapeId: null,
    sketchEdges: null,
    buildSketch: vi.fn(),
    extrudeSketch: vi.fn(),
    revolveSketch: vi.fn(),
    rebuild: vi.fn(),
    deleteShape: vi.fn(),
    getFaceGeometry: vi.fn(),
    resolveSelector: vi.fn(),
    clearMesh: vi.fn(),
  };
}
