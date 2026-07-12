import { useState } from 'react';
import { NumberInput } from '@mantine/core';
import { TransformOperation, type TransformParams } from '@/cad/types';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function RotatePanel({ onChange }: OperationPanelProps) {
  const [angle, setAngle] = useState(0);

  useReportDraft(onChange, {
    params: {
      type: TransformOperation.ROTATE,
      rotation: { axis: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } }, angle },
    } as TransformParams,
  });

  return <NumberInput label="Angle" value={angle} onChange={(val) => setAngle(Number(val))} size="sm" />;
}
