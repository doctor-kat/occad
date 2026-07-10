import { useReducer, useEffect, useMemo, useRef, useState } from 'react';
import { Button, TextInput, Select, Stack, Group, Text, Alert, Box, useMantineTheme, ActionIcon, Title, NumberInput, Checkbox, MultiSelect } from '@mantine/core';
import { X, Check } from '@phosphor-icons/react';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';
import { OPERATION_PANEL_REGISTRY } from './strategies/registry';
import type { OperationPanelHandle } from './strategies/types';
import { EDGE_SELECTOR_PRESETS, FACE_SELECTOR_PRESETS } from './strategies/shared/selectorPresets';
import type {
  Sketch,
  ExtrudeParams,
  RevolveParams,
  PrimitiveSphereParams,
  PrimitiveCylinderParams,
  PrimitiveConeParams,
  PrimitiveTorusParams,
  PrimitiveWedgeParams,
  ChamferParams,
  ShellParams,
  OffsetParams,
  SweepParams,
  LoftParams,
  BooleanParams,
  TransformParams,
  OperationParams,
  SketchPlane,
  Vector3D,
  Point3D,
  CADProject,
  StableRef,
} from '@/cad/types';
import { PlaneType, FeatureOperation, TransformOperation, SketchOperation, refLabel, SubShapeKind } from '@/cad/types';

/**
 * Helper to get the normal vector for a sketch plane
 */
function getSketchNormal(plane: SketchPlane): Vector3D {
  if (plane.normal) return plane.normal;

  switch (plane.type) {
    case PlaneType.XY: return { x: 0, y: 0, z: 1 };
    case PlaneType.XZ: return { x: 0, y: 1, z: 0 };
    case PlaneType.YZ: return { x: 1, y: 0, z: 0 };
    default: return { x: 0, y: 0, z: 1 };
  }
}

type SelectorStatus = 'idle' | 'loading' | 'matched' | 'no-match' | 'error';

/**
 * All of the panel's form state in one object. It's local, ephemeral state
 * scoped to a single panel instance (a `useReducer` rather than a shared store),
 * so it resets cleanly each time the panel mounts for a new operation.
 */
interface PanelState {
  // Common
  sketchId: string;
  isCut: boolean;
  // Extrude / revolve
  distance: number;
  angle: number;
  direction: 'normal' | 'reverse';
  // Primitives
  width: number;
  height: number;
  depth: number;
  radius: number;
  radius2: number;
  majorRadius: number;
  minorRadius: number;
  ltx: number;
  // Modifications
  selectedEdges: string[];
  selectedFaces: string[];
  selectedFeatures: string[];
  thickness: number;
  // Advanced modeling (sweep / loft)
  profileSketchId: string;
  pathSketchId: string;
  loftSketchIds: string[];
  loftRuled: boolean;
  // Selector-rule (ROADMAP §9.1 Phase 3/4)
  selectorText: string;
  selectorStatus: SelectorStatus;
  keepSelectorLive: boolean;
  liveSelector: string | undefined;
  // Transforms
  translateX: number;
  translateY: number;
  translateZ: number;
  rotateAngle: number;
  scaleFactor: number;
}

const INITIAL_STATE: PanelState = {
  sketchId: '',
  isCut: false,
  distance: 10,
  angle: 360,
  direction: 'normal',
  width: 50,
  height: 50,
  depth: 50,
  radius: 25,
  radius2: 0,
  majorRadius: 40,
  minorRadius: 10,
  ltx: 25,
  selectedEdges: [],
  selectedFaces: [],
  selectedFeatures: [],
  thickness: 2,
  profileSketchId: '',
  pathSketchId: '',
  loftSketchIds: [],
  loftRuled: false,
  selectorText: '',
  selectorStatus: 'idle',
  keepSelectorLive: false,
  liveSelector: undefined,
  translateX: 0,
  translateY: 0,
  translateZ: 0,
  rotateAngle: 0,
  scaleFactor: 1,
};

type PanelAction =
  | { type: 'patch'; patch: Partial<PanelState> }
  /** Union a label into one of the sub-shape selection lists (viewport click / selector match). */
  | { type: 'addToList'; key: 'selectedEdges' | 'selectedFaces' | 'selectedFeatures'; values: string[] };

function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'addToList': {
      const merged = Array.from(new Set([...state[action.key], ...action.values]));
      // Preserve reference if nothing new was added (avoids needless re-renders).
      return merged.length === state[action.key].length
        ? state
        : { ...state, [action.key]: merged };
    }
    default:
      return state;
  }
}

interface OperationPanelProps {
  title: string;
  operation: FeatureOperation | TransformOperation | SketchOperation;
  project: CADProject;
  initialParams?: OperationParams;
  initialSketchId?: string;
  selectedTreeItem?: string | null;
  /** Materializes a selector string (ROADMAP §9.1) against the live body's sub-shapes. */
  onResolveSelector?: (kind: SubShapeKind, selector: string) => Promise<StableRef[]>;
  onConfirm: (params: OperationParams, sketchId?: string) => void;
  onCancel: () => void;
}

export function OperationPanel({
  title,
  operation,
  project,
  initialParams,
  initialSketchId,
  selectedTreeItem,
  onResolveSelector,
  onConfirm,
  onCancel,
}: OperationPanelProps) {
  const theme = useMantineTheme();
  
  // Viewport selections
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);

  // Registry-factory lookup: operations migrated to a self-contained Strategy
  // component (src/frontend/ui/operations/strategies/) render through here
  // instead of the legacy switch-based renderInputs/handleConfirm/isValid below.
  const RegisteredPanel = OPERATION_PANEL_REGISTRY[operation];
  const registeredPanelRef = useRef<OperationPanelHandle>(null);
  const [registeredValid, setRegisteredValid] = useState(false);

  // All form state lives in one reducer; `set` patches individual fields.
  // Phase 4 note: `keepSelectorLive` persists the last-applied rule on the
  // feature so it re-evaluates live every rebuild (instead of just materializing
  // matches once into the manual edge/face list).
  const [state, dispatch] = useReducer(panelReducer, INITIAL_STATE);
  const set = (patch: Partial<PanelState>) => dispatch({ type: 'patch', patch });
  const {
    sketchId, isCut, distance, angle, direction,
    width, height, depth, radius, radius2, majorRadius, minorRadius, ltx,
    selectedEdges, selectedFaces, selectedFeatures, thickness,
    profileSketchId, pathSketchId, loftSketchIds, loftRuled,
    selectorText, selectorStatus, keepSelectorLive, liveSelector,
    translateX, translateY, translateZ, rotateAngle, scaleFactor,
  } = state;

  // Initialize state based on operation and initialParams
  useEffect(() => {
    const patch: Partial<PanelState> = {};

    // Determine if it's a cut operation
    patch.isCut = operation === FeatureOperation.EXTRUDED_CUT || operation === FeatureOperation.REVOLVED_CUT;

    if (initialSketchId) {
      patch.sketchId = initialSketchId;
    } else if (!sketchId) {
      // If no sketchId set yet, try to find a valid one based on selection or defaults
      const selectedSketch = project.sketches.find(s => s.id === selectedTreeItem);
      if (selectedSketch) {
        patch.sketchId = selectedSketch.id;
      } else {
        const closedSketches = project.sketches.filter(s => s.isClosed);
        if (closedSketches.length > 0) {
          patch.sketchId = closedSketches[0].id;
        }
      }
    }

    if (initialParams) {
      if ('distance' in initialParams) {
        patch.distance = Math.abs(initialParams.distance);
        patch.direction = initialParams.distance >= 0 ? 'normal' : 'reverse';
      }
      if ('angle' in initialParams) patch.angle = initialParams.angle;
      if ('width' in initialParams) patch.width = initialParams.width;
      if ('height' in initialParams) patch.height = initialParams.height;
      if ('depth' in initialParams) patch.depth = initialParams.depth;
      if ('radius' in initialParams) patch.radius = initialParams.radius;
      if ('radius1' in initialParams) patch.radius = initialParams.radius1;
      if ('radius2' in initialParams) patch.radius2 = initialParams.radius2;
      if ('majorRadius' in initialParams) patch.majorRadius = initialParams.majorRadius;
      if ('minorRadius' in initialParams) patch.minorRadius = initialParams.minorRadius;
      if ('ltx' in initialParams) patch.ltx = initialParams.ltx;
      // Params may carry fingerprinted StableRefs; show their `edge-N`/`face-N`
      // label. (The worker re-captures fingerprints on the next rebuild, so
      // editing a modification this way doesn't permanently lose them.)
      if ('edges' in initialParams) patch.selectedEdges = initialParams.edges.map(refLabel);
      if ('faces' in initialParams) patch.selectedFaces = initialParams.faces.map(refLabel);
      if ('selector' in initialParams && initialParams.selector) {
        patch.liveSelector = initialParams.selector;
        patch.keepSelectorLive = true;
        patch.selectorText = initialParams.selector;
      }
      if ('featureIds' in (initialParams as any)) patch.selectedFeatures = (initialParams as any).featureIds;
      if ('thickness' in initialParams) patch.thickness = initialParams.thickness;
      if ('profileSketchId' in initialParams) patch.profileSketchId = (initialParams as SweepParams).profileSketchId;
      if ('pathSketchId' in initialParams) patch.pathSketchId = (initialParams as SweepParams).pathSketchId;
      if ('sketchIds' in initialParams) {
        patch.loftSketchIds = (initialParams as LoftParams).sketchIds;
        patch.loftRuled = !!(initialParams as LoftParams).ruled;
      }
    } else {
      // Default initializations for some ops based on selection
      // (FILLET seeds its own edge selection inside FilletPanel.)
      if (operation === FeatureOperation.CHAMFER) {
        if (selectedEdgeIndex !== null) {
          patch.selectedEdges = [`edge-${selectedEdgeIndex}`];
        }
      } else if (operation === FeatureOperation.SHELL) {
        if (selectedFaceId !== null) {
          patch.selectedFaces = [`face-${selectedFaceId}`];
        }
      } else if (operation === FeatureOperation.UNION || operation === FeatureOperation.INTERSECT) {
        if (selectedTreeItem && project.features.some(f => f.id === selectedTreeItem)) {
          patch.selectedFeatures = [selectedTreeItem];
        }
      }
    }

    set(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation, initialParams, selectedEdgeIndex, selectedFaceId, initialSketchId, project.sketches, project.features, selectedTreeItem]);

  // Append new selections from viewport while panel is open
  // (FILLET appends its own edge selection inside FilletPanel.)
  useEffect(() => {
    if (operation === FeatureOperation.CHAMFER) {
      if (selectedEdgeIndex !== null) {
        dispatch({ type: 'addToList', key: 'selectedEdges', values: [`edge-${selectedEdgeIndex}`] });
      }
    } else if (operation === FeatureOperation.SHELL || operation === FeatureOperation.OFFSET) {
      if (selectedFaceId !== null) {
        dispatch({ type: 'addToList', key: 'selectedFaces', values: [`face-${selectedFaceId}`] });
      }
    } else if (operation === FeatureOperation.UNION || operation === FeatureOperation.INTERSECT) {
      if (selectedTreeItem && project.features.some(f => f.id === selectedTreeItem)) {
        dispatch({ type: 'addToList', key: 'selectedFeatures', values: [selectedTreeItem] });
      }
    }
  }, [selectedEdgeIndex, selectedFaceId, selectedTreeItem, operation, project.features]);

  // Set default sketch for sketch-based operations
  useEffect(() => {
    if (operation === FeatureOperation.EXTRUDE_BOSS || operation === FeatureOperation.EXTRUDED_CUT || 
        operation === FeatureOperation.REVOLVED_BOSS || operation === FeatureOperation.REVOLVED_CUT) {
      if (!sketchId) {
        const closedSketches = project.sketches.filter(s => s.isClosed);
        if (closedSketches.length > 0) {
          set({ sketchId: closedSketches[0].id });
        }
      }
    }
  }, [operation, project.sketches, sketchId]);

  const handleConfirm = () => {
    let params: OperationParams;

    switch (operation) {
      case FeatureOperation.EXTRUDE_BOSS:
      case FeatureOperation.EXTRUDED_CUT: {
        const selectedSketch = project.sketches.find(s => s.id === sketchId);
        if (!selectedSketch) return;
        params = {
          distance: direction === 'reverse' ? -distance : distance,
          isCut,
        } as ExtrudeParams;
        onConfirm(params, sketchId);
        break;
      }
      case FeatureOperation.REVOLVED_BOSS:
      case FeatureOperation.REVOLVED_CUT: {
        const selectedSketch = project.sketches.find(s => s.id === sketchId);
        if (!selectedSketch) return;
        params = {
          sketchId,
          axis: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } },
          angle,
          isCut,
        } as RevolveParams;
        onConfirm(params, sketchId);
        break;
      }
      case FeatureOperation.UNION:
      case FeatureOperation.INTERSECT:
        params = {
          operation: operation === FeatureOperation.UNION ? 'union' : 'intersect',
          featureIds: selectedFeatures,
        } as BooleanParams;
        onConfirm(params);
        break;
      case FeatureOperation.SPHERE:
        params = { radius, center: { x: 0, y: 0, z: 0 } } as PrimitiveSphereParams;
        onConfirm(params);
        break;
      case FeatureOperation.CYLINDER:
        params = { radius, height, center: { x: 0, y: 0, z: 0 } } as PrimitiveCylinderParams;
        onConfirm(params);
        break;
      case FeatureOperation.CONE:
        params = { radius1: radius, radius2, height, center: { x: 0, y: 0, z: 0 } } as PrimitiveConeParams;
        onConfirm(params);
        break;
      case FeatureOperation.TORUS:
        params = { majorRadius, minorRadius, center: { x: 0, y: 0, z: 0 } } as PrimitiveTorusParams;
        onConfirm(params);
        break;
      case FeatureOperation.WEDGE:
        params = { width, height, depth, ltx, center: { x: 0, y: 0, z: 0 } } as PrimitiveWedgeParams;
        onConfirm(params);
        break;
      case FeatureOperation.CHAMFER:
        params = { distance, edges: selectedEdges, selector: liveSelector } as ChamferParams;
        onConfirm(params);
        break;
      case FeatureOperation.SHELL:
        params = { thickness, faces: selectedFaces, selector: liveSelector } as ShellParams;
        onConfirm(params);
        break;
      case FeatureOperation.OFFSET:
        params = { distance, faces: selectedFaces } as OffsetParams;
        onConfirm(params);
        break;
      case FeatureOperation.SWEEP:
        if (!profileSketchId || !pathSketchId) return;
        params = { profileSketchId, pathSketchId } as SweepParams;
        // Pass the profile as the feature's primary sketch (parentIds/edit-resume).
        onConfirm(params, profileSketchId);
        break;
      case FeatureOperation.LOFT:
        if (loftSketchIds.length < 2) return;
        params = { sketchIds: loftSketchIds, ruled: loftRuled } as LoftParams;
        onConfirm(params, loftSketchIds[0]);
        break;
      case TransformOperation.MOVE:
        params = { 
          type: TransformOperation.MOVE, 
          translation: { x: translateX, y: translateY, z: translateZ } 
        } as TransformParams;
        onConfirm(params);
        break;
      case TransformOperation.ROTATE:
        params = {
          type: TransformOperation.ROTATE,
          rotation: {
            axis: { origin: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 } },
            angle: rotateAngle,
          },
        } as TransformParams;
        onConfirm(params);
        break;
      case TransformOperation.MIRROR: {
        const plane = project.referenceGeometry.find(r => r.id === selectedTreeItem && r.type === 'plane');
        if (!plane) return;
        
        let origin: Point3D = { x: 0, y: 0, z: 0 };
        let normal: Vector3D = { x: 0, y: 0, z: 1 };
        
        if (plane.id === 'front-plane') {
          normal = { x: 0, y: 0, z: 1 };
        } else if (plane.id === 'top-plane') {
          normal = { x: 0, y: 1, z: 0 };
        } else if (plane.id === 'right-plane') {
          normal = { x: 1, y: 0, z: 0 };
        }
        
        params = {
          type: TransformOperation.MIRROR,
          mirrorPlane: { origin, direction: normal },
        } as TransformParams;
        onConfirm(params);
        break;
      }
      case TransformOperation.SCALE:
        params = {
          type: TransformOperation.SCALE,
          scale: {
            factor: scaleFactor,
            center: { x: 0, y: 0, z: 0 },
          },
        } as TransformParams;
        onConfirm(params);
        break;
      case FeatureOperation.MEASURE:
        const entities: string[] = [];
        if (selectedFaceId !== null) entities.push(`face-${selectedFaceId}`);
        if (selectedEdgeIndex !== null) entities.push(`edge-${selectedEdgeIndex}`);
        if (selectedVertexIndex !== null) entities.push(`vertex-${selectedVertexIndex}`);
        params = {
          type: 'distance',
          entities,
        } as MeasureParams;
        onConfirm(params);
        break;
      // Add more cases as needed
      default:
        console.warn(`Confirm not implemented for ${operation}`);
        onCancel();
    }
  };

  // Resolve a selector rule (typed or preset) and merge the matches into the
  // manual edge/face selection — materialize-once (Phase A), so it behaves just
  // like clicking each matched sub-shape in the viewport.
  const applySelector = async (kind: SubShapeKind, selector: string) => {
    if (!onResolveSelector || !selector.trim()) return;
    set({ selectorStatus: 'loading' });
    try {
      const refs = await onResolveSelector(kind, selector);
      if (refs.length === 0) {
        set({ selectorStatus: 'no-match' });
        return;
      }
      const labels = refs.map(refLabel);
      dispatch({
        type: 'addToList',
        key: kind === SubShapeKind.Edge ? 'selectedEdges' : 'selectedFaces',
        values: labels,
      });
      set({ selectorStatus: 'matched', ...(keepSelectorLive ? { liveSelector: selector } : {}) });
    } catch {
      set({ selectorStatus: 'error' });
    }
  };

  // Selector-rule input + preset chips, shared by fillet/chamfer (edges) and
  // shell (faces). Typing a rule and pressing Enter (or a preset chip) fills
  // the manual selection below with the matched sub-shapes.
  const renderSelectorInput = (kind: SubShapeKind, presets: { label: string; selector: string }[]) => {
    if (!onResolveSelector) return null;
    return (
      <Stack gap={4}>
        <TextInput
          label="Select by rule"
          placeholder={kind === SubShapeKind.Edge ? 'e.g. |Z (all vertical edges)' : 'e.g. >Z (top face)'}
          value={selectorText}
          onChange={(e) => set({ selectorText: e.currentTarget.value, selectorStatus: 'idle' })}
          onKeyDown={(e) => { if (e.key === 'Enter') applySelector(kind, selectorText); }}
          size="sm"
        />
        <Checkbox
          size="xs"
          label="Keep this rule live (re-applies on every rebuild)"
          checked={keepSelectorLive}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            set({ keepSelectorLive: checked, liveSelector: checked ? selectorText || liveSelector : undefined });
          }}
        />
        <Group gap={4}>
          {presets.map((p) => (
            <Button
              key={p.selector}
              size="compact-xs"
              variant="light"
              onClick={() => { set({ selectorText: p.selector }); applySelector(kind, p.selector); }}
            >
              {p.label}
            </Button>
          ))}
        </Group>
        {selectorStatus === 'loading' && <Text size="xs" c="dimmed">Resolving…</Text>}
        {selectorStatus === 'matched' && <Text size="xs" c="green">Matched — added to selection below.</Text>}
        {selectorStatus === 'no-match' && <Text size="xs" c="yellow">No sub-shapes matched that rule.</Text>}
        {selectorStatus === 'error' && <Text size="xs" c="red">Couldn't resolve that rule.</Text>}
      </Stack>
    );
  };

  // Sync extrude preview to viewport store
  const setExtrudePreview = useViewportStore((state) => state.setExtrudePreview);
  useEffect(() => {
    if (sketchId && (operation === FeatureOperation.EXTRUDE_BOSS || operation === FeatureOperation.EXTRUDED_CUT)) {
      setExtrudePreview({
        sketchId,
        distance: distance || 0,
        direction,
      });
    } else {
      setExtrudePreview(null);
    }
    return () => setExtrudePreview(null);
  }, [sketchId, distance, direction, operation, setExtrudePreview]);

  const renderInputs = () => {
    const closedSketches = project.sketches.filter((s) => s.isClosed);

    switch (operation) {
      case FeatureOperation.EXTRUDE_BOSS:
      case FeatureOperation.EXTRUDED_CUT:
        return (
          <>
            {closedSketches.length === 0 ? (
              <Alert color="yellow" title="No closed sketches">
                Create a closed sketch first to perform this operation.
              </Alert>
            ) : (
              <>
                <Select
                  label="Sketch"
                  placeholder="Select a sketch"
                  value={sketchId}
                  onChange={(value) => set({ sketchId: value || '' })}
                  data={closedSketches.map((sketch) => ({
                    value: sketch.id,
                    label: sketch.name,
                  }))}
                  size="sm"
                />
                <NumberInput
                  label="Distance"
                  value={distance}
                  onChange={(val) => set({ distance: Number(val) })}
                  min={0.1}
                  step={1}
                  size="sm"
                />
                <Select
                  label="Direction"
                  value={direction}
                  onChange={(value) => set({ direction: value as 'normal' | 'reverse' })}
                  data={[
                    { value: 'normal', label: 'Normal' },
                    { value: 'reverse', label: 'Reverse' },
                  ]}
                  size="sm"
                />
              </>
            )}
          </>
        );

      case FeatureOperation.REVOLVED_BOSS:
      case FeatureOperation.REVOLVED_CUT:
        return (
          <>
            {closedSketches.length === 0 ? (
              <Alert color="yellow" title="No closed sketches">
                Create a closed sketch first to perform this operation.
              </Alert>
            ) : (
              <>
                <Select
                  label="Sketch"
                  placeholder="Select a sketch"
                  value={sketchId}
                  onChange={(value) => set({ sketchId: value || '' })}
                  data={closedSketches.map((sketch) => ({
                    value: sketch.id,
                    label: sketch.name,
                  }))}
                  size="sm"
                />
                <NumberInput
                  label="Angle"
                  value={angle}
                  onChange={(val) => set({ angle: Number(val) })}
                  min={0.1}
                  max={360}
                  step={1}
                  size="sm"
                />
              </>
            )}
          </>
        );

      case FeatureOperation.UNION:
      case FeatureOperation.INTERSECT:
        return (
          <>
            <MultiSelect
              label="Features"
              placeholder="Select features"
              value={selectedFeatures}
              onChange={(v) => set({ selectedFeatures: v })}
              data={project.features.map(f => ({ value: f.id, label: f.name }))}
              size="sm"
            />
            <Text size="xs" c="dimmed">Select features in the tree to combine them.</Text>
          </>
        );

      case FeatureOperation.SPHERE:
        return <NumberInput label="Radius" value={radius} onChange={(val) => set({ radius: Number(val) })} min={0.1} size="sm" />;

      case FeatureOperation.CYLINDER:
        return (
          <>
            <NumberInput label="Radius" value={radius} onChange={(val) => set({ radius: Number(val) })} min={0.1} size="sm" />
            <NumberInput label="Height" value={height} onChange={(val) => set({ height: Number(val) })} min={0.1} size="sm" />
          </>
        );

      case FeatureOperation.CONE:
        return (
          <>
            <NumberInput label="Base Radius" value={radius} onChange={(val) => set({ radius: Number(val) })} min={0.1} size="sm" />
            <NumberInput label="Top Radius" value={radius2} onChange={(val) => set({ radius2: Number(val) })} min={0} size="sm" />
            <NumberInput label="Height" value={height} onChange={(val) => set({ height: Number(val) })} min={0.1} size="sm" />
          </>
        );

      case FeatureOperation.TORUS:
        return (
          <>
            <NumberInput label="Major Radius" value={majorRadius} onChange={(val) => set({ majorRadius: Number(val) })} min={0.1} size="sm" />
            <NumberInput label="Minor Radius" value={minorRadius} onChange={(val) => set({ minorRadius: Number(val) })} min={0.1} size="sm" />
          </>
        );

      case FeatureOperation.WEDGE:
        return (
          <>
            <NumberInput label="Width" value={width} onChange={(val) => set({ width: Number(val) })} min={0.1} size="sm" />
            <NumberInput label="Height" value={height} onChange={(val) => set({ height: Number(val) })} min={0.1} size="sm" />
            <NumberInput label="Depth" value={depth} onChange={(val) => set({ depth: Number(val) })} min={0.1} size="sm" />
            <NumberInput label="Top X Length (LTX)" value={ltx} onChange={(val) => set({ ltx: Number(val) })} min={0} size="sm" />
          </>
        );

      case FeatureOperation.CHAMFER:
        return (
          <>
            <NumberInput label="Distance" value={distance} onChange={(val) => set({ distance: Number(val) })} min={0.1} size="sm" />
            {renderSelectorInput(SubShapeKind.Edge, EDGE_SELECTOR_PRESETS)}
            <MultiSelect
              label="Edges"
              placeholder="Select edges"
              value={selectedEdges}
              onChange={(v) => set({ selectedEdges: v })}
              data={selectedEdges.map(e => ({ value: e, label: e }))}
              size="sm"
              readOnly
            />
            <Text size="xs" c="dimmed">Click edges in the viewport to add them.</Text>
          </>
        );

      case FeatureOperation.SHELL:
        return (
          <>
            <NumberInput label="Thickness" value={thickness} onChange={(val) => set({ thickness: Number(val) })} min={0.1} size="sm" />
            {renderSelectorInput(SubShapeKind.Face, FACE_SELECTOR_PRESETS)}
            <MultiSelect
              label="Faces to Remove"
              placeholder="Select faces"
              value={selectedFaces}
              onChange={(v) => set({ selectedFaces: v })}
              data={selectedFaces.map(f => ({ value: f, label: f }))}
              size="sm"
              readOnly
            />
            <Text size="xs" c="dimmed">Click faces in the viewport to remove them.</Text>
          </>
        );

      case FeatureOperation.OFFSET:
        return (
          <>
            <NumberInput label="Distance" value={distance} onChange={(val) => set({ distance: Number(val) })} min={0.1} size="sm" />
            <Text size="xs" c="dimmed">Offset full body by given distance.</Text>
          </>
        );

      case FeatureOperation.SWEEP:
        return (
          <>
            {closedSketches.length === 0 ? (
              <Alert color="yellow" title="No closed sketches">
                Create a closed profile sketch and a path sketch first.
              </Alert>
            ) : (
              <>
                <Select
                  label="Profile (closed)"
                  placeholder="Select a profile sketch"
                  value={profileSketchId}
                  onChange={(value) => set({ profileSketchId: value || '' })}
                  data={closedSketches.map((s) => ({ value: s.id, label: s.name }))}
                  size="sm"
                />
                <Select
                  label="Path"
                  placeholder="Select a path sketch"
                  value={pathSketchId}
                  onChange={(value) => set({ pathSketchId: value || '' })}
                  data={project.sketches.flatMap((s) =>
                    s.id !== profileSketchId ? [{ value: s.id, label: s.name }] : []
                  )}
                  size="sm"
                />
                <Text size="xs" c="dimmed">Sweeps the profile along the path.</Text>
              </>
            )}
          </>
        );

      case FeatureOperation.LOFT:
        return (
          <>
            {closedSketches.length < 2 ? (
              <Alert color="yellow" title="Need two profiles">
                Create at least two closed sketches to loft between.
              </Alert>
            ) : (
              <>
                <MultiSelect
                  label="Profiles (in order)"
                  placeholder="Select 2+ profile sketches"
                  value={loftSketchIds}
                  onChange={(v) => set({ loftSketchIds: v })}
                  data={closedSketches.map((s) => ({ value: s.id, label: s.name }))}
                  size="sm"
                />
                <Checkbox
                  size="xs"
                  label="Ruled (straight transitions)"
                  checked={loftRuled}
                  onChange={(e) => set({ loftRuled: e.currentTarget.checked })}
                />
                <Text size="xs" c="dimmed">Lofts a solid through the profiles in the selected order.</Text>
              </>
            )}
          </>
        );

      case TransformOperation.MOVE:
        return (
          <>
            <NumberInput label="X" value={translateX} onChange={(val) => set({ translateX: Number(val) })} size="sm" />
            <NumberInput label="Y" value={translateY} onChange={(val) => set({ translateY: Number(val) })} size="sm" />
            <NumberInput label="Z" value={translateZ} onChange={(val) => set({ translateZ: Number(val) })} size="sm" />
          </>
        );

      case TransformOperation.ROTATE:
        return <NumberInput label="Angle" value={rotateAngle} onChange={(val) => set({ rotateAngle: Number(val) })} size="sm" />;

      case TransformOperation.MIRROR:
        return (
          <Stack gap="xs">
            <Text size="sm">Mirror Plane:</Text>
            {selectedTreeItem && project.referenceGeometry.find(r => r.id === selectedTreeItem && r.type === 'plane') ? (
              <Text size="xs">Using {project.referenceGeometry.find(r => r.id === selectedTreeItem)?.name}</Text>
            ) : (
              <Text size="xs" c="dimmed">Select a plane in the tree to use as mirror plane.</Text>
            )}
          </Stack>
        );

      case TransformOperation.SCALE:
        return <NumberInput label="Factor" value={scaleFactor} onChange={(val) => set({ scaleFactor: Number(val) })} min={0.01} step={0.1} size="sm" />;

      case FeatureOperation.MEASURE:
        return (
          <Stack gap="xs">
            <Text size="sm">Selected entities for measurement:</Text>
            <Group gap="xs">
              {selectedFaceId !== null && <Text size="xs">Face {selectedFaceId + 1}</Text>}
              {selectedEdgeIndex !== null && <Text size="xs">Edge {selectedEdgeIndex + 1}</Text>}
              {selectedVertexIndex !== null && <Text size="xs">Vertex {selectedVertexIndex + 1}</Text>}
            </Group>
            {selectedFaceId === null && selectedEdgeIndex === null && selectedVertexIndex === null && (
              <Text size="xs" c="dimmed">Select entities in the viewport to measure.</Text>
            )}
          </Stack>
        );

      default:
        return <Text size="sm">Operation parameters for {operation} not yet implemented.</Text>;
    }
  };

  const isValid = useMemo(() => {
    switch (operation) {
      case FeatureOperation.EXTRUDE_BOSS:
      case FeatureOperation.EXTRUDED_CUT:
      case FeatureOperation.REVOLVED_BOSS:
      case FeatureOperation.REVOLVED_CUT:
        return !!sketchId;
      case FeatureOperation.UNION:
      case FeatureOperation.INTERSECT:
        return selectedFeatures.length > 0;
      case FeatureOperation.CHAMFER:
        return selectedEdges.length > 0;
      case FeatureOperation.SHELL:
        return selectedFaces.length > 0;
      case FeatureOperation.SWEEP:
        return !!profileSketchId && !!pathSketchId;
      case FeatureOperation.LOFT:
        return loftSketchIds.length >= 2;
      case FeatureOperation.SPHERE:
      case FeatureOperation.CYLINDER:
      case FeatureOperation.CONE:
      case FeatureOperation.TORUS:
      case FeatureOperation.WEDGE:
      case FeatureOperation.OFFSET:
      case TransformOperation.MOVE:
      case TransformOperation.ROTATE:
        return true;
      case TransformOperation.MIRROR:
        return !!selectedTreeItem && !!project.referenceGeometry.find(r => r.id === selectedTreeItem && r.type === 'plane');
      case TransformOperation.SCALE:
      case FeatureOperation.MEASURE:
        return true; // Primitives and transforms usually have defaults
      default:
        return false;
    }
  }, [operation, sketchId, selectedEdges, selectedFaces, selectedFeatures, selectedTreeItem, project.referenceGeometry, profileSketchId, pathSketchId, loftSketchIds]);

  const canApply = RegisteredPanel ? registeredValid : isValid;
  const handleApply = RegisteredPanel ? () => registeredPanelRef.current?.submit() : handleConfirm;

  return (
    <Stack gap={0} style={{ backgroundColor: theme.other.colors.background }}>
      {/* Header */}
      <Box
        px={16}
        py={12}
        style={{
          borderBottom: `1px solid ${theme.other.colors.sidebarBorder}`,
          backgroundColor: `${theme.colors.blue[5]}15`,
        }}
      >
        <Group justify="space-between" align="center" wrap="nowrap">
          <Title order={6} style={{ color: theme.other.colors.foreground, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {title}
          </Title>
          <Group gap={4}>
            <ActionIcon variant="subtle" color="gray" onClick={onCancel}>
              <X size={16} />
            </ActionIcon>
            <ActionIcon variant="filled" color="blue" onClick={handleApply} disabled={!canApply}>
              <Check size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Content */}
      <Box p={16} style={{ overflowY: 'auto' }}>
        <Stack gap="md">
          {RegisteredPanel ? (
            <RegisteredPanel
              ref={registeredPanelRef}
              project={project}
              ctx={{ selectedFaceId, selectedEdgeIndex, selectedVertexIndex, selectedTreeItem }}
              initialParams={initialParams}
              initialSketchId={initialSketchId}
              onResolveSelector={onResolveSelector}
              onConfirm={onConfirm}
              onValidChange={setRegisteredValid}
            />
          ) : (
            renderInputs()
          )}
        </Stack>
      </Box>

      {/* Footer Buttons */}
      <Box p={16} style={{ borderTop: `1px solid ${theme.other.colors.sidebarBorder}` }}>
        <Group grow>
          <Button variant="subtle" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={!canApply}>
            Apply
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}
