import { useState } from 'react';
import { Modal, Button, TextInput, Select, Stack, Group, Text, Alert } from '@mantine/core';
import type { Sketch, ExtrudeParams } from '@/types/cad';

interface ExtrudeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sketches: Sketch[];
  selectedSketchId?: string;
  isCut: boolean;
  onConfirm: (sketchId: string, params: ExtrudeParams) => void;
}

/**
 * Dialog for configuring extrude parameters
 */
export function ExtrudeDialog({
  open,
  onOpenChange,
  sketches,
  selectedSketchId,
  isCut,
  onConfirm,
}: ExtrudeDialogProps) {
  const [sketchId, setSketchId] = useState(selectedSketchId || sketches[0]?.id || '');
  const [distance, setDistance] = useState('10');
  const [direction, setDirection] = useState<'normal' | 'reverse'>('normal');

  const handleConfirm = () => {
    if (!sketchId) return;

    const distanceValue = parseFloat(distance);
    if (isNaN(distanceValue) || distanceValue === 0) {
      return;
    }

    const params: ExtrudeParams = {
      distance: direction === 'normal' ? distanceValue : -distanceValue,
      direction: { x: 0, y: 0, z: 1 }, // Default to Z-up
      isCut,
    };

    onConfirm(sketchId, params);
    onOpenChange(false);
  };

  // Filter to only show closed sketches (can be extruded)
  const closedSketches = sketches.filter((s) => s.isClosed);

  if (closedSketches.length === 0) {
    return (
      <Modal
        opened={open}
        onClose={() => onOpenChange(false)}
        title={isCut ? 'Extruded Cut' : 'Extrude Boss/Base'}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            No closed sketches available to extrude. Create a closed sketch first.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal
      opened={open}
      onClose={() => onOpenChange(false)}
      title={isCut ? 'Extruded Cut' : 'Extrude Boss/Base'}
      size="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Configure the extrusion parameters for the selected sketch.
        </Text>

        {/* Sketch selection */}
        <Select
          label="Select Sketch"
          placeholder="Choose a sketch"
          value={sketchId}
          onChange={(value) => setSketchId(value || '')}
          data={closedSketches.map((sketch) => ({
            value: sketch.id,
            label: `${sketch.name} (${sketch.elements.length} elements)`,
          }))}
        />

        {/* Distance */}
        <TextInput
          label="Distance"
          type="number"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          placeholder="Enter distance"
          step={0.1}
          description="The extrusion distance along the sketch plane normal"
        />

        {/* Direction */}
        <Select
          label="Direction"
          value={direction}
          onChange={(value) => setDirection(value as 'normal' | 'reverse')}
          data={[
            { value: 'normal', label: 'Normal (positive)' },
            { value: 'reverse', label: 'Reverse (negative)' },
          ]}
        />

        {/* Preview info */}
        <Alert variant="light" color="blue">
          <Text size="sm" fw={500} mb={4}>
            Preview:
          </Text>
          <Text size="xs" c="dimmed">
            {isCut ? 'Material will be removed' : 'Material will be added'} by extruding{' '}
            <Text component="span" fw={600}>
              {Math.abs(parseFloat(distance) || 0)}
            </Text>{' '}
            units in the {direction} direction.
          </Text>
        </Alert>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!sketchId || !distance}>
            {isCut ? 'Create Cut' : 'Create Extrude'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
