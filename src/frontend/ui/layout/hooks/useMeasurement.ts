import { useCallback, useEffect, useState } from 'react';
import type { MeasurementData, MeasureBetweenData, MeasureSelection } from '@/cad/types';

// Measurement / Analysis readout (ROADMAP §4) for the Measure sidebar tab.
export function useMeasurement(
  activeSidebarTab: string | null,
  currentFeatureShapeId: string | null,
  measureShape: (requestId: string, shapeId: string) => void,
  measureBetween: (requestId: string, shapeId: string, a: MeasureSelection, b: MeasureSelection) => void,
  setMeasuredHandlers: (onMeasured: (result: MeasurementData) => void, onMeasuredBetween: (result: MeasureBetweenData) => void) => void,
) {
  const [measurement, setMeasurement] = useState<MeasurementData | null>(null);

  // Distance/angle between two picked sub-shapes (ROADMAP §4). `measurePicks`
  // accumulates up to two viewport picks while the Measure tab is open.
  const [measurePicks, setMeasurePicks] = useState<MeasureSelection[]>([]);
  const [betweenMeasurement, setBetweenMeasurement] = useState<MeasureBetweenData | null>(null);

  // Wire the worker's onMeasured/onMeasuredBetween callbacks (created inside
  // useOpenCascadeBridge, before this hook's setters exist) to our setters.
  useEffect(() => {
    setMeasuredHandlers(setMeasurement, setBetweenMeasurement);
  }, [setMeasuredHandlers]);

  // (Re)measure whenever the Measure tab is open and the current body changes,
  // and reset the two-slot pick set (sub-shape indices are only valid against
  // the current body) — one effect instead of two chained off the same
  // dependencies. Clearing first shows the "Measuring…" state until the worker
  // replies.
  useEffect(() => {
    setMeasurement(null);
    setMeasurePicks([]);
    setBetweenMeasurement(null);
    if (activeSidebarTab !== 'measure' || !currentFeatureShapeId) return;
    measureShape(crypto.randomUUID(), currentFeatureShapeId);
  }, [activeSidebarTab, currentFeatureShapeId, measureShape]);

  // Fire the distance/angle measurement once two sub-shapes are picked.
  useEffect(() => {
    if (measurePicks.length < 2 || !currentFeatureShapeId) return;
    setBetweenMeasurement(null);
    measureBetween(crypto.randomUUID(), currentFeatureShapeId, measurePicks[0], measurePicks[1]);
  }, [measurePicks, currentFeatureShapeId, measureBetween]);

  // Record a viewport pick into the two-slot measure set (FIFO, no immediate
  // duplicate). Called from the face/edge/vertex click handlers when the
  // Measure tab is active, instead of the normal single-select behaviour.
  const recordMeasurePick = useCallback((pick: MeasureSelection) => {
    setMeasurePicks((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.kind === pick.kind && last.index === pick.index) return prev;
      // Once two are chosen, a new pick starts a fresh pair from the last one.
      return prev.length >= 2 ? [pick] : [...prev, pick];
    });
  }, []);

  return { measurement, setMeasurement, measurePicks, setMeasurePicks, betweenMeasurement, setBetweenMeasurement, recordMeasurePick };
}
