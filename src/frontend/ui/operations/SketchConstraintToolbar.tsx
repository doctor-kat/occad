import { useState } from 'react';
import { Box, Group, ActionIcon, Text, Tooltip, Divider, NumberInput } from '@mantine/core';
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
} from '@/frontend/shared/icons';
import { useMantineTheme } from '@mantine/core';
import type { Sketch, SketchElement } from '@/cad/types';
import { SketchElementType } from '@/cad/types';
import type { ConstraintInput } from '@/cad/engine/sketch/constraintFactory';
import { useViewportStore } from '@/frontend/shared/viewportStore';

interface SketchConstraintToolbarProps {
  sketch: Sketch;
  onApply: (input: ConstraintInput) => void;
}

/**
 * Floating toolbar (sketch mode) for applying geometric + dimensional constraints to
 * the current selection (read from the viewport store). The selection set may hold
 * whole-element ids (lines/circles) and point-primitive ids (endpoints, for
 * coincident/distance). The value input feeds dimensional constraints
 * (radius/distance as length, angle as degrees).
 */
export function SketchConstraintToolbar({ sketch, onApply }: SketchConstraintToolbarProps) {
  const theme = useMantineTheme();
  const selectedIds = useViewportStore((s) => s.selectedSketchElementIds);
  const [dimValue, setDimValue] = useState<number>(20);

  const selectedElements: SketchElement[] = selectedIds
    .map((id) => sketch.elements.find((e) => e.id === id))
    .filter((e): e is SketchElement => Boolean(e));
  const lines = selectedElements.filter((e) => e.type === SketchElementType.LINE);
  const circles = selectedElements.filter((e) => e.type === SketchElementType.CIRCLE);
  // Selected ids that are planegcs point primitives (sketch endpoints/centers).
  const pointIds = selectedIds.filter((id) =>
    sketch.primitives?.some((p) => p.id === id && p.type === 'point'),
  );

  const oneLine = lines.length === 1 && selectedElements.length === 1 && pointIds.length === 0;
  const twoLines = lines.length === 2 && selectedElements.length === 2 && pointIds.length === 0;
  const oneCircle = circles.length === 1 && selectedElements.length === 1 && pointIds.length === 0;
  const lineAndCircle = lines.length === 1 && circles.length === 1 && selectedElements.length === 2;
  const twoPoints = pointIds.length === 2 && selectedElements.length === 0;

  type Btn = { key: string; label: string; hint: string; icon: JSX.Element; enabled: boolean; build: () => ConstraintInput | null };
  const buttons: Btn[] = [
    {
      key: 'horizontal', label: 'Horizontal', hint: 'select 1 line', icon: <HorizontalIcon size={16} />, enabled: oneLine,
      build: () => (oneLine ? { kind: 'horizontal', lineId: lines[0].id } : null),
    },
    {
      key: 'vertical', label: 'Vertical', hint: 'select 1 line', icon: <VerticalIcon size={16} />, enabled: oneLine,
      build: () => (oneLine ? { kind: 'vertical', lineId: lines[0].id } : null),
    },
    {
      key: 'parallel', label: 'Parallel', hint: 'select 2 lines', icon: <ParallelIcon size={16} />, enabled: twoLines,
      build: () => (twoLines ? { kind: 'parallel', l1Id: lines[0].id, l2Id: lines[1].id } : null),
    },
    {
      key: 'perpendicular', label: 'Perpendicular', hint: 'select 2 lines', icon: <PerpendicularIcon size={16} />, enabled: twoLines,
      build: () => (twoLines ? { kind: 'perpendicular', l1Id: lines[0].id, l2Id: lines[1].id } : null),
    },
    {
      key: 'equal', label: 'Equal', hint: 'select 2 lines', icon: <EqualIcon size={16} />, enabled: twoLines,
      build: () => (twoLines ? { kind: 'equal', l1Id: lines[0].id, l2Id: lines[1].id } : null),
    },
    {
      key: 'angle', label: 'Angle', hint: 'select 2 lines + a value (°)', icon: <AngularIcon size={16} />, enabled: twoLines,
      build: () => (twoLines ? { kind: 'angle', l1Id: lines[0].id, l2Id: lines[1].id, angle: (dimValue * Math.PI) / 180 } : null),
    },
    {
      key: 'coincident', label: 'Coincident', hint: 'select 2 points', icon: <CoincidentIcon size={16} />, enabled: twoPoints,
      build: () => (twoPoints ? { kind: 'coincident', p1Id: pointIds[0], p2Id: pointIds[1] } : null),
    },
    {
      key: 'distance', label: 'Distance', hint: 'select 2 points + a value', icon: <SmartLinearIcon size={16} />, enabled: twoPoints,
      build: () => (twoPoints ? { kind: 'distance', p1Id: pointIds[0], p2Id: pointIds[1], distance: dimValue } : null),
    },
    {
      key: 'radius', label: 'Radius', hint: 'select 1 circle + a value', icon: <RadiusIcon size={16} />, enabled: oneCircle,
      build: () => (oneCircle ? { kind: 'radius', targetId: circles[0].id, radius: dimValue } : null),
    },
    {
      key: 'tangent', label: 'Tangent', hint: 'select 1 line + 1 circle', icon: <TangentIcon size={16} />, enabled: lineAndCircle,
      build: () => (lineAndCircle ? { kind: 'tangent', lineId: lines[0].id, circleId: circles[0].id } : null),
    },
  ];

  return (
    <Box
      pos="absolute"
      data-testid="constraint-toolbar"
      style={{
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        borderRadius: theme.radius.lg,
        border: `1px solid ${theme.other.colors.border}`,
        backgroundColor: `${theme.other.colors.card}cc`,
        backdropFilter: 'blur(12px)',
        boxShadow: theme.shadows.lg,
      }}
    >
      <Group gap={2} style={{ padding: 4 }} wrap="nowrap">
        {buttons.map(({ key, label, hint, icon, enabled, build }) => (
          <Tooltip key={key} label={enabled ? label : `${label} — ${hint}`} withArrow>
            <ActionIcon
              size="md"
              variant="subtle"
              disabled={!enabled}
              data-constraint={key}
              aria-label={label}
              onClick={() => {
                const input = build();
                if (input) onApply(input);
              }}
              style={{ borderRadius: theme.radius.md }}
            >
              {icon}
            </ActionIcon>
          </Tooltip>
        ))}

        <Divider orientation="vertical" />

        <Tooltip label="Value for dimensional constraints (radius/distance = length, angle = degrees)" withArrow>
          <NumberInput
            size="xs"
            w={84}
            value={dimValue}
            onChange={(v) => setDimValue(typeof v === 'number' ? v : Number(v) || 0)}
            min={0}
            step={1}
            hideControls
            data-testid="constraint-value"
            aria-label="Constraint value"
          />
        </Tooltip>

        <Divider orientation="vertical" />

        <Text size="xs" c={theme.other.colors.mutedForeground} px="xs" data-testid="constraint-count">
          Solver Constraints: {(sketch.constraints || []).length}
        </Text>
        <Text size="xs" c={theme.other.colors.mutedForeground} px="xs" data-testid="sketch-dof">
          DOF: {typeof sketch.dof === 'number' ? sketch.dof : '—'}
        </Text>
      </Group>
    </Box>
  );
}
