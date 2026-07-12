import { useState } from 'react';
import { Alert, NumberInput, Select } from '@mantine/core';
import { FeatureOperation, type RevolveParams } from '@/cad/types';
import { useDefaultSketchId } from './shared/useDefaultSketchId';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

/** Serves both REVOLVED_BOSS and REVOLVED_CUT — `isCut` is derived from `operation`. */
export function RevolvePanel({ operation, project, ctx, initialParams, initialSketchId, onChange }: OperationPanelProps) {
  const p = initialParams as RevolveParams | undefined;
  const closedSketches = project.sketches.filter((s) => s.isClosed);

  const [sketchId, setSketchId] = useDefaultSketchId(project, initialSketchId, ctx.selectedTreeItem);
  const [angle, setAngle] = useState(p?.angle ?? 360);

  const isCut = operation === FeatureOperation.REVOLVED_CUT;

  const params = {
    sketchId,
    axis: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } },
    angle,
    isCut,
  } as RevolveParams;
  useReportDraft(onChange, sketchId ? { params, sketchId } : null);

  if (closedSketches.length === 0) {
    return (
      <Alert color="yellow" title="No closed sketches">
        Create a closed sketch first to perform this operation.
      </Alert>
    );
  }

  return (
    <>
      <Select
        label="Sketch"
        placeholder="Select a sketch"
        value={sketchId}
        onChange={(value) => setSketchId(value || '')}
        data={closedSketches.map((sketch) => ({ value: sketch.id, label: sketch.name }))}
        size="sm"
      />
      <NumberInput label="Angle" value={angle} onChange={(val) => setAngle(Number(val))} min={0.1} max={360} step={1} size="sm" />
    </>
  );
}
