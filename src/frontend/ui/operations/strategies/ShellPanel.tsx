import { useState } from 'react';
import { MultiSelect, NumberInput, Text } from '@mantine/core';
import { refLabel, SubShapeKind, type ShellParams } from '@/cad/types';
import { useFaceSelection } from './shared/useSubShapeSelection';
import { SelectorRuleInput } from './shared/SelectorRuleInput';
import { FACE_SELECTOR_PRESETS } from './shared/selectorPresets';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function ShellPanel({ ctx, initialParams, onResolveSelector, onChange }: OperationPanelProps) {
  const p = initialParams as ShellParams | undefined;
  const [thickness, setThickness] = useState(p?.thickness ?? 2);
  const [selectedFaces, setSelectedFaces] = useFaceSelection(
    p ? p.faces.map(refLabel) : (ctx.selectedFaceId !== null ? [`face-${ctx.selectedFaceId}`] : []),
    ctx.selectedFaceId,
  );
  const [liveSelector, setLiveSelector] = useState<string | undefined>(p?.selector);

  useReportDraft(onChange, selectedFaces.length > 0
    ? { params: { thickness, faces: selectedFaces, selector: liveSelector } as ShellParams }
    : null);

  return (
    <>
      <NumberInput label="Thickness" value={thickness} onChange={(val) => setThickness(Number(val))} min={0.1} size="sm" />
      <SelectorRuleInput
        kind={SubShapeKind.Face}
        presets={FACE_SELECTOR_PRESETS}
        onResolveSelector={onResolveSelector}
        selected={selectedFaces}
        setSelected={setSelectedFaces}
        liveSelector={liveSelector}
        setLiveSelector={setLiveSelector}
      />
      <MultiSelect
        label="Faces to Remove"
        placeholder="Select faces"
        value={selectedFaces}
        onChange={setSelectedFaces}
        data={selectedFaces.map((f) => ({ value: f, label: f }))}
        size="sm"
        readOnly
      />
      <Text size="xs" c="dimmed">Click faces in the viewport to remove them.</Text>
    </>
  );
}
