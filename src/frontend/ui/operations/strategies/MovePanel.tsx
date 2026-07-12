import { useState } from 'react';
import { NumberInput } from '@mantine/core';
import { TransformOperation, type TransformParams } from '@/cad/types';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function MovePanel({ onChange }: OperationPanelProps) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [z, setZ] = useState(0);

  useReportDraft(onChange, {
    params: { type: TransformOperation.MOVE, translation: { x, y, z } } as TransformParams,
  });

  return (
    <>
      <NumberInput label="X" value={x} onChange={(val) => setX(Number(val))} size="sm" />
      <NumberInput label="Y" value={y} onChange={(val) => setY(Number(val))} size="sm" />
      <NumberInput label="Z" value={z} onChange={(val) => setZ(Number(val))} size="sm" />
    </>
  );
}
