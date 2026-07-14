import { useMemo, useState } from 'react';
import { Stack, Text, Box, ScrollArea, useMantineTheme, Group, ActionIcon, Badge, Center } from '@mantine/core';
import { X, CaretRight, CaretDown, Folders } from '@phosphor-icons/react';
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
import type { Sketch } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import { buildEntityList, isGroupSelected } from '@/cad/sketch/sketchGroups';
import { useViewportStore, isMultiSelectClick } from '@/frontend/shared/viewportStore.ts';

interface SketchEntitiesPanelProps {
  sketch: Sketch;
  /** Delete an entity (or a whole group) from the sketch, by element/group id. */
  onRemoveElement?: (id: string) => void;
}

/** Icon for each sketch element type. */
const TYPE_ICON: Record<string, ComponentType<CadIconProps>> = {
  [SketchElementType.LINE]: LineIcon,
  [SketchElementType.RECTANGLE]: RectangleIcon,
  [SketchElementType.CIRCLE]: CircleIcon,
  [SketchElementType.POLYGON]: PolygonIcon,
  [SketchElementType.ARC]: ArcIcon,
  [SketchElementType.ELLIPSE]: EllipseIcon,
  [SketchElementType.BEZIER]: SplineIcon,
  [SketchElementType.POINT]: PointIcon,
};

/**
 * Live list of the active sketch's entities, mirroring the selection set so it is
 * obvious what is selected (in tandem with the viewport box/crossing select).
 * Composite entities (e.g. a Center Rectangle) render as an expandable folder whose
 * children select / delete / hover as one unit. Rows are two-way wired to the viewport:
 * clicking toggles selection, hovering highlights the entity in the SketchOverlay.
 */
export function SketchEntitiesPanel({ sketch, onRemoveElement }: SketchEntitiesPanelProps) {
  const theme = useMantineTheme();
  const selectedIds = useViewportStore((s) => s.selectedSketchElementIds);
  const hoveredId = useViewportStore((s) => s.hoveredSketchElementId);
  const toggleSelection = useViewportStore((s) => s.toggleSketchElementSelection);
  const setSelection = useViewportStore((s) => s.setSketchElementSelection);
  const setHovered = useViewportStore((s) => s.setHoveredSketchElementId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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

  const nodes = buildEntityList(elements);
  const hoveredGroupId = hoveredId
    ? elements.find((e) => e.id === hoveredId)?.groupId
    : undefined;

  // Selecting a set of ids: plain click replaces the selection, modifier toggles.
  const applySelect = (ids: string[], e: React.MouseEvent) => {
    if (isMultiSelectClick(e)) {
      ids.forEach((id) => toggleSelection(id));
    } else {
      setSelection(ids);
    }
  };

  const rowStyle = (isSelected: boolean, isHovered: boolean, indent: number) => ({
    height: 32,
    paddingLeft: indent,
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
    transition: 'background-color 150ms, border-color 150ms',
  });

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

          {nodes.map((node) => {
            if (node.kind === 'element') {
              const Icon = TYPE_ICON[node.elementType] ?? PolygonIcon;
              const isSelected = selectedIdSet.has(node.id);
              const isHovered = hoveredId === node.id;
              return (
                <Group
                  key={node.id}
                  gap={6}
                  wrap="nowrap"
                  data-testid={`sketch-entity-${node.id}`}
                  data-selected={isSelected}
                  style={rowStyle(isSelected, isHovered, 16)}
                  onClick={(e) => applySelect([node.id], e)}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <Icon size={16} color={isSelected ? theme.colors.blue[4] : theme.colors.cyan[5]} />
                  <Text size="xs" fw={500} style={{ color: theme.other.colors.foreground, flex: 1 }}>
                    {node.label}
                  </Text>
                  {node.construction && (
                    <Badge size="xs" variant="light" color="gray" style={{ height: 16 }}>
                      constr
                    </Badge>
                  )}
                  {onRemoveElement && (
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      data-testid={`sketch-entity-delete-${node.id}`}
                      aria-label={`Delete ${node.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveElement(node.id);
                      }}
                    >
                      <X size={12} />
                    </ActionIcon>
                  )}
                </Group>
              );
            }

            // Group folder row + (optionally) its children.
            const childIds = node.childIds;
            const isSelected = isGroupSelected(elements, node.groupId, selectedIds);
            const isHovered = hoveredGroupId === node.groupId;
            const isOpen = expanded.has(node.groupId);
            return (
              <Box key={node.groupId}>
                <Group
                  gap={6}
                  wrap="nowrap"
                  data-testid={`sketch-group-${node.groupId}`}
                  data-selected={isSelected}
                  style={rowStyle(isSelected, isHovered, 4)}
                  onClick={(e) => applySelect(childIds, e)}
                  onMouseEnter={() => setHovered(childIds[0] ?? null)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="gray"
                    data-testid={`sketch-group-toggle-${node.groupId}`}
                    aria-label={isOpen ? 'Collapse group' : 'Expand group'}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(node.groupId)) next.delete(node.groupId);
                        else next.add(node.groupId);
                        return next;
                      });
                    }}
                  >
                    {isOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
                  </ActionIcon>
                  <Folders size={16} color={isSelected ? theme.colors.blue[4] : theme.colors.cyan[5]} />
                  <Text size="xs" fw={500} style={{ color: theme.other.colors.foreground, flex: 1 }}>
                    {node.label}
                  </Text>
                  {onRemoveElement && (
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      data-testid={`sketch-group-delete-${node.groupId}`}
                      aria-label={`Delete ${node.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveElement(node.groupId);
                      }}
                    >
                      <X size={12} />
                    </ActionIcon>
                  )}
                </Group>

                {isOpen &&
                  node.children.map((child) => {
                    const ChildIcon = TYPE_ICON[child.elementType] ?? PolygonIcon;
                    const childHovered = hoveredId === child.id || isHovered;
                    return (
                      <Group
                        key={child.id}
                        gap={6}
                        wrap="nowrap"
                        data-testid={`sketch-entity-${child.id}`}
                        style={rowStyle(isSelected, childHovered, 40)}
                        // Children act as one unit: selecting one selects the group.
                        onClick={(e) => applySelect(childIds, e)}
                        onMouseEnter={() => setHovered(child.id)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <ChildIcon size={14} color={theme.colors.cyan[5]} />
                        <Text size="xs" style={{ color: theme.other.colors.mutedForeground, flex: 1 }}>
                          {child.label}
                        </Text>
                        {child.construction && (
                          <Badge size="xs" variant="light" color="gray" style={{ height: 16 }}>
                            constr
                          </Badge>
                        )}
                      </Group>
                    );
                  })}
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
