import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveTorusParams } from '@/cad/types';
import type { OperationPanelHandle, OperationPanelProps } from './types';

export const TorusPanel = forwardRef<OperationPanelHandle, OperationPanelProps>(function TorusPanel(
  { initialParams, onConfirm, onValidChange },
  ref,
) {
  const p = initialParams as PrimitiveTorusParams | undefined;
  const [majorRadius, setMajorRadius] = useState(p?.majorRadius ?? 40);
  const [minorRadius, setMinorRadius] = useState(p?.minorRadius ?? 10);

  useEffect(() => onValidChange(true), [onValidChange]);

  useImperativeHandle(ref, () => ({
    submit: () => onConfirm({ majorRadius, minorRadius, center: { x: 0, y: 0, z: 0 } } as PrimitiveTorusParams),
  }));

  return (
    <>
      <NumberInput label="Major Radius" value={majorRadius} onChange={(val) => setMajorRadius(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Minor Radius" value={minorRadius} onChange={(val) => setMinorRadius(Number(val))} min={0.1} size="sm" />
    </>
  );
});
