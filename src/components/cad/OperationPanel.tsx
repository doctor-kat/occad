import { useState, useEffect } from 'react';
import { Button, TextInput, Select, Stack, Group, Text, Alert, Box, useMantineTheme, ActionIcon, Title } from '@mantine/core';
import { X, Check } from '@phosphor-icons/react';
import { useViewportStore } from '@/stores/viewportStore';
import type { Sketch, ExtrudeParams, SketchPlane, Vector3D } from '@/types/cad';

/**
 * Helper to get the normal vector for a sketch plane
 */
function getSketchNormal(plane: SketchPlane): Vector3D {
  if (plane.normal) return plane.normal;

  switch (plane.type) {
    case 'xy': return { x: 0, y: 0, z: 1 };
    case 'xz': return { x: 0, y: 1, z: 0 };
    case 'yz': return { x: 1, y: 0, z: 0 };
    default: return { x: 0, y: 0, z: 1 };
  }
}

interface OperationPanelProps {
  title: string;
  sketches: Sketch[];
  selectedSketchId?: string;
  initialParams?: ExtrudeParams;
  isCut: boolean;
  onConfirm: (sketchId: string, params: ExtrudeParams) => void;
  onCancel: () => void;
}

export function OperationPanel({
  title,
  sketches,
  selectedSketchId,
  initialParams,
  isCut,
  onConfirm,
  onCancel,
}: OperationPanelProps) {
  const theme = useMantineTheme();
  const [sketchId, setSketchId] = useState(selectedSketchId || sketches[0]?.id || '');
  const [distance, setDistance] = useState(initialParams ? Math.abs(initialParams.distance).toString() : '10');
  const [direction, setDirection] = useState<'normal' | 'reverse'>(
    initialParams ? (initialParams.distance >= 0 ? 'normal' : 'reverse') : 'normal'
  );

  // Sync sketchId state when props change
  useEffect(() => {
    if (selectedSketchId) {
      setSketchId(selectedSketchId);
    } else if (sketches.length > 0 && !sketchId) {
      setSketchId(sketches[0].id);
    }
  }, [selectedSketchId, sketches, sketchId]);

  // Sync state with initialParams if they change (e.g. when switching which feature is being edited)
  useEffect(() => {
    if (initialParams) {
      setDistance(Math.abs(initialParams.distance).toString());
      setDirection(initialParams.distance >= 0 ? 'normal' : 'reverse');
    }
  }, [initialParams]);

  const handleConfirm = () => {
    if (!sketchId) return;

    const distanceValue = parseFloat(distance);
    if (isNaN(distanceValue) || distanceValue === 0) {
      return;
    }

    const selectedSketch = sketches.find(s => s.id === sketchId);
    const planeNormal = selectedSketch ? getSketchNormal(selectedSketch.plane) : { x: 0, y: 0, z: 1 };

    const params: ExtrudeParams = {
      distance: direction === 'normal' ? distanceValue : -distanceValue,
      direction: planeNormal,
      isCut,
    };

    onConfirm(sketchId, params);
  };

  // Sync extrude preview to viewport store
  const setExtrudePreview = useViewportStore((state) => state.setExtrudePreview);
  useEffect(() => {
    if (sketchId) {
      setExtrudePreview({
        sketchId,
        distance: parseFloat(distance) || 0,
        direction,
      });
    } else {
      setExtrudePreview(null);
    }

    return () => setExtrudePreview(null);
  }, [sketchId, distance, direction, setExtrudePreview]);

  const closedSketches = sketches.filter((s) => s.isClosed);

  return (
    <Stack gap={0} style={{ height: '100%', backgroundColor: theme.other.colors.background }}>
      {/* Header */}
      <Box
        px={16}
        py={12}
        style={{
          borderBottom: `1px solid ${theme.other.colors.sidebarBorder}`,
          backgroundColor: `${theme.colors.blue[5]}15`, // Match active tab
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
            <ActionIcon variant="filled" color="blue" onClick={handleConfirm} disabled={!sketchId || !distance}>
              <Check size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Content */}
      <Box p={16} style={{ flex: 1, overflowY: 'auto' }}>
        <Stack gap="md">
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

              <TextInput
                label="Distance"
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="Enter distance"
                step={0.1}
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

              <Alert variant="light" color="blue" p="xs">
                <Text size="xs">
                  {isCut ? 'Removing' : 'Adding'} material by {Math.abs(parseFloat(distance) || 0)} units.
                </Text>
              </Alert>
            </>
          )}
        </Stack>
      </Box>

      {/* Footer Buttons (Mobile/Secondary) */}
      <Box p={16} style={{ borderTop: `1px solid ${theme.other.colors.sidebarBorder}` }}>
        <Group grow>
          <Button variant="subtle" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={!sketchId || !distance || closedSketches.length === 0}>
            Apply
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}
