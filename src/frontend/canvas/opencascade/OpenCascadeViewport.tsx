import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Box, Stack, Button, Text, Group, useMantineTheme, Center } from "@mantine/core";
import { X, Check, Dot, Minus, NavigationArrow, Circle } from "@phosphor-icons/react";
import type { CADProject, MeshData, SketchEdgeData, Sketch, SketchOperation } from "@/cad/types";
import type { OCCStatus } from "@/worker/bridge/useOpenCascade";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";
import { Scene } from "./Scene";
import { SelectionDisplay } from "./SelectionDisplay";
import { LoadingOverlay } from "./LoadingOverlay";
import { ErrorOverlay } from "./ErrorOverlay";

export interface OpenCascadeViewportProps {
  /** CAD project to render (if provided, enables parametric mode) */
  project?: CADProject;
  /** Currently selected tree item ID */
  selectedTreeItem?: string | null;
  /** OpenCascade worker status */
  occStatus: OCCStatus;
  /** OpenCascade progress message */
  occProgress: string;
  /** OpenCascade error message */
  occError: string | null;
  /** Current mesh data from OpenCascade */
  occMesh: MeshData | null;
  /** Per-sketch edge data for wireframe rendering */
  occSketchEdges?: Record<string, SketchEdgeData> | null;
  /** Retry callback for OpenCascade errors */
  occRetry: () => void;
  /** Active sketch being edited (if in sketch mode) */
  activeSketch?: any | null;
  /** Active sketch operation */
  activeOperation?: any | null;
  /** Callback when a plane is clicked */
  onPlaneClick?: (planeId: string) => void;
  /** Callback when a face is clicked */
  onFaceClick?: (faceId: number) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (edgeIndex: number) => void;
  /** Callback when a vertex is clicked */
  onVertexClick?: (vertexIndex: number) => void;
  /** Callback when background is clicked (clear selection) */
  onBackgroundClick?: () => void;
  /** Callback when sketch is updated */
  onUpdateSketch?: (sketchId: string, elements: any[]) => void;
  /** Callback when sketch editing is finished */
  onFinishSketch?: () => void;
  /** Callback when sketch editing is cancelled */
  onCancelSketch?: () => void;
}

export function OpenCascadeViewport({
  project,
  selectedTreeItem,
  occStatus,
  occProgress,
  occError,
  occMesh,
  occSketchEdges,
  occRetry,
  activeSketch,
  activeOperation,
  onPlaneClick,
  onFaceClick,
  onEdgeClick,
  onVertexClick,
  onBackgroundClick,
  onUpdateSketch,
  onFinishSketch,
  onCancelSketch
}: OpenCascadeViewportProps) {
  // Get viewport interaction state from store
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);
  // Sketch constraints state
  type ConstraintType = 'none' | 'point' | 'edge' | 'midpoint' | 'center';
  const [activeConstraint, setActiveConstraint] = useState<ConstraintType>('none');

  const isLoading = occStatus === "loading" || occStatus === "building";

  // Show empty state if no mesh and not loading/errored
  const showEmpty = !occMesh && !isLoading && !occError;

  const theme = useMantineTheme();

  return (
    <Box
      pos="relative"
      h="100%"
      w="100%"
      style={{
        overflow: 'hidden',
        backgroundColor: '#0a0a0f',
      }}
    >
      {/* Three.js Canvas */}
      <Canvas
        camera={{ position: [100, 80, 100], fov: 45, near: 0.1, far: 10000 }}
        gl={{ antialias: true, alpha: false }}
        style={{ background: "transparent", width: '100%', height: '100%' }}
      >
        <Suspense fallback={null}>
          {/* Always render the scene with planes, optionally with mesh */}
          <Scene
            mesh={occMesh}
            project={project}
            sketchEdges={occSketchEdges}
            selectedPlaneId={selectedTreeItem || null}
            selectedFaceId={selectedFaceId}
            selectedEdgeIndex={selectedEdgeIndex}
            selectedVertexIndex={selectedVertexIndex}
            activeSketch={activeSketch as Sketch | undefined}
            activeOperation={activeOperation as SketchOperation | undefined}
            activeConstraint={activeConstraint}
            onPlaneClick={onPlaneClick}
            onFaceClick={onFaceClick}
            onEdgeClick={onEdgeClick}
            onVertexClick={onVertexClick}
            onBackgroundClick={onBackgroundClick}
            onUpdateSketch={onUpdateSketch}
          />
        </Suspense>
      </Canvas>

      {/* Sketch Controls Overlay (when in sketch mode) */}
      {activeSketch && (
        <Stack
          gap="sm"
          pos="absolute"
          style={{
            top: 16,
            right: 16,
            zIndex: 10,
          }}
        >
          <Box
            style={{
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.other.colors.border}`,
              backgroundColor: `${theme.other.colors.card}cc`,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              backdropFilter: 'blur(12px)',
              boxShadow: theme.shadows.lg,
            }}
          >
            <Text size="xs" fw={500} c={theme.other.colors.mutedForeground} mb="xs">
              Sketch Mode - Editing on {typeof activeSketch.plane === 'string' ? activeSketch.plane : 'Custom'} Plane
            </Text>
            <Group gap="sm">
              <Button
                size="xs"
                variant="outline"
                onClick={onCancelSketch}
                leftSection={<X size={14} weight="regular" />}
              >
                Cancel
              </Button>
              <Button
                size="xs"
                onClick={onFinishSketch}
                leftSection={<Check size={14} weight="regular" />}
              >
                Finish Sketch
              </Button>
            </Group>
          </Box>

          {/* Element count */}
          <Box
            style={{
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.other.colors.border}`,
              backgroundColor: `${theme.other.colors.card}99`,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 6,
              paddingBottom: 6,
              backdropFilter: 'blur(12px)',
              boxShadow: theme.shadows.lg,
            }}
          >
            <Text size="xs" fw={500} c={theme.other.colors.mutedForeground}>
              Elements: {activeSketch.elements.length}
            </Text>
          </Box>
        </Stack>
      )}

      {/* Constraints Menu (when in sketch mode) */}
      {activeSketch && (
        <Box
          pos="absolute"
          style={{
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            borderRadius: theme.radius.lg,
            border: `1px solid ${theme.other.colors.border}`,
            backgroundColor: `${theme.other.colors.card}cc`,
            backdropFilter: 'blur(12px)',
            boxShadow: theme.shadows.lg,
          }}
        >
          <Group gap={0} style={{ padding: 4 }}>
            <Text size="xs" fw={600} c={theme.other.colors.mutedForeground} px="sm" py="xs">
              Constraints:
            </Text>

            {([
              { key: 'none', label: 'None', icon: null },
              { key: 'point', label: 'Point', icon: <Dot size={16} weight="regular" /> },
              { key: 'edge', label: 'Edge', icon: <Minus size={16} weight="regular" /> },
              { key: 'midpoint', label: 'Midpoint', icon: <NavigationArrow size={16} weight="regular" /> },
              { key: 'center', label: 'Center', icon: <Circle size={16} weight="regular" /> },
            ] as const).map(({ key, label, icon }) => {
              const isActive = activeConstraint === key;
              return (
                <Button
                  key={key}
                  size="xs"
                  variant={isActive ? 'filled' : 'subtle'}
                  onClick={() => setActiveConstraint(key)}
                  leftSection={icon}
                  px="sm"
                  style={{
                    borderRadius: theme.radius.md,
                  }}
                  styles={{
                    root: {
                      ...(isActive && { '--button-bg': theme.colors.blue[5] }),
                    },
                  }}
                >
                  {label}
                </Button>
              );
            })}
          </Group>
        </Box>
      )}

      {/* Selection Display */}
      <SelectionDisplay
        selectedTreeItem={selectedTreeItem}
        project={project}
      />

      {/* Overlays */}
      {isLoading && <LoadingOverlay message={occProgress} />}
      {occStatus === "error" && occError && <ErrorOverlay error={occError} onRetry={occRetry} />}

      {/* Empty state */}
      {showEmpty && (
        <Box pos="absolute" style={{ inset: 0, zIndex: 10 }}>
          <Center h="100%">
            <Stack align="center" gap={4}>
              <Text size="sm" fw={500} c="dimmed">
                No geometry to display
              </Text>
              <Text size="xs" c="dimmed">
                Create a sketch to get started
              </Text>
            </Stack>
          </Center>
        </Box>
      )}

      {/* Subtle gradient overlay */}
      <Box
        pos="absolute"
        style={{
          pointerEvents: 'none',
          inset: 0,
          background: 'linear-gradient(to bottom right, rgba(99, 102, 241, 0.02), transparent, rgba(168, 85, 247, 0.02))',
        }}
      />
    </Box>
  );
}
