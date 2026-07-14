import { Box, Center, Stack, Text } from "@mantine/core";

/** Shown when there's no geometry and nothing is loading or errored. */
export function ViewportEmptyState() {
  return (
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
  );
}
