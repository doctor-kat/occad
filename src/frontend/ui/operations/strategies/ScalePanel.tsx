import { useState } from 'react';
import { NumberInput } from '@mantine/core';
import { TransformOperation, type TransformParams } from '@/cad/types';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function ScalePanel({ onChange }: OperationPanelProps) {
  const [factor, setFactor] = useState(1);

  useReportDraft(onChange, {
    params: {
      type: TransformOperation.SCALE,
      scale: { factor, center: { x: 0, y: 0, z: 0 } },
    } as TransformParams,
  });

  return <NumberInput label="Factor" value={factor} onChange={(val) => setFactor(Number(val))} min={0.01} step={0.1} size="sm" />;
}
