import { Drawer, Box, Text, Stack, UnstyledButton, Group, Badge, ScrollArea } from '@mantine/core';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { useProjectStore } from '@/frontend/shared/projectStore';
import { projectApi } from '@/frontend/shared/projectApi';
import { current as timelineCurrent } from '@/cad/state/versionTimeline';

interface VersionHistoryDrawerProps {
  opened: boolean;
  onClose: () => void;
}

/** Relative time like "2 min ago" / "just now". */
function relativeTime(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Google-Docs-style version panel: the timeline entries newest-first, the
 * "you are here" marker highlighted, click to restore (branch-appends). Reads
 * the timeline straight from projectStore.
 */
export function VersionHistoryDrawer({ opened, onClose }: VersionHistoryDrawerProps) {
  const timeline = useProjectStore((s) => s.timeline);
  const currentId = timeline.currentId;
  // Newest first.
  const entries = [...timeline.entries].reverse();

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={340}
      title={
        <Group gap={8}>
          <ClockCounterClockwise size={18} weight="bold" />
          <Text fw={600}>Version history</Text>
        </Group>
      }
    >
      <ScrollArea h="calc(100vh - 120px)">
        <Stack gap={4}>
          {entries.map((entry) => {
            const isCurrent = entry.id === currentId;
            return (
              <UnstyledButton
                key={entry.id}
                onClick={() => {
                  projectApi.restoreVersion(entry.id);
                  onClose();
                }}
                disabled={isCurrent}
              >
                <Box
                  p="xs"
                  style={{
                    borderRadius: 6,
                    borderLeft: isCurrent ? '3px solid var(--mantine-primary-color-filled)' : '3px solid transparent',
                    backgroundColor: isCurrent ? 'var(--mantine-color-dark-6)' : undefined,
                    cursor: isCurrent ? 'default' : 'pointer',
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap={8}>
                    <Text size="sm" lineClamp={2} style={{ flex: 1 }}>
                      {entry.label}
                    </Text>
                    {isCurrent && (
                      <Badge size="xs" variant="light">
                        current
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {relativeTime(entry.timestamp)}
                  </Text>
                </Box>
              </UnstyledButton>
            );
          })}
        </Stack>
      </ScrollArea>
    </Drawer>
  );
}
