import { Box, Center, Paper, Text, Button } from "@mantine/core";

export function ErrorOverlay({ error, onRetry }: { error: string; onRetry: () => void }) {
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
        <Paper
          radius="md"
          p="xl"
          maw={384}
          style={{
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(24, 24, 27, 0.8)',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          }}
        >
          <Text size="sm" fw={600} c="red" mb={8}>
            OpenCascade Error
          </Text>
          <Text size="xs" c="dimmed" mb={16} style={{ wordBreak: 'break-word' }}>
            {error}
          </Text>
          <Button color="indigo" size="xs" onClick={onRetry}>
            Retry
          </Button>
        </Paper>
      </Center>
    </Box>
  );
}
