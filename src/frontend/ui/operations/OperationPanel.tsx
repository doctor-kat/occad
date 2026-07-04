import { useState, useEffect, useMemo } from 'react';
import { Button, TextInput, Select, Stack, Group, Text, Alert, Box, useMantineTheme, ActionIcon, Title, NumberInput, Checkbox, MultiSelect } from '@mantine/core';
import { X, Check } from '@phosphor-icons/react';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';
import type {
  Sketch,
  ExtrudeParams,
  RevolveParams,
  PrimitiveBoxParams,
  PrimitiveSphereParams,
  PrimitiveCylinderParams,
  PrimitiveConeParams,
  PrimitiveTorusParams,
  PrimitiveWedgeParams,
  FilletParams,
  ChamferParams,
  ShellParams,
  OffsetParams,
  TransformParams,
  OperationParams,
  SketchPlane,
  Vector3D,
  Point3D,
  CADProject,
  StableRef,
  SubShapeKind,
} from '@/cad/types';
import { PlaneType, FeatureOperation, TransformOperation, SketchOperation, refLabel } from '@/cad/types';

/** Common presets for the selector-rule input — discoverable without learning the DSL. */
const EDGE_SELECTOR_PRESETS = [
  { label: 'All vertical edges', selector: '|Z' },
  { label: 'Top edges', selector: '>Z' },
  { label: 'Bottom edges', selector: '<Z' },
];
const FACE_SELECTOR_PRESETS = [
  { label: 'Top face', selector: '>Z' },
  { label: 'Bottom face', selector: '<Z' },
  { label: 'Side faces', selector: '#Z' },
];

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

  // --- Common State ---
  const [sketchId, setSketchId] = useState<string>('');
  const [isCut, setIsCut] = useState(false);

  // --- Extrude/Revolve State ---
  const [distance, setDistance] = useState<number>(10);
  const [angle, setAngle] = useState<number>(360);
  const [direction, setDirection] = useState<'normal' | 'reverse'>('normal');

  // --- Primitive State ---
  const [width, setWidth] = useState<number>(50);
  const [height, setHeight] = useState<number>(50);
  const [depth, setDepth] = useState<number>(50);
  const [radius, setRadius] = useState<number>(25);
  const [radius2, setRadius2] = useState<number>(0);
  const [majorRadius, setMajorRadius] = useState<number>(40);
  const [minorRadius, setMinorRadius] = useState<number>(10);
  const [ltx, setLtx] = useState<number>(25);

  // --- Modification State ---
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [thickness, setThickness] = useState<number>(2);

  // --- Selector-rule state (ROADMAP §9.1 Phase 3/4) ---
  const [selectorText, setSelectorText] = useState('');
  const [selectorStatus, setSelectorStatus] = useState<'idle' | 'loading' | 'matched' | 'no-match' | 'error'>('idle');
  // Phase 4: when checked, the last-applied rule is persisted on the feature and
  // re-evaluated live every rebuild (instead of just materializing matches once
  // into the manual edge/face list above).
  const [keepSelectorLive, setKeepSelectorLive] = useState(false);
  const [liveSelector, setLiveSelector] = useState<string | undefined>(undefined);

  // --- Transform State ---
  const [translateX, setTranslateX] = useState<number>(0);
  const [translateY, setTranslateY] = useState<number>(0);
  const [translateZ, setTranslateZ] = useState<number>(0);
  const [rotateAngle, setTranslateAngle] = useState<number>(0);
  const [scaleFactor, setScaleFactor] = useState<number>(1);

  // Initialize state based on operation and initialParams
  useEffect(() => {
    // Determine if it's a cut operation
    const isCutOp = operation === FeatureOperation.EXTRUDED_CUT || operation === FeatureOperation.REVOLVED_CUT;
    setIsCut(isCutOp);

    if (initialSketchId) {
      setSketchId(initialSketchId);
    } else if (!sketchId) {
      // If no sketchId set yet, try to find a valid one based on selection or defaults
      const selectedSketch = project.sketches.find(s => s.id === selectedTreeItem);
      if (selectedSketch) {
        setSketchId(selectedSketch.id);
      } else {
        const closedSketches = project.sketches.filter(s => s.isClosed);
        if (closedSketches.length > 0) {
          setSketchId(closedSketches[0].id);
        }
      }
    }

    if (initialParams) {
      // TODO: Populate all states from initialParams
      if ('distance' in initialParams) {
        setDistance(Math.abs(initialParams.distance));
        setDirection(initialParams.distance >= 0 ? 'normal' : 'reverse');
      }
      if ('angle' in initialParams) setAngle(initialParams.angle);
      if ('width' in initialParams) setWidth(initialParams.width);
      if ('height' in initialParams) setHeight(initialParams.height);
      if ('depth' in initialParams) setDepth(initialParams.depth);
      if ('radius' in initialParams) setRadius(initialParams.radius);
      if ('radius1' in initialParams) setRadius(initialParams.radius1);
      if ('radius2' in initialParams) setRadius2(initialParams.radius2);
      if ('majorRadius' in initialParams) setMajorRadius(initialParams.majorRadius);
      if ('minorRadius' in initialParams) setMinorRadius(initialParams.minorRadius);
      if ('ltx' in initialParams) setLtx(initialParams.ltx);
      // Params may carry fingerprinted StableRefs; show their `edge-N`/`face-N`
      // label. (The worker re-captures fingerprints on the next rebuild, so
      // editing a modification this way doesn't permanently lose them.)
      if ('edges' in initialParams) setSelectedEdges(initialParams.edges.map(refLabel));
      if ('faces' in initialParams) setSelectedFaces(initialParams.faces.map(refLabel));
      if ('selector' in initialParams && initialParams.selector) {
        setLiveSelector(initialParams.selector);
        setKeepSelectorLive(true);
        setSelectorText(initialParams.selector);
      }
      if ('featureIds' in (initialParams as any)) setSelectedFeatures((initialParams as any).featureIds);
      if ('thickness' in initialParams) setThickness(initialParams.thickness);
    } else {
      // Default initializations for some ops based on selection
      if (operation === FeatureOperation.FILLET || operation === FeatureOperation.CHAMFER) {
        if (selectedEdgeIndex !== null) {
          setSelectedEdges([`edge-${selectedEdgeIndex}`]);
        }
      } else if (operation === FeatureOperation.SHELL) {
        if (selectedFaceId !== null) {
          setSelectedFaces([`face-${selectedFaceId}`]);
        }
      } else if (operation === FeatureOperation.UNION || operation === FeatureOperation.INTERSECT) {
        if (selectedTreeItem && project.features.some(f => f.id === selectedTreeItem)) {
          setSelectedFeatures([selectedTreeItem]);
        }
      }
    }
  }, [operation, initialParams, selectedEdgeIndex, selectedFaceId, initialSketchId, project.sketches, project.features, selectedTreeItem]);

  // Append new selections from viewport while panel is open
  useEffect(() => {
    if (operation === FeatureOperation.FILLET || operation === FeatureOperation.CHAMFER) {
      if (selectedEdgeIndex !== null) {
        const edgeRef = `edge-${selectedEdgeIndex}`;
        setSelectedEdges(prev => prev.includes(edgeRef) ? prev : [...prev, edgeRef]);
      }
    } else if (operation === FeatureOperation.SHELL || operation === FeatureOperation.OFFSET) {
      if (selectedFaceId !== null) {
        const faceRef = `face-${selectedFaceId}`;
        setSelectedFaces(prev => prev.includes(faceRef) ? prev : [...prev, faceRef]);
      }
    } else if (operation === FeatureOperation.UNION || operation === FeatureOperation.INTERSECT) {
      if (selectedTreeItem && project.features.some(f => f.id === selectedTreeItem)) {
        setSelectedFeatures(prev => prev.includes(selectedTreeItem) ? prev : [...prev, selectedTreeItem]);
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
          setSketchId(closedSketches[0].id);
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
          type: operation === FeatureOperation.UNION ? 'union' : 'intersect', 
          featureIds: selectedFeatures 
        } as any;
        onConfirm(params);
        break;
      case FeatureOperation.BOX:
        params = { width, height, depth, center: { x: 0, y: 0, z: 0 } } as PrimitiveBoxParams;
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
      case FeatureOperation.FILLET:
        params = { radius, edges: selectedEdges, selector: liveSelector } as FilletParams;
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
    setSelectorStatus('loading');
    try {
      const refs = await onResolveSelector(kind, selector);
      if (refs.length === 0) {
        setSelectorStatus('no-match');
        return;
      }
      const labels = refs.map(refLabel);
      const merge = (prev: string[]) => Array.from(new Set([...prev, ...labels]));
      if (kind === 'edge') setSelectedEdges(merge);
      else setSelectedFaces(merge);
      setSelectorStatus('matched');
      if (keepSelectorLive) setLiveSelector(selector);
    } catch {
      setSelectorStatus('error');
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
          placeholder={kind === 'edge' ? 'e.g. |Z (all vertical edges)' : 'e.g. >Z (top face)'}
          value={selectorText}
          onChange={(e) => { setSelectorText(e.currentTarget.value); setSelectorStatus('idle'); }}
          onKeyDown={(e) => { if (e.key === 'Enter') applySelector(kind, selectorText); }}
          size="sm"
        />
        <Checkbox
          size="xs"
          label="Keep this rule live (re-applies on every rebuild)"
          checked={keepSelectorLive}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setKeepSelectorLive(checked);
            setLiveSelector(checked ? selectorText || liveSelector : undefined);
          }}
        />
        <Group gap={4}>
          {presets.map((p) => (
            <Button
              key={p.selector}
              size="compact-xs"
              variant="light"
              onClick={() => { setSelectorText(p.selector); applySelector(kind, p.selector); }}
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
                  onChange={(value) => setSketchId(value || '')}
                  data={closedSketches.map((sketch) => ({
                    value: sketch.id,
                    label: sketch.name,
                  }))}
                  size="sm"
                />
                <NumberInput
                  label="Distance"
                  value={distance}
                  onChange={(val) => setDistance(Number(val))}
                  min={0.1}
                  step={1}
                  size="sm"
                />
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
                  onChange={(value) => setSketchId(value || '')}
                  data={closedSketches.map((sketch) => ({
                    value: sketch.id,
                    label: sketch.name,
                  }))}
                  size="sm"
                />
                <NumberInput
                  label="Angle"
                  value={angle}
                  onChange={(val) => setAngle(Number(val))}
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
              onChange={setSelectedFeatures}
              data={project.features.map(f => ({ value: f.id, label: f.name }))}
              size="sm"
            />
            <Text size="xs" c="dimmed">Select features in the tree to combine them.</Text>
          </>
        );

      case FeatureOperation.BOX:
        return (
          <>
            <NumberInput label="Width" value={width} onChange={(val) => setWidth(Number(val))} min={0.1} size="sm" />
            <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
            <NumberInput label="Depth" value={depth} onChange={(val) => setDepth(Number(val))} min={0.1} size="sm" />
          </>
        );

      case FeatureOperation.SPHERE:
        return <NumberInput label="Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />;

      case FeatureOperation.CYLINDER:
        return (
          <>
            <NumberInput label="Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />
            <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
          </>
        );

      case FeatureOperation.CONE:
        return (
          <>
            <NumberInput label="Base Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />
            <NumberInput label="Top Radius" value={radius2} onChange={(val) => setRadius2(Number(val))} min={0} size="sm" />
            <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
          </>
        );

      case FeatureOperation.TORUS:
        return (
          <>
            <NumberInput label="Major Radius" value={majorRadius} onChange={(val) => setMajorRadius(Number(val))} min={0.1} size="sm" />
            <NumberInput label="Minor Radius" value={minorRadius} onChange={(val) => setMinorRadius(Number(val))} min={0.1} size="sm" />
          </>
        );

      case FeatureOperation.WEDGE:
        return (
          <>
            <NumberInput label="Width" value={width} onChange={(val) => setWidth(Number(val))} min={0.1} size="sm" />
            <NumberInput label="Height" value={height} onChange={(val) => setHeight(Number(val))} min={0.1} size="sm" />
            <NumberInput label="Depth" value={depth} onChange={(val) => setDepth(Number(val))} min={0.1} size="sm" />
            <NumberInput label="Top X Length (LTX)" value={ltx} onChange={(val) => setLtx(Number(val))} min={0} size="sm" />
          </>
        );

      case FeatureOperation.FILLET:
        return (
          <>
            <NumberInput label="Radius" value={radius} onChange={(val) => setRadius(Number(val))} min={0.1} size="sm" />
            {renderSelectorInput('edge', EDGE_SELECTOR_PRESETS)}
            <MultiSelect
              label="Edges"
              placeholder="Select edges"
              value={selectedEdges}
              onChange={setSelectedEdges}
              data={selectedEdges.map(e => ({ value: e, label: e }))}
              size="sm"
              readOnly
            />
            <Text size="xs" c="dimmed">Click edges in the viewport to add them.</Text>
          </>
        );

      case FeatureOperation.CHAMFER:
        return (
          <>
            <NumberInput label="Distance" value={distance} onChange={(val) => setDistance(Number(val))} min={0.1} size="sm" />
            {renderSelectorInput('edge', EDGE_SELECTOR_PRESETS)}
            <MultiSelect
              label="Edges"
              placeholder="Select edges"
              value={selectedEdges}
              onChange={setSelectedEdges}
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
            <NumberInput label="Thickness" value={thickness} onChange={(val) => setThickness(Number(val))} min={0.1} size="sm" />
            {renderSelectorInput('face', FACE_SELECTOR_PRESETS)}
            <MultiSelect
              label="Faces to Remove"
              placeholder="Select faces"
              value={selectedFaces}
              onChange={setSelectedFaces}
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
            <NumberInput label="Distance" value={distance} onChange={(val) => setDistance(Number(val))} min={0.1} size="sm" />
            <Text size="xs" c="dimmed">Offset full body by given distance.</Text>
          </>
        );

      case TransformOperation.MOVE:
        return (
          <>
            <NumberInput label="X" value={translateX} onChange={(val) => setTranslateX(Number(val))} size="sm" />
            <NumberInput label="Y" value={translateY} onChange={(val) => setTranslateY(Number(val))} size="sm" />
            <NumberInput label="Z" value={translateZ} onChange={(val) => setTranslateZ(Number(val))} size="sm" />
          </>
        );

      case TransformOperation.ROTATE:
        return <NumberInput label="Angle" value={rotateAngle} onChange={(val) => setTranslateAngle(Number(val))} size="sm" />;

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
        return <NumberInput label="Factor" value={scaleFactor} onChange={(val) => setScaleFactor(Number(val))} min={0.01} step={0.1} size="sm" />;

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
      case FeatureOperation.FILLET:
      case FeatureOperation.CHAMFER:
        return selectedEdges.length > 0;
      case FeatureOperation.SHELL:
        return selectedFaces.length > 0;
      case FeatureOperation.BOX:
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
  }, [operation, sketchId, selectedEdges, selectedFaces, selectedFeatures, selectedTreeItem, project.referenceGeometry]);

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
            <ActionIcon variant="filled" color="blue" onClick={handleConfirm} disabled={!isValid}>
              <Check size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Content */}
      <Box p={16} style={{ overflowY: 'auto' }}>
        <Stack gap="md">
          {renderInputs()}
        </Stack>
      </Box>

      {/* Footer Buttons */}
      <Box p={16} style={{ borderTop: `1px solid ${theme.other.colors.sidebarBorder}` }}>
        <Group grow>
          <Button variant="subtle" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!isValid}>
            Apply
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}
