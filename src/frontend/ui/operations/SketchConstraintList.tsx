import { Box, Group, Text, ActionIcon, Tooltip, Stack, useMantineTheme } from '@mantine/core';
import { X } from '@phosphor-icons/react';
import type { Sketch } from '@/cad/types';
import { useViewportStore } from '@/frontend/shared/viewportStore';

interface SketchConstraintListProps {
  sketch: Sketch;
  onRemove: (constraintId: string) => void;
}

/** Friendly label for a planegcs constraint object. */
function constraintLabel(c: any): string {
  switch (c.type) {
    case 'horizontal_l': return 'Horizontal';
    case 'vertical_l': return 'Vertical';
    case 'parallel': return 'Parallel';
    case 'perpendicular_ll': return 'Perpendicular';
    case 'equal_length': return 'Equal';
    case 'l2l_angle_ll': return `Angle ${Math.round(((c.angle ?? 0) * 180) / Math.PI)}°`;
    case 'p2p_coincident': return 'Coincident';
    case 'p2p_distance': return `Distance ${c.distance ?? ''}`;
    case 'difference': {
      const prop = c.param1?.prop;
      if (prop === 'x') return `Horiz. Dist ${c.difference ?? ''}`;
      if (prop === 'y') return `Vert. Dist ${c.difference ?? ''}`;
      return `Difference ${c.difference ?? ''}`;
    }
    case 'circle_radius':
    case 'arc_radius': return `Radius ${c.radius ?? ''}`;
    case 'tangent_lc': return 'Tangent';
    default: return c.type;
  }
}

/**
 * Lists the active sketch's constraints with a per-row delete button.
 * Rendered in sketch mode; complements {@link SketchConstraintToolbar} (create).
 */
export function SketchConstraintList({ sketch, onRemove }: SketchConstraintListProps) {
  const theme = useMantineTheme();
  const selectedConstraintId = useViewportStore((s) => s.selectedConstraintId);
  const setSelectedConstraintId = useViewportStore((s) => s.setSelectedConstraintId);
  const hoveredConstraintId = useViewportStore((s) => s.hoveredConstraintId);
  const setHoveredConstraintId = useViewportStore((s) => s.setHoveredConstraintId);
  const constraints = sketch.constraints || [];
  if (constraints.length === 0) return null;

  return (
    <Box
      pos="absolute"
      data-testid="constraint-list"
      style={{
        // Top-left: the top-right corner holds the sketch Cancel/Finish controls,
        // and rectangles now auto-generate constraints, so a right-aligned list
        // would overlap and swallow clicks on "Finish Sketch".
        top: 64,
        left: 16,
        zIndex: 10,
        minWidth: 168,
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.other.colors.border}`,
        backgroundColor: `${theme.other.colors.card}cc`,
        backdropFilter: 'blur(12px)',
        boxShadow: theme.shadows.lg,
        padding: 8,
      }}
    >
      <Text size="xs" fw={600} c={theme.other.colors.mutedForeground} mb={6}>
        Constraints ({constraints.length})
      </Text>
      <Stack gap={2}>
        {constraints.map((c: any) => {
          const isSel = selectedConstraintId === c.id;
          const isHovered = hoveredConstraintId === c.id;
          return (
          <Group
            key={c.id}
            justify="space-between"
            gap={6}
            wrap="nowrap"
            data-testid={`constraint-row-${c.id}`}
            data-selected={isSel}
            data-hovered={isHovered}
            onClick={() => setSelectedConstraintId(isSel ? null : c.id)}
            onMouseEnter={() => setHoveredConstraintId(c.id)}
            onMouseLeave={() => setHoveredConstraintId(null)}
            style={{
              cursor: 'pointer',
              borderRadius: theme.radius.sm,
              padding: '2px 4px',
              backgroundColor: isSel
                ? `${theme.colors.blue[5]}26`
                : isHovered
                  ? `${theme.colors.orange[5]}26`
                  : 'transparent',
              border: `1px solid ${
                isSel ? `${theme.colors.blue[5]}66` : isHovered ? `${theme.colors.orange[5]}66` : 'transparent'
              }`,
            }}
          >
            <Text
              size="xs"
              c={isHovered && !isSel ? theme.colors.orange[4] : theme.other.colors.foreground}
              truncate
            >
              {constraintLabel(c)}
            </Text>
            <Tooltip label="Delete constraint" position="left" withArrow>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                data-testid={`constraint-delete-${c.id}`}
                aria-label={`Delete ${constraintLabel(c)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(c.id);
                }}
              >
                <X size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
          );
        })}
      </Stack>
    </Box>
  );
}
