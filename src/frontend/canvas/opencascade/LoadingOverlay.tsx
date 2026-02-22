import { Box, Center, Stack, Text } from "@mantine/core";
import { CircleNotch } from "@phosphor-icons/react";

export function LoadingOverlay({ message }: { message: string }) {
  return (
    <Box
      pos="absolute"
      style={{
        inset: 0,
        zIndex: 20,
        backgroundColor: 'rgba(10, 10, 15, 0.8)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <Center h="100%">
        <Stack align="center" gap="xs">
          <CircleNotch size={32} weight="regular" color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          <Text size="sm" fw={500} c="dimmed">{message || "Loading\u2026"}</Text>
        </Stack>
      </Center>
    </Box>
  );
}
