import { useState } from 'react';
import { MultiSelect, NumberInput, Text } from '@mantine/core';
import { refLabel, SubShapeKind, type ChamferParams } from '@/cad/types';
import { useEdgeSelection } from './shared/useSubShapeSelection';
import { SelectorRuleInput } from './shared/SelectorRuleInput';
import { EDGE_SELECTOR_PRESETS } from './shared/selectorPresets';
import { useReportDraft } from './shared/useReportDraft';
import type { OperationPanelProps } from './types';

export function ChamferPanel({ ctx, initialParams, onResolveSelector, onChange }: OperationPanelProps) {
  const p = initialParams as ChamferParams | undefined;
  const [distance, setDistance] = useState(p?.distance ?? 10);
  const [selectedEdges, setSelectedEdges] = useEdgeSelection(
    p ? p.edges.map(refLabel) : (ctx.selectedEdgeIndex !== null ? [`edge-${ctx.selectedEdgeIndex}`] : []),
    ctx.selectedEdgeIndex,
  );
  const [liveSelector, setLiveSelector] = useState<string | undefined>(p?.selector);

  useReportDraft(onChange, selectedEdges.length > 0
    ? { params: { distance, edges: selectedEdges, selector: liveSelector } as ChamferParams }
    : null);

  return (
    <>
      <NumberInput label="Distance" value={distance} onChange={(val) => setDistance(Number(val))} min={0.1} size="sm" />
      <SelectorRuleInput
        kind={SubShapeKind.Edge}
        presets={EDGE_SELECTOR_PRESETS}
        onResolveSelector={onResolveSelector}
        selected={selectedEdges}
        setSelected={setSelectedEdges}
        liveSelector={liveSelector}
        setLiveSelector={setLiveSelector}
      />
      <MultiSelect
        label="Edges"
        placeholder="Select edges"
        value={selectedEdges}
        onChange={setSelectedEdges}
        data={selectedEdges.map((e) => ({ value: e, label: e }))}
        size="sm"
        readOnly
      />
      <Text size="xs" c="dimmed">Click edges in the viewport to add them.</Text>
    </>
  );
}
