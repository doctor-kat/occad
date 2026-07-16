import { Box, Button, Group, Text, useMantineTheme } from "@mantine/core";
import { Dot, Minus, NavigationArrow, Circle } from "@phosphor-icons/react";

export type ConstraintType = 'none' | 'point' | 'edge' | 'midpoint' | 'center';

const CONSTRAINTS = [
  { key: 'none', label: 'None', icon: null },
  { key: 'point', label: 'Point', icon: <Dot size={16} weight="regular" /> },
  { key: 'edge', label: 'Edge', icon: <Minus size={16} weight="regular" /> },
  { key: 'midpoint', label: 'Midpoint', icon: <NavigationArrow size={16} weight="regular" /> },
  { key: 'center', label: 'Center', icon: <Circle size={16} weight="regular" /> },
] as const;

export interface SketchConstraintsMenuProps {
  activeConstraint: ConstraintType;
  onChange: (constraint: ConstraintType) => void;
}

/** Bottom-center snapping-constraint toolbar, shown while a sketch is being edited. */
export function SketchConstraintsMenu({ activeConstraint, onChange }: SketchConstraintsMenuProps) {
  const theme = useMantineTheme();

  return (
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
        backdropFilter: 'blur(8px)',
        boxShadow: theme.shadows.lg,
      }}
    >
      <Group gap={0} style={{ padding: 4 }}>
        <Text size="xs" fw={600} c={theme.other.colors.mutedForeground} px="sm" py="xs">
          Constraints:
        </Text>

        {CONSTRAINTS.map(({ key, label, icon }) => {
          const isActive = activeConstraint === key;
          return (
            <Button
              key={key}
              size="xs"
              variant={isActive ? 'filled' : 'subtle'}
              onClick={() => onChange(key)}
              leftSection={icon}
              px="sm"
              style={{ borderRadius: theme.radius.md }}
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
  );
}
