import { Group, Stack, Text } from '@mantine/core';
import type { MeasureParams } from '@/cad/types';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function MeasurePanel({ ctx, onChange }: OperationPanelProps) {
  const entities: string[] = [];
  if (ctx.selectedFaceId !== null) entities.push(`face-${ctx.selectedFaceId}`);
  if (ctx.selectedEdgeIndex !== null) entities.push(`edge-${ctx.selectedEdgeIndex}`);
  if (ctx.selectedVertexIndex !== null) entities.push(`vertex-${ctx.selectedVertexIndex}`);

  useReportDraft(onChange, { params: { type: 'distance', entities } as MeasureParams });

  return (
    <Stack gap="xs">
      <Text size="sm">Selected entities for measurement:</Text>
      <Group gap="xs">
        {ctx.selectedFaceId !== null && <Text size="xs">Face {ctx.selectedFaceId + 1}</Text>}
        {ctx.selectedEdgeIndex !== null && <Text size="xs">Edge {ctx.selectedEdgeIndex + 1}</Text>}
        {ctx.selectedVertexIndex !== null && <Text size="xs">Vertex {ctx.selectedVertexIndex + 1}</Text>}
      </Group>
      {ctx.selectedFaceId === null && ctx.selectedEdgeIndex === null && ctx.selectedVertexIndex === null && (
        <Text size="xs" c="dimmed">Select entities in the viewport to measure.</Text>
      )}
    </Stack>
  );
}
