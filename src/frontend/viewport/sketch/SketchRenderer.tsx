import { Sketch, Point2D } from '@/cad/types';
import { SketchPrimitives } from './components/SketchPrimitives';
import { SketchAnnotations } from './components/SketchAnnotations';

interface SketchRendererProps {
  sketch: Sketch;
  onUpdateConstraintValue?: (constraintId: string, value: number) => void;
  onUpdateLabelOffset?: (constraintId: string, offset: Point2D) => void;
  onToggleArrowFlip?: (constraintId: string) => void;
}

export function SketchRenderer({ sketch, onUpdateConstraintValue, onUpdateLabelOffset, onToggleArrowFlip }: SketchRendererProps) {
  const isFullyConstrained = sketch.dof === 0;
  const defaultColor = isFullyConstrained ? "#10b981" : "#3b82f6"; // Green if full, Blue if under

  return (
    <group>
      <SketchPrimitives sketch={sketch} defaultColor={defaultColor} />
      <SketchAnnotations
        sketch={sketch}
        onUpdateConstraintValue={onUpdateConstraintValue}
        onUpdateLabelOffset={onUpdateLabelOffset}
        onToggleArrowFlip={onToggleArrowFlip}
      />
    </group>
  );
}
