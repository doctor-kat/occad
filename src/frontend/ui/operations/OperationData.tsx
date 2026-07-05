import {
  // Sketch entities
  LineIcon,
  CenterlineIcon,
  MidpointLineIcon,
  RectangleIcon,
  CenterRectangleIcon,
  Icon3PtCornerRectIcon,
  Icon3PtCenterRectIcon,
  ParallelogramIcon,
  CircleIcon,
  PerimeterCircleIcon,
  CenterpointArcIcon,
  TangentArcIcon,
  Icon3PointArcIcon,
  PointIcon,
  PolygonIcon,
  EllipseIcon,
  BezierIcon,
  // Features
  ExtrudeBossIcon,
  ExtrudeCutIcon,
  RevolveIcon,
  RevolveCutIcon,
  FilletIcon,
  ChamferIcon,
  ShellIcon,
  OffsetIcon,
  SweepIcon,
  LoftIcon,
  UnionIcon,
  IntersectIcon,
  // Primitives
  BoxIcon,
  SphereIcon,
  CylinderIcon,
  ConeIcon,
  TorusIcon,
  WedgeIcon,
  // Transform / evaluate / IO
  MoveIcon,
  Rotate2Icon,
  MirrorIcon,
  ScaleIcon,
  MeasureIcon,
  ImportSTEPIcon,
  ImportIGESIcon,
  ExportSTEPIcon,
  ExportIGESIcon,
  ExportSTLIcon,
  ExportGLTFIcon,
} from '@/frontend/shared/icons';
import { FeatureOperation, SketchOperation, EvaluateOperation, TransformOperation, IOOperation, Operation } from '@/cad/types';

export interface OperationGroup {
  id: string;
  options: { id: Operation; icon: React.ReactNode; label: string; disabled?: boolean }[];
  /** Option shown by default. Falls back to the first option when omitted. */
  defaultOptionId?: Operation;
}

export const featureOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.EXTRUDE_BOSS, icon: <ExtrudeBossIcon size={16} />, label: 'Extrude Boss' },
  { id: FeatureOperation.REVOLVED_BOSS, icon: <RevolveIcon size={16} />, label: 'Revolve Boss' },
];

export const cutOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.EXTRUDED_CUT, icon: <ExtrudeCutIcon size={16} />, label: 'Extrude Cut' },
  { id: FeatureOperation.REVOLVED_CUT, icon: <RevolveCutIcon size={16} />, label: 'Revolve Cut' },
];

export const modifyOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.FILLET, icon: <FilletIcon size={16} />, label: 'Fillet' },
  { id: FeatureOperation.CHAMFER, icon: <ChamferIcon size={16} />, label: 'Chamfer' },
  { id: FeatureOperation.SHELL, icon: <ShellIcon size={16} />, label: 'Shell' },
  { id: FeatureOperation.OFFSET, icon: <OffsetIcon size={16} />, label: 'Offset' },
];

export const primitiveOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.BOX, icon: <BoxIcon size={16} />, label: 'Box' },
  { id: FeatureOperation.SPHERE, icon: <SphereIcon size={16} />, label: 'Sphere' },
  { id: FeatureOperation.CYLINDER, icon: <CylinderIcon size={16} />, label: 'Cylinder' },
  { id: FeatureOperation.CONE, icon: <ConeIcon size={16} />, label: 'Cone' },
  { id: FeatureOperation.TORUS, icon: <TorusIcon size={16} />, label: 'Torus' },
  { id: FeatureOperation.WEDGE, icon: <WedgeIcon size={16} />, label: 'Wedge' },
];

export const otherOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.SWEEP, icon: <SweepIcon size={16} />, label: 'Sweep' },
  { id: FeatureOperation.LOFT, icon: <LoftIcon size={16} />, label: 'Loft' },
];

export const booleanOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.UNION, icon: <UnionIcon size={16} />, label: 'Union' },
  { id: FeatureOperation.INTERSECT, icon: <IntersectIcon size={16} />, label: 'Intersect' },
];

// The Line button is a group: the dropdown offers Line / Centerline / Midpoint Line.
export const lineGroup: OperationGroup = {
  id: 'line-group',
  options: [
    { id: SketchOperation.LINE, icon: <LineIcon size={16} />, label: 'Line' },
    { id: SketchOperation.CENTERLINE, icon: <CenterlineIcon size={16} />, label: 'Centerline' },
    { id: SketchOperation.MIDPOINT_LINE, icon: <MidpointLineIcon size={16} />, label: 'Midpoint Line' },
  ],
};

// The Rectangle button is a group offering corner/center/3-point/parallelogram variants.
// Rotated and skewed variants are emitted as 4-point polygons (see sketchShapeBuilders).
export const rectangleGroup: OperationGroup = {
  id: 'rectangle-group',
  options: [
    { id: SketchOperation.RECTANGLE, icon: <RectangleIcon size={16} />, label: 'Corner Rectangle' },
    { id: SketchOperation.CENTER_RECTANGLE, icon: <CenterRectangleIcon size={16} />, label: 'Center Rectangle' },
    { id: SketchOperation.THREE_POINT_CORNER_RECTANGLE, icon: <Icon3PtCornerRectIcon size={16} />, label: '3 Point Corner Rectangle' },
    { id: SketchOperation.THREE_POINT_CENTER_RECTANGLE, icon: <Icon3PtCenterRectIcon size={16} />, label: '3 Point Center Rectangle' },
    { id: SketchOperation.PARALLELOGRAM, icon: <ParallelogramIcon size={16} />, label: 'Parallelogram' },
  ],
};

// The Circle button is a group: Circle (center+radius) and Perimeter Circle (3-point).
export const circleGroup: OperationGroup = {
  id: 'circle-group',
  options: [
    { id: SketchOperation.CIRCLE, icon: <CircleIcon size={16} />, label: 'Circle' },
    { id: SketchOperation.PERIMETER_CIRCLE, icon: <PerimeterCircleIcon size={16} />, label: 'Perimeter Circle' },
  ],
};

// The Arc button is a group offering the three arc tools: Centerpoint (center→start→end),
// Tangent (continues tangent to the previous entity), and 3 Point (start→end→through).
export const arcGroup: OperationGroup = {
  id: 'arc-group',
  defaultOptionId: SketchOperation.ARC,
  options: [
    { id: SketchOperation.CENTERPOINT_ARC, icon: <CenterpointArcIcon size={16} />, label: 'Centerpoint Arc' },
    { id: SketchOperation.TANGENT_ARC, icon: <TangentArcIcon size={16} />, label: 'Tangent Arc' },
    { id: SketchOperation.ARC, icon: <Icon3PointArcIcon size={16} />, label: '3 Point Arc' },
  ],
};

export const sketchOperations: { id: SketchOperation; icon: React.ReactNode; label: string }[] = [
  { id: SketchOperation.POINT, icon: <PointIcon size={16} />, label: 'Point' },
  { id: SketchOperation.LINE, icon: <LineIcon size={16} />, label: 'Line' },
  { id: SketchOperation.RECTANGLE, icon: <RectangleIcon size={16} />, label: 'Corner Rectangle' },
  { id: SketchOperation.CIRCLE, icon: <CircleIcon size={16} />, label: 'Circle' },
  { id: SketchOperation.POLYGON, icon: <PolygonIcon size={16} />, label: 'Polygon' },
  { id: SketchOperation.ARC, icon: <Icon3PointArcIcon size={16} />, label: '3 Point Arc' },
  { id: SketchOperation.ELLIPSE, icon: <EllipseIcon size={16} />, label: 'Ellipse' },
  { id: SketchOperation.BEZIER, icon: <BezierIcon size={16} />, label: 'Bezier' },
];

export const evaluateOperations: { id: EvaluateOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'measure', icon: <MeasureIcon size={16} />, label: 'Measure' },
];

export const transformOperations: { id: TransformOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'move', icon: <MoveIcon size={16} />, label: 'Move' },
  { id: 'rotate', icon: <Rotate2Icon size={16} />, label: 'Rotate' },
  { id: 'mirror', icon: <MirrorIcon size={16} />, label: 'Mirror' },
  { id: 'scale', icon: <ScaleIcon size={16} />, label: 'Scale' },
];

export const ioOperations: { id: IOOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'import-step', icon: <ImportSTEPIcon size={16} />, label: 'Import STEP' },
  { id: 'import-iges', icon: <ImportIGESIcon size={16} />, label: 'Import IGES' },
  { id: 'export-step', icon: <ExportSTEPIcon size={16} />, label: 'Export STEP' },
  { id: 'export-iges', icon: <ExportIGESIcon size={16} />, label: 'Export IGES' },
  { id: 'export-stl', icon: <ExportSTLIcon size={16} />, label: 'Export STL' },
  { id: 'export-gltf', icon: <ExportGLTFIcon size={16} />, label: 'Export GLTF' },
];

// Operations that are not yet implemented (disabled in UI)
export const disabledOperations: Operation[] = [
  // I/O - not yet implemented
  'import-step', 'import-iges', 'export-step', 'export-iges', 'export-stl', 'export-gltf',
];
