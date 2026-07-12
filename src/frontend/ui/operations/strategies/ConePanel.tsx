import { useState } from 'react';
import { NumberInput } from '@mantine/core';
import type { PrimitiveConeParams } from '@/cad/types';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function ConePanel({ initialParams, onChange }: OperationPanelProps) {
  const p = initialParams as PrimitiveConeParams | undefined;
  const [radius, setRadius] = useState(p?.radius1 ?? 25);
  const [radius2, setRadius2] = useState(p?.radius2 ?? 0);
  const [height, setHeight] = useState(p?.height ?? 50);

  useReportDraft(onChange, {
    params: { radius1: radius, radius2, height, center: { x: 0, y: 0, z: 0 } } as PrimitiveConeParams,
  });

  return (
    <>
      <NumberInput label="Base Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />
      <NumberInput label="Top Radius" value={radius2} onChange={(val) => setRadius2(Number(val))} min={0} size="sm" />
      <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
    </>
  );
}
