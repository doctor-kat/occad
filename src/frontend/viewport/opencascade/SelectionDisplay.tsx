import { Paper, Text } from "@mantine/core";
import type { CADProject } from "@/cad/types";
import { useViewportStore } from "@/frontend/shared/viewportStore.ts";

export interface SelectionDisplayProps {
  selectedTreeItem?: string | null;
  project?: CADProject;
}

export function SelectionDisplay({ selectedTreeItem, project }: SelectionDisplayProps) {
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);
  let displayText = "Nothing selected";

  if (selectedTreeItem && project) {
    // Check if it's a plane
    const plane = project.referenceGeometry.find((ref) => ref.id === selectedTreeItem);
    if (plane) {
      displayText = plane.name;
    } else {
      // Check if it's a sketch
      const sketch = project.sketches.find((s) => s.id === selectedTreeItem);
      if (sketch) {
        displayText = sketch.name;
      } else {
        // Check if it's a feature
        const feature = project.features.find((f) => f.id === selectedTreeItem);
        if (feature) {
          displayText = feature.name;
        }
      }
    }
  } else if (selectedFaceId !== null && selectedFaceId !== undefined) {
    displayText = `Face ${selectedFaceId + 1}`;
  } else if (selectedEdgeIndex !== null && selectedEdgeIndex !== undefined) {
    displayText = `Edge ${selectedEdgeIndex + 1}`;
  } else if (selectedVertexIndex !== null && selectedVertexIndex !== undefined) {
    displayText = `Vertex ${selectedVertexIndex + 1}`;
  }

  return (
    <Paper
      pos="absolute"
      radius="md"
      px={16}
      py={8}
      style={{
        bottom: 16,
        left: 16,
        zIndex: 10,
        backgroundColor: 'rgba(24, 24, 27, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: 13,
        fontWeight: 500,
        color: '#e5e5e5',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
      }}
    >
      <Text component="span" c="dimmed" mr={8}>Selected:</Text>
      {displayText}
    </Paper>
  );
}
