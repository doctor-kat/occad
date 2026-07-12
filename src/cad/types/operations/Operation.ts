import { FeatureOperation } from './FeatureOperation';
import { SketchOperation } from './SketchOperation';
import { EvaluateOperation } from './measureTypes';
import { TransformOperation } from './TransformParams';
import { IOOperation } from './ioTypes';

export enum OperationCategory {
  FEATURES = 'features', // sidebar feature-tree tab only
  SKETCH = 'sketch',
  PRIMITIVES = 'primitives',
  MODIFICATIONS = 'modifications',
  TRANSFORM = 'transform',
  ADVANCED = 'advanced',
  EVALUATE = 'evaluate',
  IO = 'io'
}

export type Operation = FeatureOperation | SketchOperation | EvaluateOperation | TransformOperation | IOOperation | null;
