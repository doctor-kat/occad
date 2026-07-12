import { useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveSphereParams } from '@/cad/types';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function SpherePanel({ initialParams, onChange }: OperationPanelProps) {
  const p = initialParams as PrimitiveSphereParams | undefined;
  const [radius, setRadius] = useState(p?.radius ?? 25);

  useReportDraft(onChange, {
    params: { radius, center: { x: 0, y: 0, z: 0 } } as PrimitiveSphereParams,
  });

  return <NumberInput label="Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />;
}
