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
  Pen,
  WaveSine,
  ArrowsOutCardinal,
  ArrowClockwise,
  FlipHorizontal,
  ArrowsOut,
  UploadSimple,
  DownloadSimple,
  FileCode,
  Package,
  Unite
} from '@phosphor-icons/react';
import { FeatureOperation, SketchOperation, EvaluateOperation, TransformOperation, IOOperation, Operation } from '@/cad/types';

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

export const sketchOperations: { id: SketchOperation; icon: React.ReactNode; label: string }[] = [
  { id: SketchOperation.LINE, icon: <Minus size={16} weight="regular" />, label: 'Line' },
  { id: SketchOperation.RECTANGLE, icon: <Square size={16} weight="regular" />, label: 'Rectangle' },
  { id: SketchOperation.CIRCLE, icon: <Circle size={16} weight="regular" />, label: 'Circle' },
  { id: SketchOperation.POLYGON, icon: <Hexagon size={16} weight="regular" />, label: 'Polygon' },
  { id: SketchOperation.ARC, icon: <ArrowRight size={16} weight="regular" />, label: 'Arc' },
  { id: SketchOperation.ELLIPSE, icon: <DotsThree size={16} weight="regular" style={{ transform: 'rotate(90deg)' }} />, label: 'Ellipse' },
  { id: SketchOperation.SPLINE, icon: <Pen size={16} weight="regular" />, label: 'Spline' },
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
