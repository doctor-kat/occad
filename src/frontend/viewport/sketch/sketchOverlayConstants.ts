import type { ComponentType } from 'react';
import {
  HorizontalIcon,
  VerticalIcon,
  ParallelIcon,
  PerpendicularIcon,
  EqualIcon,
  AngularIcon,
  CoincidentIcon,
  SmartLinearIcon,
  RadiusIcon,
  TangentIcon,
  type CadIconProps,
} from '@/frontend/shared/icons';

/**
 * No-op raycast: makes a mesh/line render but never be an intersection target.
 * Every sketch decoration (grid, axes, hover/snap/construction indicators,
 * element/preview lines) uses this so it can't sit under the cursor and swallow
 * a click meant for the sketch plane. Element hover/selection is computed from
 * 2D distance math on pointer-move, not from raycasting these objects, so making
 * them non-interactive costs nothing. Only the plane and the point-selection
 * handles remain real pointer targets.
 */
export const NO_RAYCAST = () => null;

/**
 * Icon shown inside a constraint badge, keyed by planegcs constraint type —
 * mirrors the icons used to *create* each constraint in `SketchConstraintToolbar`.
 */
export const CONSTRAINT_ICONS: Record<string, ComponentType<CadIconProps>> = {
  horizontal_l: HorizontalIcon,
  vertical_l: VerticalIcon,
  parallel: ParallelIcon,
  perpendicular_ll: PerpendicularIcon,
  equal_length: EqualIcon,
  l2l_angle_ll: AngularIcon,
  p2p_coincident: CoincidentIcon,
  p2p_distance: SmartLinearIcon,
  circle_radius: RadiusIcon,
  arc_radius: RadiusIcon,
  tangent_lc: TangentIcon,
};
