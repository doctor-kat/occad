import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput } from '@mantine/core';
import { TransformOperation, type TransformParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const RotatePanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function RotatePanel(
  { onConfirm, onValidChange },
  ref,
) {
  const [angle, setAngle] = useState(0);

  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      onConfirm({
        type: TransformOperation.ROTATE,
        rotation: { axis: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }, angle },
      } as TransformParams);
    },
  }));

  return <NumberInput label="Angle" value={angle} onChange={(val) => setAngle(Number(val))} size="sm" />;
});
