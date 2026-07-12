import { useState } from 'react';
import { Button, Stack, Group, Text, Box, useMantineTheme, ActionIcon, Title } from '@mantine/core';
import { X, Check } from '@phosphor-icons/react';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';
import { OPERATION_PANEL_REGISTRY } from './strategies/registry';
import type { PanelDraft } from './strategies/types';
import type {
  OperationParams,
  CADProject,
  StableRef,
  FeatureOperation,
  TransformOperation,
  SketchOperation,
  SubShapeKind,
} from '@/cad/types';

interface OperationPanelProps {
  title: string;
  operation: FeatureOperation | TransformOperation | SketchOperation;
  project: CADProject;
  initialParams?: OperationParams;
  initialSketchId?: string;
  selectedTreeItem?: string | null;
  /** Materializes a selector string (ROADMAP §9.1) against the live body's sub-shapes. */
  onResolveSelector?: (kind: SubShapeKind, selector: string) => Promise<StableRef[]>;
  onConfirm: (params: OperationParams, sketchId?: string) => void;
  onCancel: () => void;
}

/**
 * Thin shell: looks up the operation's self-contained Strategy component in
 * the registry-factory (src/frontend/ui/operations/strategies/) and renders
 * it inside shared header/footer chrome. The Strategy pushes its current
 * draft up via `onChange`; the shell just holds the latest draft and drives
 * Apply/Cancel from it — there is no imperative handle to pull state out of
 * the Strategy. Every FeatureOperation/TransformOperation that can reach this
 * panel is registered; anything missing (e.g. IMPORT, which has no
 * parametric params UI) falls back to a "not implemented" panel.
 */
export function OperationPanel({
  title,
  operation,
  project,
  initialParams,
  initialSketchId,
  selectedTreeItem,
  onResolveSelector,
  onConfirm,
  onCancel,
}: OperationPanelProps) {
  const theme = useMantineTheme();

  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);

  const RegisteredPanel = OPERATION_PANEL_REGISTRY[operation];
  const [draft, setDraft] = useState<PanelDraft | null>(null);

  const handleApply = () => {
    if (draft) onConfirm(draft.params, draft.sketchId);
  };

  return (
    <Stack gap={0} style={{ backgroundColor: theme.other.colors.background }}>
      {/* Header */}
      <Box
        px={16}
        py={12}
        style={{
          borderBottom: `1px solid ${theme.other.colors.sidebarBorder}`,
          backgroundColor: `${theme.colors.blue[5]}15`,
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          <Title order={6} style={{ color: theme.other.colors.foreground, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </Title>
          <Group gap={4}>
            <ActionIcon variant="subtle" color="gray" onClick={onCancel}>
              <X size={16} />
            </ActionIcon>
            <ActionIcon variant="filled" color="blue" onClick={handleApply} disabled={!RegisteredPanel || !draft}>
              <Check size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Content */}
      <Box p={16} style={{ overflowY: 'auto' }}>
        <Stack gap="md">
          {RegisteredPanel ? (
            // key resets the draft on operation switch: the remounted panel's first report overwrites it.
            <RegisteredPanel
              key={operation}
              operation={operation}
              project={project}
              ctx={{ selectedFaceId, selectedEdgeIndex, selectedVertexIndex, selectedTreeItem }}
              initialParams={initialParams}
              initialSketchId={initialSketchId}
              onResolveSelector={onResolveSelector}
              onChange={setDraft}
            />
          ) : (
            <Text size="sm">Operation parameters for {operation} not yet implemented.</Text>
          )}
        </Stack>
      </Box>

      {/* Footer Buttons */}
      <Box p={16} style={{ borderTop: `1px solid ${theme.other.colors.sidebarBorder}` }}>
        <Group grow>
          <Button variant="subtle" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!RegisteredPanel || !draft}>
            Apply
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}
