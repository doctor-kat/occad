import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput } from '@mantine/core';
import { TransformOperation, type TransformParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const ScalePanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function ScalePanel(
  { onConfirm, onValidChange },
  ref,
) {
  const [factor, setFactor] = useState(1);

  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => {
      onConfirm({
        type: TransformOperation.SCALE,
        scale: { factor, center: { x: 0, y: 0, z: 0 } },
      } as TransformParams);
    },
  }));

  return <NumberInput label="Factor" value={factor} onChange={(val) => setFactor(Number(val))} min={0.01} step={0.1} size="sm" />;
});
