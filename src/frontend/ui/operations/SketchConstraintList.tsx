import { Box, Group, Text, ActionIcon, Tooltip, Stack, useMantineTheme } from '@mantine/core';
import { X } from '@phosphor-icons/react';
import type { Sketch } from '@/cad/types';

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
  const constraints = sketch.constraints || [];
  if (constraints.length === 0) return null;

  return (
    <Box
      pos="absolute"
      data-testid="constraint-list"
      style={{
        top: 64,
        right: 16,
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
        {constraints.map((c: any) => (
          <Group key={c.id} justify="space-between" gap={6} wrap="nowrap" data-testid={`constraint-row-${c.id}`}>
            <Text size="xs" c={theme.other.colors.foreground} truncate>
              {constraintLabel(c)}
            </Text>
            <Tooltip label="Delete constraint" position="left" withArrow>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="red"
                data-testid={`constraint-delete-${c.id}`}
                aria-label={`Delete ${constraintLabel(c)}`}
                onClick={() => onRemove(c.id)}
              >
                <X size={12} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
      </Stack>
    </Box>
  );
}
