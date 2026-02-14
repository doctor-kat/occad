import { Paper, Stack, Text, Box, ScrollArea, Tabs, useMantineTheme } from '@mantine/core';
import type { MeshData } from '@/hooks/useOpenCascade';

interface EntitiesPanelProps {
  mesh: MeshData | null;
  selectedFaceId?: number | null;
  selectedEdgeIndex?: number | null;
  hoveredFaceId?: number | null;
  hoveredEdgeIndex?: number | null;
  onFaceClick?: (faceId: number) => void;
  onEdgeClick?: (edgeIndex: number) => void;
  onFaceHover?: (faceId: number | null) => void;
  onEdgeHover?: (edgeIndex: number | null) => void;
}

export function EntitiesPanel({
  mesh,
  selectedFaceId,
  selectedEdgeIndex,
  hoveredFaceId,
  hoveredEdgeIndex,
  onFaceClick,
  onEdgeClick,
  onFaceHover,
  onEdgeHover,
}: EntitiesPanelProps) {
  const theme = useMantineTheme();

  if (!mesh) return null;

  // Derive face count from faceMapping (max value + 1)
  const faceCount = mesh.faceMapping ? Math.max(...mesh.faceMapping) + 1 : 0;

  // Derive edge count from edgeVertices (each edge has 6 values: 2 vertices × 3 coordinates)
  const edgeCount = Math.floor(mesh.edgeVertices.length / 6);

  return (
    <Paper
      pos="absolute"
      radius="md"
      p="sm"
      shadow="lg"
      style={{
        top: 8,
        right: 16,
        width: 200,
        maxHeight: 'calc(100vh - 200px)',
        zIndex: 10,
        backgroundColor: 'rgba(24, 24, 27, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Text size="sm" fw={600} c="dimmed" mb="xs">
        Entities
      </Text>

      <Tabs defaultValue="faces" variant="pills" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Tabs.List grow>
          <Tabs.Tab value="faces" style={{ fontSize: 12 }}>
            Faces ({faceCount})
          </Tabs.Tab>
          <Tabs.Tab value="edges" style={{ fontSize: 12 }}>
            Edges ({edgeCount})
          </Tabs.Tab>
        </Tabs.List>

        <Box style={{ flex: 1, overflow: 'hidden', marginTop: 8 }}>
          <Tabs.Panel value="faces" style={{ height: '100%' }}>
            <ScrollArea style={{ height: '100%' }}>
              <Stack gap={2}>
                {Array.from({ length: faceCount }).map((_, i) => {
                  const isSelected = selectedFaceId === i;
                  const isHovered = hoveredFaceId === i;

                  return (
                    <Box
                      key={i}
                      px={8}
                      py={4}
                      style={{
                        cursor: 'pointer',
                        borderRadius: theme.radius.sm,
                        backgroundColor: isSelected
                          ? 'rgba(59, 130, 246, 0.3)' // Blue for selected
                          : isHovered
                            ? 'rgba(249, 115, 22, 0.25)' // Orange for hovered
                            : 'transparent',
                        border: isSelected
                          ? '1px solid rgba(59, 130, 246, 0.5)'
                          : isHovered
                            ? '1px solid rgba(249, 115, 22, 0.4)'
                            : '1px solid transparent',
                        transition: 'all 150ms ease',
                      }}
                      onClick={() => onFaceClick?.(i)}
                      onMouseEnter={() => onFaceHover?.(i)}
                      onMouseLeave={() => onFaceHover?.(null)}
                    >
                      <Text
                        size="xs"
                        c={isSelected ? '#60a5fa' : isHovered ? '#fb923c' : 'dimmed'}
                        fw={isSelected ? 500 : 400}
                      >
                        Face {i + 1}
                      </Text>
                    </Box>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="edges" style={{ height: '100%' }}>
            <ScrollArea style={{ height: '100%' }}>
              <Stack gap={2}>
                {Array.from({ length: edgeCount }).map((_, i) => {
                  const isSelected = selectedEdgeIndex === i;
                  const isHovered = hoveredEdgeIndex === i;

                  return (
                    <Box
                      key={i}
                      px={8}
                      py={4}
                      style={{
                        cursor: 'pointer',
                        borderRadius: theme.radius.sm,
                        backgroundColor: isSelected
                          ? 'rgba(59, 130, 246, 0.3)' // Blue for selected
                          : isHovered
                            ? 'rgba(249, 115, 22, 0.25)' // Orange for hovered
                            : 'transparent',
                        border: isSelected
                          ? '1px solid rgba(59, 130, 246, 0.5)'
                          : isHovered
                            ? '1px solid rgba(249, 115, 22, 0.4)'
                            : '1px solid transparent',
                        transition: 'all 150ms ease',
                      }}
                      onClick={() => onEdgeClick?.(i)}
                      onMouseEnter={() => onEdgeHover?.(i)}
                      onMouseLeave={() => onEdgeHover?.(null)}
                    >
                      <Text
                        size="xs"
                        c={isSelected ? '#60a5fa' : isHovered ? '#fb923c' : 'dimmed'}
                        fw={isSelected ? 500 : 400}
                      >
                        Edge {i + 1}
                      </Text>
                    </Box>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Paper>
  );
}
