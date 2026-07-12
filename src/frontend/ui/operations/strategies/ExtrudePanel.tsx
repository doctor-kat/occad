import { useEffect, useState } from 'react';
import { Alert, NumberInput, Select } from '@mantine/core';
import { FeatureOperation, type ExtrudeParams } from '@/cad/types';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';
import { useDefaultSketchId } from './shared/useDefaultSketchId';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

/** Serves both EXTRUDE_BOSS and EXTRUDED_CUT — `isCut` is derived from `operation`. */
export function ExtrudePanel({ operation, project, ctx, initialParams, initialSketchId, onChange }: OperationPanelProps) {
  const p = initialParams as ExtrudeParams | undefined;
  const closedSketches = project.sketches.filter((s) => s.isClosed);

  const [sketchId, setSketchId] = useDefaultSketchId(project, initialSketchId, ctx.selectedTreeItem);
  const [distance, setDistance] = useState(p ? Math.abs(p.distance) : 10);
  const [direction, setDirection] = useState<'normal' | 'reverse'>(p ? (p.distance >= 0 ? 'normal' : 'reverse') : 'normal');

  const isCut = operation === FeatureOperation.EXTRUDED_CUT;

  useReportDraft(onChange, sketchId
    ? { params: { distance: direction === 'reverse' ? -distance : distance, isCut } as ExtrudeParams, sketchId }
    : null);

  // Live extrude preview in the viewport, cleared on unmount/param change.
  const setExtrudePreview = useViewportStore((state) => state.setExtrudePreview);
  useEffect(() => {
    if (sketchId) {
      setExtrudePreview({ sketchId, distance: distance || 0, direction });
    } else {
      setExtrudePreview(null);
    }
    return () => setExtrudePreview(null);
  }, [sketchId, distance, direction, setExtrudePreview]);

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
      <NumberInput label="Distance" value={distance} onChange={(val) => setDistance(Number(val))} min={0.1} step={1} size="sm" />
      <Select
        label="Direction"
        value={direction}
        onChange={(value) => setDirection(value as 'normal' | 'reverse')}
        data={[
          { value: 'normal', label: 'Normal' },
          { value: 'reverse', label: 'Reverse' },
        ]}
        size="sm"
      />
    </>
  );
}
