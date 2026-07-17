import { useEffect, useState, useCallback } from 'react';
import { Modal, Box, Text, Stack, Group, Progress, Button, Divider } from '@mantine/core';
import { Gear, Trash } from '@phosphor-icons/react';
import { useProjectStore } from '@/frontend/shared/projectStore';
import { projectApi } from '@/frontend/shared/projectApi';
import { getStorageUsage, formatBytes, type StorageUsage } from '@/frontend/shared/storageUsage';

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value}
      </Text>
    </Group>
  );
}

/**
 * Settings modal. Currently scoped to a Storage section: an origin usage meter,
 * a per-bucket breakdown, and a destructive "clear version history" action —
 * the pressure valve for the unlimited-retention version timeline.
 */
export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const projectId = useProjectStore((s) => s.project.id);
  // The modal is always mounted but the count only matters while it's open —
  // gating the selector keeps it from re-rendering on every model edit.
  const historyEntryCount = useProjectStore((s) => (opened ? s.timeline.entries.length : 0));
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const refresh = useCallback(() => {
    void getStorageUsage(projectId).then(setUsage);
  }, [projectId]);

  useEffect(() => {
    if (opened) {
      setConfirmingClear(false);
      refresh();
    }
  }, [opened, refresh]);

  const handleClear = async () => {
    setConfirmingClear(false);
    await projectApi.clearHistory();
    refresh();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={
      <Group gap={8}>
        <Gear size={18} weight="bold" />
        <Text fw={600}>Settings</Text>
      </Group>
    }>
      <Stack gap="md">
        <Box>
          <Text fw={600} size="sm" mb={6}>
            Browser storage
          </Text>

          {usage?.percentUsed != null ? (
            <>
              <Progress value={usage.percentUsed} mb={6} />
              <Text size="xs" c="dimmed" mb="sm">
                {formatBytes(usage.totalUsage)} of {formatBytes(usage.quota)} used ({usage.percentUsed.toFixed(1)}%)
              </Text>
            </>
          ) : (
            <Text size="xs" c="dimmed" mb="sm">
              Origin total unavailable in this browser.
            </Text>
          )}

          <Stack gap={4}>
            <UsageRow label="Project (localStorage)" value={formatBytes(usage?.buckets.project ?? null)} />
            <UsageRow
              label={`Version history (${historyEntryCount} versions)`}
              value={formatBytes(usage?.buckets.versionHistory ?? null)}
            />
          </Stack>
        </Box>

        <Divider />

        <Box>
          {!confirmingClear ? (
            <Button
              variant="light"
              color="red"
              leftSection={<Trash size={16} />}
              onClick={() => setConfirmingClear(true)}
            >
              Clear version history
            </Button>
          ) : (
            <Stack gap={8}>
              <Text size="sm">
                This permanently deletes all saved versions for this project. Your current model is
                unchanged. This can't be undone.
              </Text>
              <Group>
                <Button color="red" onClick={() => void handleClear()}>
                  Delete history
                </Button>
                <Button variant="default" onClick={() => setConfirmingClear(false)}>
                  Cancel
                </Button>
              </Group>
            </Stack>
          )}
        </Box>
      </Stack>
    </Modal>
  );
}
