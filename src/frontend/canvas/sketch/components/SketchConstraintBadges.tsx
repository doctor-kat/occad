import { Html } from '@react-three/drei';
import { DotsThree } from '@phosphor-icons/react';
import type { ConstraintIconPlacement } from '@/cad/engine/sketch/ConstraintIconPlacement';
import { CONSTRAINT_ICONS } from '../sketchOverlayConstants';

export interface SketchConstraintBadgesProps {
  constraintIcons: ConstraintIconPlacement[];
  selectedConstraintId: string | null;
  hoveredConstraintId: string | null;
  setSelectedConstraintId: (id: string | null) => void;
  setHoveredConstraintId: (id: string | null) => void;
}

/**
 * A small labelled square just above each constrained entity's midpoint,
 * drawn as a crisp DOM overlay (screen-constant size, so it's readable at any
 * zoom). Clicking one selects (toggles) that constraint. Rendered only in
 * selection mode so badges don't interfere with drawing.
 */
export function SketchConstraintBadges({
  constraintIcons,
  selectedConstraintId,
  hoveredConstraintId,
  setSelectedConstraintId,
  setHoveredConstraintId,
}: SketchConstraintBadgesProps) {
  return (
    <>
      {constraintIcons.map((icon) => {
        const isSel = selectedConstraintId === icon.id;
        const isHovered = hoveredConstraintId === icon.id;
        const Icon = CONSTRAINT_ICONS[icon.type] ?? DotsThree;
        return (
          <Html
            key={`constraint-${icon.id}`}
            position={[icon.x, icon.y, 0.25]}
            center
            zIndexRange={[30, 10]}
            style={{ pointerEvents: 'auto' }}
          >
            <button
              type="button"
              data-testid={`constraint-badge-${icon.id}`}
              data-hovered={isHovered}
              title={icon.type}
              aria-label={icon.type}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedConstraintId(isSel ? null : icon.id);
              }}
              onMouseEnter={() => setHoveredConstraintId(icon.id)}
              onMouseLeave={() => setHoveredConstraintId(null)}
              style={{
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isSel ? '#3b82f6' : isHovered ? '#f97316' : '#22d3ee',
                border: `1.5px solid ${isSel ? '#60a5fa' : isHovered ? '#fdba74' : '#0e7490'}`,
                borderRadius: 4,
                boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
                cursor: 'pointer',
                userSelect: 'none',
                padding: 0,
              }}
            >
              <Icon size={12} color="#0a0a0f" />
            </button>
          </Html>
        );
      })}
    </>
  );
}
