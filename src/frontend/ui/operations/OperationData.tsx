import {
  ArrowLineUp,
  ArrowCounterClockwise,
  Scissors,
  DotOutline,
  ArrowElbowDownRight,
  Minus,
  Square,
  Circle,
  Hexagon,
  ArrowRight,
  Ruler,
  Cube,
  Globe,
  Cylinder,
  Triangle,
  Target,
  Wind,
  Stack,
  GitMerge,
  Copy,
  DotsThree,
  WaveSine,
  ArrowsOutCardinal,
  ArrowClockwise,
  FlipHorizontal,
  ArrowsOut,
  UploadSimple,
  DownloadSimple,
  FileCode,
  Package,
  Unite,
  LineSegment,
  LineSegments,
  Rectangle,
  Selection,
  BoundingBox,
  Parallelogram,
  CircleDashed,
  ArrowArcLeft,
  ArrowArcRight
} from '@phosphor-icons/react';
import { FeatureOperation, SketchOperation, EvaluateOperation, TransformOperation, IOOperation, Operation } from '@/cad/types';

export interface OperationGroup {
  id: string;
  options: { id: Operation; icon: React.ReactNode; label: string; disabled?: boolean }[];
  /** Option shown by default. Falls back to the first option when omitted. */
  defaultOptionId?: Operation;
}

export const featureOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.EXTRUDE_BOSS, icon: <ArrowLineUp size={16} weight="regular" />, label: 'Extrude Boss' },
  { id: FeatureOperation.REVOLVED_BOSS, icon: <ArrowCounterClockwise size={16} weight="regular" />, label: 'Revolve Boss' },
];

export const cutOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.EXTRUDED_CUT, icon: <Scissors size={16} weight="regular" />, label: 'Extrude Cut' },
  { id: FeatureOperation.REVOLVED_CUT, icon: <DotOutline size={16} weight="regular" />, label: 'Revolve Cut' },
];

export const modifyOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.FILLET, icon: <ArrowElbowDownRight size={16} weight="regular" />, label: 'Fillet' },
  { id: FeatureOperation.CHAMFER, icon: <Minus size={16} weight="regular" style={{ transform: 'rotate(45deg)' }} />, label: 'Chamfer' },
  { id: FeatureOperation.SHELL, icon: <Stack size={16} weight="regular" />, label: 'Shell' },
  { id: FeatureOperation.OFFSET, icon: <Copy size={16} weight="regular" />, label: 'Offset' },
];

export const primitiveOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.BOX, icon: <Cube size={16} weight="regular" />, label: 'Box' },
  { id: FeatureOperation.SPHERE, icon: <Globe size={16} weight="regular" />, label: 'Sphere' },
  { id: FeatureOperation.CYLINDER, icon: <Cylinder size={16} weight="regular" />, label: 'Cylinder' },
  { id: FeatureOperation.CONE, icon: <Triangle size={16} weight="regular" />, label: 'Cone' },
  { id: FeatureOperation.TORUS, icon: <Target size={16} weight="regular" />, label: 'Torus' },
  { id: FeatureOperation.WEDGE, icon: <Triangle size={16} weight="regular" style={{ transform: 'rotate(180deg)' }} />, label: 'Wedge' },
];

export const otherOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.SWEEP, icon: <Wind size={16} weight="regular" />, label: 'Sweep' },
  { id: FeatureOperation.LOFT, icon: <Stack size={16} weight="regular" />, label: 'Loft' },
];

export const booleanOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.UNION, icon: <GitMerge size={16} weight="regular" />, label: 'Union' },
  { id: FeatureOperation.INTERSECT, icon: <Unite size={16} weight="regular" />, label: 'Intersect' },
];

// The Line button is a group: the dropdown offers Line / Centerline / Midpoint Line.
export const lineGroup: OperationGroup = {
  id: 'line-group',
  options: [
    { id: SketchOperation.LINE, icon: <Minus size={16} weight="regular" />, label: 'Line' },
    { id: SketchOperation.CENTERLINE, icon: <LineSegments size={16} weight="regular" />, label: 'Centerline' },
    { id: SketchOperation.MIDPOINT_LINE, icon: <LineSegment size={16} weight="regular" />, label: 'Midpoint Line' },
  ],
};

// The Rectangle button is a group offering corner/center/3-point/parallelogram variants.
// Rotated and skewed variants are emitted as 4-point polygons (see sketchShapeBuilders).
export const rectangleGroup: OperationGroup = {
  id: 'rectangle-group',
  options: [
    { id: SketchOperation.RECTANGLE, icon: <Square size={16} weight="regular" />, label: 'Corner Rectangle' },
    { id: SketchOperation.CENTER_RECTANGLE, icon: <Selection size={16} weight="regular" />, label: 'Center Rectangle' },
    { id: SketchOperation.THREE_POINT_CORNER_RECTANGLE, icon: <Rectangle size={16} weight="regular" />, label: '3 Point Corner Rectangle' },
    { id: SketchOperation.THREE_POINT_CENTER_RECTANGLE, icon: <BoundingBox size={16} weight="regular" />, label: '3 Point Center Rectangle' },
    { id: SketchOperation.PARALLELOGRAM, icon: <Parallelogram size={16} weight="regular" />, label: 'Parallelogram' },
  ],
};

// The Circle button is a group: Circle (center+radius) and Perimeter Circle (3-point).
export const circleGroup: OperationGroup = {
  id: 'circle-group',
  options: [
    { id: SketchOperation.CIRCLE, icon: <Circle size={16} weight="regular" />, label: 'Circle' },
    { id: SketchOperation.PERIMETER_CIRCLE, icon: <CircleDashed size={16} weight="regular" />, label: 'Perimeter Circle' },
  ],
};

// The Arc button is a group offering the three arc tools: Centerpoint (center→start→end),
// Tangent (continues tangent to the previous entity), and 3 Point (start→end→through).
export const arcGroup: OperationGroup = {
  id: 'arc-group',
  defaultOptionId: SketchOperation.ARC,
  options: [
    { id: SketchOperation.CENTERPOINT_ARC, icon: <ArrowArcRight size={16} weight="regular" />, label: 'Centerpoint Arc' },
    { id: SketchOperation.TANGENT_ARC, icon: <ArrowArcLeft size={16} weight="regular" />, label: 'Tangent Arc' },
    { id: SketchOperation.ARC, icon: <ArrowRight size={16} weight="regular" />, label: '3 Point Arc' },
  ],
};

export const sketchOperations: { id: SketchOperation; icon: React.ReactNode; label: string }[] = [
  { id: SketchOperation.LINE, icon: <Minus size={16} weight="regular" />, label: 'Line' },
  { id: SketchOperation.RECTANGLE, icon: <Square size={16} weight="regular" />, label: 'Corner Rectangle' },
  { id: SketchOperation.CIRCLE, icon: <Circle size={16} weight="regular" />, label: 'Circle' },
  { id: SketchOperation.POLYGON, icon: <Hexagon size={16} weight="regular" />, label: 'Polygon' },
  { id: SketchOperation.ARC, icon: <ArrowRight size={16} weight="regular" />, label: '3 Point Arc' },
  { id: SketchOperation.ELLIPSE, icon: <DotsThree size={16} weight="regular" style={{ transform: 'rotate(90deg)' }} />, label: 'Ellipse' },
  { id: SketchOperation.BEZIER, icon: <WaveSine size={16} weight="regular" />, label: 'Bezier' },
];

export const evaluateOperations: { id: EvaluateOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'measure', icon: <Ruler size={16} weight="regular" />, label: 'Measure' },
];

export const transformOperations: { id: TransformOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'move', icon: <ArrowsOutCardinal size={16} weight="regular" />, label: 'Move' },
  { id: 'rotate', icon: <ArrowClockwise size={16} weight="regular" />, label: 'Rotate' },
  { id: 'mirror', icon: <FlipHorizontal size={16} weight="regular" />, label: 'Mirror' },
  { id: 'scale', icon: <ArrowsOut size={16} weight="regular" />, label: 'Scale' },
];

export const ioOperations: { id: IOOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'import-step', icon: <UploadSimple size={16} weight="regular" />, label: 'Import STEP' },
  { id: 'import-iges', icon: <UploadSimple size={16} weight="regular" />, label: 'Import IGES' },
  { id: 'export-step', icon: <DownloadSimple size={16} weight="regular" />, label: 'Export STEP' },
  { id: 'export-iges', icon: <DownloadSimple size={16} weight="regular" />, label: 'Export IGES' },
  { id: 'export-stl', icon: <Package size={16} weight="regular" />, label: 'Export STL' },
  { id: 'export-gltf', icon: <FileCode size={16} weight="regular" />, label: 'Export GLTF' },
];

// Operations that are not yet implemented (disabled in UI)
export const disabledOperations: Operation[] = [
  // 3D Operations - not yet implemented
  'sweep', 'loft',
  // I/O - not yet implemented
  'import-step', 'import-iges', 'export-step', 'export-iges', 'export-stl', 'export-gltf',
];
