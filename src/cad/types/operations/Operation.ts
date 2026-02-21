import { FeatureOperation } from './FeatureOperation';
import { SketchOperation } from './SketchOperation';
import { EvaluateOperation } from './EvaluateOperation';
import { TransformOperation } from './TransformOperation';
import { IOOperation } from './IOOperation';

export type Operation = FeatureOperation | SketchOperation | EvaluateOperation | TransformOperation | IOOperation | null;
