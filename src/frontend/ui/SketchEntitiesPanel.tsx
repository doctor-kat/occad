import { Stack, Text, Box, ScrollArea, useMantineTheme, Group, ActionIcon, Badge, Center } from '@mantine/core';
import { X } from '@phosphor-icons/react';
import {
  LineIcon,
  RectangleIcon,
  CircleIcon,
  PolygonIcon,
  ArcIcon,
  EllipseIcon,
  SplineIcon,
  PointIcon,
  type CadIconProps,
} from '@/frontend/shared/icons';
import type { ComponentType } from 'react';
import type { Sketch, SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';

interface SketchEntitiesPanelProps {
  sketch: Sketch;
  /** Delete an entity from the sketch (by element id). */
  onRemoveElement?: (elementId: string) => void;
}

/** Human label + icon for each sketch element type. */
const TYPE_META: Record<string, { label: string; Icon: ComponentType<CadIconProps> }> = {
  [SketchElementType.LINE]: { label: 'Line', Icon: LineIcon },
  [SketchElementType.RECTANGLE]: { label: 'Rectangle', Icon: RectangleIcon },
  [SketchElementType.CIRCLE]: { label: 'Circle', Icon: CircleIcon },
  [SketchElementType.POLYGON]: { label: 'Polygon', Icon: PolygonIcon },
  [SketchElementType.ARC]: { label: 'Arc', Icon: ArcIcon },
  [SketchElementType.ELLIPSE]: { label: 'Ellipse', Icon: EllipseIcon },
  [SketchElementType.BEZIER]: { label: 'Spline', Icon: SplineIcon },
  [SketchElementType.POINT]: { label: 'Point', Icon: PointIcon },
};

/**
 * Live list of the active sketch's entities, mirroring the selection set so it is
 * obvious what is selected (in tandem with the viewport box/crossing select).
 * Rows are two-way wired to the viewport: clicking toggles selection, hovering
 * highlights the entity in the SketchOverlay (and vice-versa).
 */
export function SketchEntitiesPanel({ sketch, onRemoveElement }: SketchEntitiesPanelProps) {
  const theme = useMantineTheme();
  const selectedIds = useViewportStore((s) => s.selectedSketchElementIds);
  const hoveredId = useViewportStore((s) => s.hoveredSketchElementId);
  const toggleSelection = useViewportStore((s) => s.toggleSketchElementSelection);
  const setHovered = useViewportStore((s) => s.setHoveredSketchElementId);

  const elements = sketch.elements || [];

  if (elements.length === 0) {
    return (
      <Center style={{ flex: 1, height: '100%' }} p="md">
        <Stack align="center" gap="xs">
          <PolygonIcon size={32} color={theme.other.colors.mutedForeground} />
          <Text size="xs" c="dimmed" ta="center">
            No sketch entities yet. Draw lines, circles, or rectangles to populate this list.
          </Text>
        </Stack>
      </Center>
    );
  }

  // Per-type running index so labels read "Line 1", "Line 2", "Circle 1", …
  const typeCounts: Record<string, number> = {};

  return (
    <Stack gap={0} style={{ flex: 1, height: '100%' }} data-testid="sketch-entities-panel">
      <ScrollArea style={{ flex: 1 }}>
        <Stack gap={2} p={8}>
          <Group
            gap={6}
            wrap="nowrap"
            style={{ height: 32, paddingLeft: 8, paddingRight: 8, borderRadius: theme.radius.sm }}
          >
            <Text size="xs" fw={500} style={{ color: theme.other.colors.foreground, flex: 1 }}>
              Sketch Entities
            </Text>
            <Badge size="xs" variant="light" color="cyan" style={{ height: 18, minWidth: 24 }}>
              {elements.length}
            </Badge>
          </Group>

          {elements.map((element: SketchElement) => {
            const meta = TYPE_META[element.type] ?? { label: element.type, Icon: PolygonIcon };
            typeCounts[element.type] = (typeCounts[element.type] || 0) + 1;
            const label = `${meta.label} ${typeCounts[element.type]}`;
            const isSelected = selectedIds.includes(element.id);
            const isHovered = hoveredId === element.id;
            const isConstruction =
              element.type === SketchElementType.LINE && Boolean(element.construction);
            const Icon = meta.Icon;

            return (
              <Group
                key={element.id}
                gap={6}
                wrap="nowrap"
                data-testid={`sketch-entity-${element.id}`}
                data-selected={isSelected}
                style={{
                  height: 32,
                  paddingLeft: 16,
                  paddingRight: 4,
                  backgroundColor: isSelected
                    ? `${theme.colors.blue[5]}1f`
                    : isHovered
                      ? `${theme.colors.orange[5]}15`
                      : 'transparent',
                  border: isSelected
                    ? `1px solid ${theme.colors.blue[5]}55`
                    : isHovered
                      ? `1px solid ${theme.colors.orange[5]}33`
                      : '1px solid transparent',
                  borderRadius: theme.radius.sm,
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
                onClick={() => toggleSelection(element.id)}
                onMouseEnter={() => setHovered(element.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <Icon
                  size={16}
                  color={isSelected ? theme.colors.blue[4] : theme.colors.cyan[5]}
                />
                <Text size="xs" fw={500} style={{ color: theme.other.colors.foreground, flex: 1 }}>
                  {label}
                </Text>
                {isConstruction && (
                  <Badge size="xs" variant="light" color="gray" style={{ height: 16 }}>
                    constr
                  </Badge>
                )}
                {onRemoveElement && (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    data-testid={`sketch-entity-delete-${element.id}`}
                    aria-label={`Delete ${label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveElement(element.id);
                    }}
                  >
                    <X size={12} />
                  </ActionIcon>
                )}
              </Group>
            );
          })}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
