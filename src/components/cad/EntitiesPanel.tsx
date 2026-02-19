import { Stack, Text, Box, ScrollArea, useMantineTheme, Group, ActionIcon, Badge } from '@mantine/core';
import { CaretRight, CaretDown, Polygon, LineSegment } from '@phosphor-icons/react';
import { useState } from 'react';
import type { MeshData } from '@/hooks/useOpenCascade';
import { useViewportStore } from '@/stores/viewportStore';

interface EntitiesPanelProps {
  mesh: MeshData | null;
  onFaceClick?: (faceId: number) => void;
  onEdgeClick?: (edgeIndex: number) => void;
}

export function EntitiesPanel({
  mesh,
  onFaceClick,
  onEdgeClick,
}: EntitiesPanelProps) {
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const hoveredFaceId = useViewportStore((state) => state.hoveredFaceId);
  const hoveredEdgeIndex = useViewportStore((state) => state.hoveredEdgeIndex);
  const setHoveredFaceId = useViewportStore((state) => state.setHoveredFaceId);
  const setHoveredEdgeIndex = useViewportStore((state) => state.setHoveredEdgeIndex);
  const theme = useMantineTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [facesExpanded, setFacesExpanded] = useState(true);
  const [edgesExpanded, setEdgesExpanded] = useState(true);

  if (!mesh) return null;

  // Derive face count from faceMapping (max value + 1)
  const faceCount = mesh.faceMapping ? Math.max(...mesh.faceMapping) + 1 : 0;

  // Use the deduplicated edge count from the worker
  const edgeCount = mesh.edgeCount;

  const maxPanelHeight = 'calc(100vh - 200px)';
  const headerHeight = 44; // Approximate header height (py=10 * 2 + text + border)

  return (
    <Box
      pos="absolute"
      style={{
        top: 8,
        right: 16,
        width: 200,
        maxHeight: maxPanelHeight,
        zIndex: 10,
        backgroundColor: theme.other.colors.background,
        border: `1px solid ${theme.other.colors.sidebarBorder}`,
        borderRadius: theme.radius.md,
        backdropFilter: 'blur(12px)',
        boxShadow: theme.shadows.lg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Panel Header */}
      <Group
        gap={8}
        wrap="nowrap"
        px={12}
        py={10}
        style={{
          cursor: 'pointer',
          borderBottom: isCollapsed ? 'none' : `1px solid ${theme.other.colors.sidebarBorder}`,
          flexShrink: 0,
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <ActionIcon
          variant="subtle"
          size="xs"
          style={{
            width: 20,
            height: 20,
            borderRadius: theme.radius.xs,
          }}
        >
          {isCollapsed ? (
            <CaretRight size={14} weight="regular" color={theme.other.colors.mutedForeground} />
          ) : (
            <CaretDown size={14} weight="regular" color={theme.other.colors.mutedForeground} />
          )}
        </ActionIcon>
        <Text
          size="xs"
          fw={700}
          tt="uppercase"
          style={{
            letterSpacing: '0.1em',
            color: theme.other.colors.mutedForeground,
            flex: 1,
          }}
        >
          Entities
        </Text>
      </Group>

      {/* Panel Content */}
      {!isCollapsed && (
        <ScrollArea
          h={`calc(${maxPanelHeight} - ${headerHeight}px)`}
          style={{ padding: 8 }}
        >
          <Stack gap={2}>
            {/* Faces Section */}
            {faceCount > 0 && (
              <>
                {/* Faces Header */}
                <Group
                  gap={6}
                  wrap="nowrap"
                  style={{
                    height: 32,
                    paddingLeft: 8,
                    paddingRight: 8,
                    cursor: 'pointer',
                    borderRadius: theme.radius.sm,
                  }}
                  onClick={() => setFacesExpanded(!facesExpanded)}
                >
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: theme.radius.xs,
                      flexShrink: 0,
                    }}
                  >
                    {facesExpanded ? (
                      <CaretDown size={14} weight="regular" color={theme.other.colors.mutedForeground} />
                    ) : (
                      <CaretRight size={14} weight="regular" color={theme.other.colors.mutedForeground} />
                    )}
                  </ActionIcon>
                  <Text
                    size="xs"
                    fw={500}
                    style={{
                      color: theme.other.colors.foreground,
                      flex: 1,
                    }}
                  >
                    Faces
                  </Text>
                  <Badge
                    size="xs"
                    variant="light"
                    color="cyan"
                    style={{ height: 18, minWidth: 24 }}
                  >
                    {faceCount}
                  </Badge>
                </Group>

                {/* Face Items */}
                {facesExpanded && Array.from({ length: faceCount }).map((_, i) => {
                  const isSelected = selectedFaceId === i;
                  const isHovered = hoveredFaceId === i;

                  return (
                    <Group
                      key={`face-${i}`}
                      gap={6}
                      wrap="nowrap"
                      data-selected={isSelected}
                      style={{
                        height: 32,
                        paddingLeft: 16 + 8, // depth=1 equivalent
                        paddingRight: 4,
                        backgroundColor: isSelected
                          ? `${theme.colors.blue[5]}15`
                          : isHovered
                            ? `${theme.colors.orange[5]}15`
                            : 'transparent',
                        border: isSelected
                          ? `1px solid ${theme.colors.blue[5]}33`
                          : isHovered
                            ? `1px solid ${theme.colors.orange[5]}33`
                            : '1px solid transparent',
                        borderRadius: theme.radius.sm,
                        cursor: 'pointer',
                        transition: 'all 150ms',
                      }}
                      onClick={() => onFaceClick?.(i)}
                      onMouseEnter={() => setHoveredFaceId(i)}
                      onMouseLeave={() => setHoveredFaceId(null)}
                    >
                      <Polygon size={16} weight="regular" color={theme.colors.cyan[5]} />
                      <Text
                        size="xs"
                        fw={500}
                        style={{
                          color: theme.other.colors.foreground,
                          flex: 1,
                        }}
                      >
                        Face {i + 1}
                      </Text>
                    </Group>
                  );
                })}
              </>
            )}

            {/* Edges Section */}
            {edgeCount > 0 && (
              <>
                {/* Edges Header */}
                <Group
                  gap={6}
                  wrap="nowrap"
                  style={{
                    height: 32,
                    paddingLeft: 8,
                    paddingRight: 8,
                    cursor: 'pointer',
                    borderRadius: theme.radius.sm,
                    marginTop: faceCount > 0 ? 4 : 0,
                  }}
                  onClick={() => setEdgesExpanded(!edgesExpanded)}
                >
                  <ActionIcon
                    variant="subtle"
                    size="xs"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: theme.radius.xs,
                      flexShrink: 0,
                    }}
                  >
                    {edgesExpanded ? (
                      <CaretDown size={14} weight="regular" color={theme.other.colors.mutedForeground} />
                    ) : (
                      <CaretRight size={14} weight="regular" color={theme.other.colors.mutedForeground} />
                    )}
                  </ActionIcon>
                  <Text
                    size="xs"
                    fw={500}
                    style={{
                      color: theme.other.colors.foreground,
                      flex: 1,
                    }}
                  >
                    Edges
                  </Text>
                  <Badge
                    size="xs"
                    variant="light"
                    color="violet"
                    style={{ height: 18, minWidth: 24 }}
                  >
                    {edgeCount}
                  </Badge>
                </Group>

                {/* Edge Items */}
                {edgesExpanded && Array.from({ length: edgeCount }).map((_, i) => {
                  const isSelected = selectedEdgeIndex === i;
                  const isHovered = hoveredEdgeIndex === i;

                  return (
                    <Group
                      key={`edge-${i}`}
                      gap={6}
                      wrap="nowrap"
                      style={{
                        height: 32,
                        paddingLeft: 16 + 8, // depth=1 equivalent
                        paddingRight: 4,
                        backgroundColor: isSelected
                          ? `${theme.colors.blue[5]}15`
                          : isHovered
                            ? `${theme.colors.orange[5]}15`
                            : 'transparent',
                        border: isSelected
                          ? `1px solid ${theme.colors.blue[5]}33`
                          : isHovered
                            ? `1px solid ${theme.colors.orange[5]}33`
                            : '1px solid transparent',
                        borderRadius: theme.radius.sm,
                        cursor: 'pointer',
                        transition: 'all 150ms',
                      }}
                      onClick={() => onEdgeClick?.(i)}
                      onMouseEnter={() => setHoveredEdgeIndex(i)}
                      onMouseLeave={() => setHoveredEdgeIndex(null)}
                    >
                      <LineSegment size={16} weight="regular" color={theme.colors.purple[5]} />
                      <Text
                        size="xs"
                        fw={500}
                        style={{
                          color: theme.other.colors.foreground,
                          flex: 1,
                        }}
                      >
                        Edge {i + 1}
                      </Text>
                    </Group>
                  );
                })}
              </>
            )}
          </Stack>
        </ScrollArea>
      )}
    </Box>
  );
}
