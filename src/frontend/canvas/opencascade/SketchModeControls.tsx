import { Box, Button, Group, Stack, Text, useMantineTheme } from "@mantine/core";
import { X, Check } from "@phosphor-icons/react";

export interface SketchModeControlsProps {
  /** The sketch currently being edited. */
  activeSketch: { plane: unknown; elements?: unknown[] };
  onCancel?: () => void;
  onFinish?: () => void;
}

/** Top-right HUD shown while editing a sketch: plane label, Cancel/Finish, element count. */
export function SketchModeControls({ activeSketch, onCancel, onFinish }: SketchModeControlsProps) {
  const theme = useMantineTheme();

  return (
    <Stack
      gap="sm"
      pos="absolute"
      style={{ top: 16, right: 16, zIndex: 10 }}
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
          backdropFilter: 'blur(8px)',
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
            onClick={onCancel}
            leftSection={<X size={14} weight="regular" />}
          >
            Cancel
          </Button>
          <Button
            size="xs"
            onClick={onFinish}
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
          backdropFilter: 'blur(8px)',
          boxShadow: theme.shadows.lg,
        }}
      >
        <Text size="xs" fw={500} c={theme.other.colors.mutedForeground}>
          Elements: {(activeSketch.elements || []).length}
        </Text>
      </Box>
    </Stack>
  );
}
