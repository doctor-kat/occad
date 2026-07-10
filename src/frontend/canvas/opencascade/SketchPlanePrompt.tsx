import { Box, Button, Group, Stack, Text, useMantineTheme } from "@mantine/core";
import { X } from "@phosphor-icons/react";

export interface SketchPlanePromptProps {
  onCancel?: () => void;
}

/**
 * Top-center prompt shown while a sketch tool is active but no plane/face has
 * been picked yet. Persistent — stays until the user picks a plane or cancels.
 */
export function SketchPlanePrompt({ onCancel }: SketchPlanePromptProps) {
  const theme = useMantineTheme();

  return (
    <Box
      pos="absolute"
      style={{
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.colors.yellow[6]}`,
        backgroundColor: `${theme.other.colors.card}cc`,
        backdropFilter: 'blur(8px)',
        boxShadow: theme.shadows.lg,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
      }}
    >
      <Group gap="md" wrap="nowrap">
        <Stack gap={2}>
          <Text size="xs" fw={600} c={theme.colors.yellow[5]}>
            Select a sketch plane
          </Text>
          <Text size="xs" c={theme.other.colors.mutedForeground}>
            Click a plane (or a face) to start your sketch.
          </Text>
        </Stack>
        <Button
          size="xs"
          variant="outline"
          color="gray"
          onClick={onCancel}
          leftSection={<X size={14} weight="regular" />}
        >
          Cancel
        </Button>
      </Group>
    </Box>
  );
}
