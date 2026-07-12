import { useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveTorusParams } from '@/cad/types';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function TorusPanel({ initialParams, onChange }: OperationPanelProps) {
  const p = initialParams as PrimitiveTorusParams | undefined;
  const [majorRadius, setMajorRadius] = useState(p?.majorRadius ?? 40);
  const [minorRadius, setMinorRadius] = useState(p?.minorRadius ?? 10);

  useReportDraft(onChange, {
    params: { majorRadius, minorRadius, center: { x: 0, y: 0, z: 0 } } as PrimitiveTorusParams,
  });

  return (
    <>
      <NumberInput label="Major Radius" value={majorRadius} onChange={(val) => setMajorRadius(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Minor Radius" value={minorRadius} onChange={(val) => setMinorRadius(Number(val))} min={0.1} size="sm" />
    </>
  );
}
