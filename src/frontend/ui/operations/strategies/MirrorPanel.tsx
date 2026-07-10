import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Stack, Text } from '@mantine/core';
import { TransformOperation, type Point3D, type TransformParams, type Vector3D } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const MirrorPanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function MirrorPanel(
  { project, ctx, onConfirm, onValidChange },
  ref,
) {
  const plane = project.referenceGeometry.find((r) => r.id === ctx.selectedTreeItem && r.type === 'plane');
  const isValid = !!plane;
  useEffect(() => onValidChange(isValid), [isValid, onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      if (!plane) return;
      let origin: Point3D = { x: 0, y: 0, z: 0 };
      let normal: Vector3D = { x: 0, y: 0, z: 1 };
      if (plane.id === 'front-plane') normal = { x: 0, y: 0, z: 1 };
      else if (plane.id === 'top-plane') normal = { x: 0, y: 1, z: 0 };
      else if (plane.id === 'right-plane') normal = { x: 1, y: 0, z: 0 };

      onConfirm({
        type: TransformOperation.MIRROR,
        mirrorPlane: { origin, direction: normal },
      } as TransformParams);
    },
  }));

  return (
    <Stack gap="xs">
      <Text size="sm">Mirror Plane:</Text>
      {plane ? (
        <Text size="xs">Using {plane.name}</Text>
      ) : (
        <Text size="xs" c="dimmed">Select a plane in the tree to use as mirror plane.</Text>
      )}
    </Stack>
  );
});
