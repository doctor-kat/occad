import { useRef, useEffect, useState } from 'react';
import { Toolbar } from './Toolbar';
import { OperationsBar } from './operations/OperationsBar';
import { FeatureTree } from './FeatureTree/FeatureTree';
import { CADViewport } from '@/frontend/canvas/CADViewport';
import { OperationPanel } from './operations/OperationPanel';
import { EntitiesPanel } from './EntitiesPanel';
import { useCADState } from '@/frontend/shared/useCADState';
import { useOpenCascade } from '@/worker/bridge/useOpenCascade';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { AppShell, Box, useMantineTheme, Tabs, Center, Tooltip, ActionIcon, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { Cube, Polygon } from '@phosphor-icons/react';
import type { SketchElement, SketchPlane, ExtrudeParams } from '@/cad/types';
import { SketchOperation, PlaneType, FeatureOperation, TransformOperation, OperationCategory, ReferenceGeometryType } from '@/cad/types';

/** Map legacy SketchElements to new SketchPrimitives for the solver */
function mapElementsToPrimitives(elements: SketchElement[]): any[] {
  const primitives: any[] = [];
  
  elements.forEach(el => {
    switch (el.type) {
      case 'line': {
        const p1Id = `${el.id}_p1`;
        const p2Id = `${el.id}_p2`;
        primitives.push({ id: p1Id, type: 'point', fixed: false, data: { x: el.start.x, y: el.start.y } });
        primitives.push({ id: p2Id, type: 'point', fixed: false, data: { x: el.end.x, y: el.end.y } });
        primitives.push({ id: el.id, type: 'line', fixed: false, data: { p1_id: p1Id, p2_id: p2Id } });
        break;
      }
      case 'circle': {
        const centerId = `${el.id}_center`;
        primitives.push({ id: centerId, type: 'point', fixed: false, data: { x: el.center.x, y: el.center.y } });
        primitives.push({ id: el.id, type: 'circle', fixed: false, data: { center_id: centerId, radius: el.radius } });
        break;
      }
      case 'arc': {
        const centerId = `${el.id}_center`;
        // planegcs arcs need start/end angles
        // If they come from 3-point arc, we might need more complex mapping
        // For now assume center-radius-angle or similar
        const center = el.center || { x: 0, y: 0 };
        primitives.push({ id: centerId, type: 'point', fixed: false, data: { x: center.x, y: center.y } });
        primitives.push({ 
          id: el.id, 
          type: 'arc', 
          fixed: false, 
          data: { 
            center_id: centerId, 
            radius: el.radius || 10, 
            start_angle: el.startAngle || 0, 
            end_angle: el.endAngle || Math.PI / 2 
          } 
        });
        break;
      }
      case 'rectangle': {
        const p1Id = `${el.id}_p1`, p2Id = `${el.id}_p2`, p3Id = `${el.id}_p3`, p4Id = `${el.id}_p4`;
        primitives.push({ id: p1Id, type: 'point', fixed: false, data: { x: el.corner1.x, y: el.corner1.y } });
        primitives.push({ id: p2Id, type: 'point', fixed: false, data: { x: el.corner2.x, y: el.corner1.y } });
        primitives.push({ id: p3Id, type: 'point', fixed: false, data: { x: el.corner2.x, y: el.corner2.y } });
        primitives.push({ id: p4Id, type: 'point', fixed: false, data: { x: el.corner1.x, y: el.corner2.y } });
        primitives.push({ id: `${el.id}_l1`, type: 'line', fixed: false, data: { p1_id: p1Id, p2_id: p2Id } });
        primitives.push({ id: `${el.id}_l2`, type: 'line', fixed: false, data: { p1_id: p2Id, p2_id: p3Id } });
        primitives.push({ id: `${el.id}_l3`, type: 'line', fixed: false, data: { p1_id: p3_id, p2_id: p4Id } });
        primitives.push({ id: `${el.id}_l4`, type: 'line', fixed: false, data: { p1_id: p4_id, p2_id: p1Id } });
        break;
      }
      case 'polygon': {
        const pointIds = el.points.map((p, i) => {
          const pid = `${el.id}_p${i}`;
          primitives.push({ id: pid, type: 'point', fixed: false, data: { x: p.x, y: p.y } });
          return pid;
        });
        pointIds.forEach((pid, i) => {
          const nextPid = pointIds[(i + 1) % pointIds.length];
          primitives.push({ id: `${el.id}_l${i}`, type: 'line', fixed: false, data: { p1_id: pid, p2_id: nextPid } });
        });
        break;
      }
      case 'ellipse': {
        const centerId = `${el.id}_center`;
        primitives.push({ id: centerId, type: 'point', fixed: false, data: { x: el.center.x, y: el.center.y } });
        primitives.push({ 
          id: el.id, 
          type: 'ellipse', 
          fixed: false, 
          data: { 
            center_id: centerId, 
            major_radius: el.majorRadius, 
            minor_radius: el.minorRadius, 
            major_dir: { x: Math.cos((el.rotation || 0) * Math.PI / 180), y: Math.sin((el.rotation || 0) * Math.PI / 180), z: 0 } 
          } 
        });
        break;
      }
    }
  });
  
  return primitives;
}

export function CADLayout() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(164);
  const theme = useMantineTheme();
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>(OperationCategory.FEATURES);

  // Dynamically measure header height so sidebar/main offsets stay correct
  // even when the toolbar scrollbar appears (e.g. narrow Firefox windows)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0) setHeaderHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const {
    project,
    activeTab,
    activeOperation,
    selectedTreeItem,
    isSidebarOpen,
    activeSketchId,
    featureTree,
    selectOperation,
    switchTab,
    selectTreeItem,
    toggleTreeItemExpansion,
    toggleTreeItemVisibility,
    editTreeItem,
    deleteTreeItem,
    addSketch,
    addFeature,
    updateSketchElements,
    updateSketchState,
    startSketchEdit,
    stopSketchEdit,
    updateFeatureParameters,
    saveProject,
    newProject,
    exportProject,
    importProject,
    toggleSidebar,
    setItemError,
    clearAllItemErrors,
  } = useCADState();

  // Viewport interaction state (from Zustand store)
  const pendingSketchOnFace = useViewportStore((state) => state.pendingSketchOnFace);
  const selectedFaceId = useViewportStore((state) => state.selectedFaceId);
  const selectedEdgeIndex = useViewportStore((state) => state.selectedEdgeIndex);
  const selectedVertexIndex = useViewportStore((state) => state.selectedVertexIndex);
  const setPendingSketchOnFace = useViewportStore((state) => state.setPendingSketchOnFace);
  const setSelectedFaceId = useViewportStore((state) => state.setSelectedFaceId);
  const setSelectedEdgeIndex = useViewportStore((state) => state.setSelectedEdgeIndex);
  const setSelectedVertexIndex = useViewportStore((state) => state.setSelectedVertexIndex);

  // Single consolidated OpenCascade worker instance — shared by layout & viewport
  const {
    status: occStatus,
    progress: occProgress,
    error: occError,
    mesh: occMesh,
    retry: occRetry,
    rebuild,
    clearMesh,
    extrudeSketch,
    getFaceGeometry,
    currentFeatureShapeId,
    buildSketch,
    sketchEdges: occSketchEdges,
  } = useOpenCascade({
    onSketchBuilt: (sketchId, meshData, solvedSketch) => {
      if (solvedSketch) {
        updateSketchState(sketchId, solvedSketch);
      }
    },
    onFeatureBuilt: (featureId, meshData) => {
      notifications.show({ color: 'green', message: 'Feature built successfully' });
    },
    onRebuildComplete: (meshData) => {
      notifications.show({ color: 'green', message: 'Rebuild complete' });
    },
    onFaceGeometry: (faceId, origin, normal, boundaryEdges) => {
      // Create sketch with the actual face geometry
      if (pendingSketchOnFace === faceId) {
        const plane: SketchPlane = {
          type: PlaneType.CUSTOM,
          planeRef: `face-${faceId}`,
          offset: 0,
          origin,
          normal,
        };

        const newSketch = addSketch(`Sketch ${project.sketches.length + 1}`, plane);
        
        // Import boundary edges as external fixed primitives
        if (boundaryEdges && boundaryEdges.length > 0) {
          const externalPrims = boundaryEdges.map(edgeTag => ({
            id: crypto.randomUUID(),
            type: 'line' as const, // Placeholder, worker will refine
            data: {},
            fixed: true,
            isExternal: true,
            sourceId: edgeTag
          }));
          const updatedSketch = {
            ...newSketch,
            primitives: externalPrims
          };
          updateSketchState(newSketch.id, updatedSketch);
          buildSketch(updatedSketch);
        }

        startSketchEdit(newSketch.id);
        selectTreeItem(newSketch.id);
        notifications.show({ color: 'blue', message: `Sketch created on Face ${faceId + 1} with ${boundaryEdges?.length || 0} imported edges` });
        setPendingSketchOnFace(null);
      }
    },
    onError: (message, featureId) => {
      if (featureId) {
        setItemError(featureId, message);
      } else {
        notifications.show({
          color: 'red',
          title: 'Error',
          message: message,
        });
        setPendingSketchOnFace(null);
      }
    },
  });

  // Track last rebuilt version / project ID (moved from OpenCascadeViewport)
  const lastRebuiltVersion = useRef<number>(0);
  const lastProjectId = useRef<string | null>(null);

  // Clear mesh when project ID changes (new project created)
  useEffect(() => {
    if (lastProjectId.current !== null && lastProjectId.current !== project.id) {
      clearMesh();
      lastRebuiltVersion.current = 0;
    }
    lastProjectId.current = project.id;
  }, [project.id, clearMesh]);

  // Trigger rebuild when project version changes OR on initial load with features
  useEffect(() => {
    if (occStatus !== 'ready') return;

    // Trigger rebuild if version has increased since last rebuild
    if (project.version > lastRebuiltVersion.current) {
      lastRebuiltVersion.current = project.version;
      clearAllItemErrors();
      rebuild(project);
    }
  }, [project.id, project.version, occStatus, rebuild, project, clearAllItemErrors]);

  // Operation panel state
  const [operationPanelOpen, setOperationPanelOpen] = useState(false);
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);

  // Handle operation selection from OperationsBar
  useEffect(() => {
    if (activeOperation) {
      // Check if it's a sketch operation
      const sketchOperations: SketchOperation[] = [
        SketchOperation.LINE,
        SketchOperation.RECTANGLE,
        SketchOperation.CIRCLE,
        SketchOperation.POLYGON,
        SketchOperation.ARC,
        SketchOperation.ELLIPSE,
        SketchOperation.SPLINE,
        SketchOperation.BEZIER,
      ];

      if (sketchOperations.includes(activeOperation as SketchOperation)) {
        // Handle entering sketch mode
        if (!activeSketchId) {
          const plane: SketchPlane = {
            type: PlaneType.XY,
            planeRef: 'front-plane',
            offset: 0,
          };
          const newSketch = addSketch(`Sketch ${project.sketches.length + 1}`, plane);
          startSketchEdit(newSketch.id);
          notifications.show({ color: 'blue', message: 'Sketch mode active' });
        }
      } else {
        // For all other operations, open the OperationPanel
        setOperationPanelOpen(true);
        setEditingFeatureId(null);
        if (!isSidebarOpen) toggleSidebar();
      }
    } else {
      setOperationPanelOpen(false);
    }
  }, [activeOperation, activeSketchId, project.sketches.length, addSketch, startSketchEdit, isSidebarOpen, toggleSidebar]);

  // Handle operation confirmation
  const handleOperationConfirm = (params: OperationParams, sketchId?: string) => {
    if (editingFeatureId) {
      // Update existing feature
      const feature = project.features.find((f) => f.id === editingFeatureId);
      if (feature) {
        updateFeatureParameters(editingFeatureId, params);
        notifications.show({ color: 'green', message: `${feature.name} updated` });
      }
    } else {
      // Create new feature
      let featureName = 'Feature';
      if (activeOperation) {
        // Map operation to a friendly name
        const opName = activeOperation.toString().split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).reverse().join('-');
        featureName = `${opName}${project.features.length + 1}`;
      }

      addFeature(
        featureName,
        activeOperation as FeatureOperation,
        params,
        sketchId,
        sketchId ? [sketchId] : []
      );
      notifications.show({ color: 'green', message: `${featureName} created` });
    }

    selectOperation(null);
    setOperationPanelOpen(false);
    setEditingFeatureId(null);
  };

  const handleOperationCancel = () => {
    selectOperation(null);
    setOperationPanelOpen(false);
    setEditingFeatureId(null);
  };

  // Override editTreeItem to support specific editing logic
  const handleEditTreeItem = (id: string) => {
    // Check if it's a sketch
    const sketch = project.sketches.find((s) => s.id === id);
    if (sketch) {
      startSketchEdit(id);
      notifications.show({ color: 'blue', message: `Editing ${sketch.name}` });
      return;
    }

    // Check if it's a feature
    const feature = project.features.find((f) => f.id === id);
    if (feature) {
      setEditingFeatureId(id);
      selectOperation(feature.type);
      setOperationPanelOpen(true);
      // Ensure sidebar is open
      if (!isSidebarOpen) toggleSidebar();
      return;
    }

    // Default to generic edit logic
    editTreeItem(id);
  };

  // Handle sketch update
  const handleUpdateSketch = (sketchId: string, elements: SketchElement[]) => {
    // First update local elements so UI reflects changes immediately if needed
    updateSketchElements(sketchId, elements);
    
    // Then trigger worker build/solve
    const sketch = project.sketches.find((s) => s.id === sketchId);
    if (sketch) {
      // Merge mapped primitives with existing ones (to keep external geometry)
      const newPrimitives = mapElementsToPrimitives(elements);
      const externalPrims = sketch.primitives.filter(p => p.isExternal);
      
      buildSketch({ 
        ...sketch, 
        elements, 
        primitives: [...newPrimitives, ...externalPrims] 
      });
    }
  };

  // Handle finish sketch
  const handleFinishSketch = () => {
    stopSketchEdit();
    selectOperation(null); // Deselect operation
    notifications.show({ color: 'green', message: 'Sketch completed' });
  };

  // Handle cancel sketch
  const handleCancelSketch = () => {
    stopSketchEdit();
    selectOperation(null); // Deselect operation
    notifications.show({ color: 'blue', message: 'Sketch cancelled' });
  };

  // Handle face click from viewport
  const handleFaceClick = (faceId: number) => {
    // Clear all other selections and set face selection
    selectTreeItem(null);
    setSelectedFaceId(faceId);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(null);
    // Switch to entities tab if not already there
    setActiveSidebarTab('entities');
  };

  // Handle edge click from viewport
  const handleEdgeClick = (edgeIndex: number) => {
    if (activeSketchId) {
      // If in sketch mode, import the edge as external geometry
      const sketch = project.sketches.find(s => s.id === activeSketchId);
      if (sketch) {
        const sourceId = `edge-${edgeIndex}`;
        if (!sketch.primitives.some(p => p.sourceId === sourceId)) {
          const newPrimitive = {
            id: crypto.randomUUID(),
            type: 'line' as const, // The worker will refine the type if needed
            data: {},
            fixed: true,
            isExternal: true,
            sourceId
          };
          const updatedSketch = {
            ...sketch,
            primitives: [...sketch.primitives, newPrimitive]
          };
          updateSketchState(activeSketchId, updatedSketch);
          buildSketch(updatedSketch);
          notifications.show({ color: 'blue', message: `Imported edge ${edgeIndex + 1} into sketch` });
        }
      }
      return;
    }

    // Clear all other selections and set edge selection
    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(edgeIndex);
    setSelectedVertexIndex(null);
    // Switch to entities tab if not already there
    setActiveSidebarTab('entities');
  };

  // Handle vertex click from viewport
  const handleVertexClick = (vertexIndex: number) => {
    if (activeSketchId) {
      // If in sketch mode, import the vertex as external geometry
      const sketch = project.sketches.find(s => s.id === activeSketchId);
      if (sketch) {
        const sourceId = `vertex-${vertexIndex}`;
        if (!sketch.primitives.some(p => p.sourceId === sourceId)) {
          const newPrimitive = {
            id: crypto.randomUUID(),
            type: 'point' as const,
            data: {},
            fixed: true,
            isExternal: true,
            sourceId
          };
          const updatedSketch = {
            ...sketch,
            primitives: [...sketch.primitives, newPrimitive]
          };
          updateSketchState(activeSketchId, updatedSketch);
          buildSketch(updatedSketch);
          notifications.show({ color: 'blue', message: `Imported vertex ${vertexIndex + 1} into sketch` });
        }
      }
      return;
    }

    // Clear all other selections and set vertex selection
    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(vertexIndex);
  };

  // Handle background click - clear all selections
  const handleBackgroundClick = () => {
    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(null);
  };

  // Handle sketch button click
  const handleSketchButtonClick = () => {
    // Toggle off: if already in sketch mode, finish/exit
    if (activeSketchId) {
      handleFinishSketch();
      return;
    }

    // Check if edge or vertex is selected (invalid for sketching)
    if (selectedEdgeIndex !== null || selectedVertexIndex !== null) {
      notifications.show({
        color: 'yellow',
        title: 'Invalid selection',
        message: 'Select a plane or face to create a sketch. Edges and vertices cannot be used for sketch creation.',
      });
      return;
    }

    // Check if a face is selected
    if (selectedFaceId !== null) {
      // Request face geometry from the worker before creating the sketch
      if (!currentFeatureShapeId) {
        notifications.show({
          color: 'red',
          title: 'Error',
          message: 'No geometry available. Please create a feature first.',
        });
        return;
      }

      // Request face geometry - the sketch will be created in the onFaceGeometry callback
      setPendingSketchOnFace(selectedFaceId);
      getFaceGeometry(selectedFaceId, currentFeatureShapeId);
      notifications.show({ color: 'blue', message: 'Extracting face geometry...' });
      return;
    }

    if (!selectedTreeItem) {
      // No selection - prompt user to select a plane or face
      notifications.show({
        color: 'yellow',
        title: 'Select a plane or face',
        message: 'Select a plane on which to create a sketch for the entity',
      });
      return;
    }

    // Check if selected item is a plane
    const selectedPlane = project.referenceGeometry.find((ref) => ref.id === selectedTreeItem);
    if (selectedPlane && selectedPlane.type === ReferenceGeometryType.PLANE) {
      // Create a new sketch on the selected plane
      let planeType: PlaneType = PlaneType.XY;
      if (selectedPlane.id === 'front-plane') planeType = PlaneType.XY;
      else if (selectedPlane.id === 'top-plane') planeType = PlaneType.XZ;
      else if (selectedPlane.id === 'right-plane') planeType = PlaneType.YZ;

      const plane: SketchPlane = {
        type: planeType,
        planeRef: selectedPlane.id,
        offset: 0,
      };

      const newSketch = addSketch(`Sketch ${project.sketches.length + 1}`, plane);
      startSketchEdit(newSketch.id);
      notifications.show({ color: 'blue', message: `Sketch created on ${selectedPlane.name}` });
      return;
    }

    // Check if selected item is a sketch
    const selectedSketch = project.sketches.find((s) => s.id === selectedTreeItem);
    if (selectedSketch) {
      // Edit the selected sketch
      startSketchEdit(selectedSketch.id);
      notifications.show({ color: 'blue', message: `Editing ${selectedSketch.name}` });
      return;
    }

    // Check if selected item is a feature
    const selectedFeature = project.features.find((f) => f.id === selectedTreeItem);
    if (selectedFeature && selectedFeature.sketchId) {
      // Edit the sketch associated with the feature
      startSketchEdit(selectedFeature.sketchId);
      const sketch = project.sketches.find((s) => s.id === selectedFeature.sketchId);
      notifications.show({ color: 'blue', message: `Editing ${sketch?.name || 'sketch'}` });
      return;
    }

    // If we get here, the selected item is not valid for sketching
    notifications.show({
      color: 'yellow',
      title: 'Invalid selection',
      message: 'Select a plane, face, sketch, or feature to create or edit a sketch',
    });
  };

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importProject(file);
      notifications.show({ color: 'green', message: 'Project imported successfully' });
    }
    e.target.value = '';
  };

  const handleNew = () => {
    modals.openConfirmModal({
      title: 'Create New Project',
      children: 'Are you sure you want to create a new project? All unsaved changes will be lost.',
      labels: { confirm: 'Create New Project', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        newProject();
        notifications.show({ color: 'blue', message: 'New project created' });
      },
    });
  };

  const handleSave = () => {
    saveProject();
    notifications.show({ color: 'green', message: 'Project saved' });
  };

  const handleExport = () => {
    exportProject();
    notifications.show({ color: 'green', message: 'Project exported' });
  };

  // Handle constraint value update
  const handleUpdateConstraintValue = (constraintId: string, value: number) => {
    if (activeSketchId) {
      const sketch = project.sketches.find((s) => s.id === activeSketchId);
      if (sketch) {
        const updatedConstraints = sketch.constraints.map((c) => {
          if (c.id === constraintId) {
            // Update the value based on constraint type
            if ('distance' in c) return { ...c, distance: value };
            if ('radius' in c) return { ...c, radius: value };
            if ('angle' in c) return { ...c, angle: value };
          }
          return c;
        });
        const updatedSketch = { ...sketch, constraints: updatedConstraints };
        updateSketchState(activeSketchId, updatedSketch);
        buildSketch(updatedSketch);
      }
    }
  };

  return (
    <AppShell
      header={{ height: headerHeight }}
      navbar={{
        width: isSidebarOpen ? 256 : 56,
        breakpoint: 0, // Never auto-collapse based on breakpoint
      }}
      padding={0}
      style={{
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: theme.other.colors.background,
      }}
    >
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Combined Header: Toolbar + OperationsBar */}
      <AppShell.Header
        style={{
          border: 'none',
          backgroundColor: theme.other.colors.cadHeader,
        }}
      >
        <Box ref={headerRef}>
          <Toolbar
            projectName={project.name}
            onNew={handleNew}
            onOpen={handleOpen}
            onSave={handleSave}
            onExport={handleExport}
          />
          <OperationsBar
            activeTab={activeTab}
            activeOperation={activeOperation}
            selectedTreeItem={selectedTreeItem}
            activeSketchId={activeSketchId}
            onTabChange={switchTab}
            onOperationSelect={selectOperation}
            onSketchButtonClick={handleSketchButtonClick}
          />
        </Box>
      </AppShell.Header>

      {/* Left Sidebar - Dynamic Panel */}
            <AppShell.Navbar
              style={{
                borderRight: `1px solid ${theme.other.colors.border}`,
                backgroundColor: theme.other.colors.sidebarBackground,
                transition: 'all 300ms ease-in-out',
                overflow: 'hidden',
              }}
            >
              <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {operationPanelOpen && activeOperation && (
                  <Box style={{ 
                    flexShrink: 0, 
                    maxHeight: '60%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderBottom: `2px solid ${theme.other.colors.border}`,
                    zIndex: 5
                  }}>
                    <OperationPanel
                      title={editingFeatureId ? `Edit ${project.features.find(f => f.id === editingFeatureId)?.name}` : activeOperation.toString().split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}
                      operation={activeOperation as FeatureOperation | TransformOperation | SketchOperation}
                      project={project}
                      initialParams={editingFeatureId ? (project.features.find(f => f.id === editingFeatureId)?.parameters) : undefined}
                      initialSketchId={editingFeatureId ? (project.features.find(f => f.id === editingFeatureId)?.sketchId) : undefined}
                      selectedTreeItem={selectedTreeItem}
                      onConfirm={handleOperationConfirm}
                      onCancel={handleOperationCancel}
                    />
                  </Box>
                )}
                
                <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Tabs
                    variant="unstyled"
                    value={activeSidebarTab}
                    onChange={setActiveSidebarTab}
                    styles={{
                      root: { display: 'flex', flexDirection: 'column', height: '100%' },
                      panel: { flex: 1, overflow: 'hidden' },
                      list: {
                        display: 'flex',
                        padding: 0,
                        borderBottom: `1px solid ${theme.other.colors.sidebarBorder}`,
                        backgroundColor: theme.other.colors.sidebarBackground,
                        gap: 0,
                        marginTop: 8, // Add gap between toolbar and sidebar tabs
                        borderTop: `1px solid ${theme.other.colors.sidebarBorder}`, // Add top border for distinction
                      },
                      tab: {
                        flex: isSidebarOpen ? 1 : 'none',
                        height: 36, // Slightly shorter tabs for a more "panel" look
                        borderBottom: '2px solid transparent',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: theme.other.colors.mutedForeground,
                        transition: 'all 200ms',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                      }
                    }}
                  >
                    <Tabs.List>
                      <Tabs.Tab
                        value={OperationCategory.FEATURES}
                        data-testid="feature-tree-tab"
                        style={{
                          // Ensure transition is smooth
                          transition: 'background-color 200ms, border-color 200ms, color 200ms',
                          ...(activeSidebarTab === OperationCategory.FEATURES && {
                            color: theme.colors.blue[5],
                            borderBottomColor: theme.colors.blue[5],
                            backgroundColor: `${theme.colors.blue[5]}15`,
                          })
                        }}
                      >                        {isSidebarOpen ? (
                          <Group gap={6} wrap="nowrap">
                            <Cube size={16} />
                            <span>Feature Tree</span>
                          </Group>
                        ) : (
                          <Tooltip label="Feature Tree" position="right">
                            <Center><Cube size={20} /></Center>
                          </Tooltip>
                        )}
                      </Tabs.Tab>
                      <Tabs.Tab
                        value="entities"
                        data-testid="entities-tab"
                        style={{
                          transition: 'background-color 200ms, border-color 200ms, color 200ms',
                          ...(activeSidebarTab === 'entities' && {
                            color: theme.colors.blue[5],
                            borderBottomColor: theme.colors.blue[5],
                            backgroundColor: `${theme.colors.blue[5]}15`,
                          })
                        }}
                      >
                        {isSidebarOpen ? (
                          <Group gap={6} wrap="nowrap">
                            <Polygon size={16} />
                            <span>Entities</span>
                          </Group>
                        ) : (
                          <Tooltip label="Entities" position="right">
                            <Center><Polygon size={20} /></Center>
                          </Tooltip>
                        )}
                      </Tabs.Tab>
      
                      {!isSidebarOpen && (
                        <Box mt="auto" px={8} pb={8} style={{ width: '100%' }}>
                          <Tooltip label="Expand Sidebar" position="right">
                            <ActionIcon variant="subtle" color="gray" onClick={toggleSidebar} w="100%" h={40}>
                              <Cube size={20} />
                            </ActionIcon>
                          </Tooltip>
                        </Box>
                      )}
                    </Tabs.List>
      
                    <Tabs.Panel value={OperationCategory.FEATURES}>
                      <FeatureTree
                        items={featureTree}
                        selectedItem={selectedTreeItem}
                        onSelectItem={(id) => {
                          selectTreeItem(id);
                          // Clear geometry selections when selecting from tree
                          setSelectedFaceId(null);
                          setSelectedEdgeIndex(null);
                          setSelectedVertexIndex(null);
                        }}
                        onToggleExpand={toggleTreeItemExpansion}
                        onToggleVisibility={toggleTreeItemVisibility}
                        onEdit={handleEditTreeItem}
                        onDelete={deleteTreeItem}
                        isCompact={!isSidebarOpen}
                        onToggleSidebar={toggleSidebar}
                      />
                    </Tabs.Panel>
                    <Tabs.Panel value="entities">
                      {!isSidebarOpen ? (
                        <Stack gap={4} p={8} align="center">
                          <Tooltip label="Faces" position="right">
                            <ActionIcon variant="subtle" size="lg">
                              <Polygon size={20} />
                            </ActionIcon>
                          </Tooltip>
                        </Stack>
                      ) : (
                        <EntitiesPanel
                          mesh={occMesh}
                          onFaceClick={handleFaceClick}
                          onEdgeClick={handleEdgeClick}
                        />
                      )}
                    </Tabs.Panel>
            </Tabs>
          </Box>
        </Box>
      </AppShell.Navbar>

      {/* Main Canvas Area */}
      <AppShell.Main
        style={{
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <Box pos="relative" w="100%" h="100%">
          <CADViewport
            project={project}
            activeSketchId={activeSketchId}
            activeOperation={activeOperation as SketchOperation}
            selectedTreeItem={selectedTreeItem}
            occStatus={occStatus}
            occProgress={occProgress}
            occError={occError}
            occMesh={occMesh}
            occSketchEdges={occSketchEdges}
            occRetry={occRetry}
            onUpdateSketch={handleUpdateSketch}
            onFinishSketch={handleFinishSketch}
            onCancelSketch={handleCancelSketch}
            onPlaneClick={(planeId) => {
              selectTreeItem(planeId);
              setSelectedFaceId(null);
              setSelectedEdgeIndex(null);
              setSelectedVertexIndex(null);
            }}
            onFaceClick={handleFaceClick}
            onEdgeClick={handleEdgeClick}
            onVertexClick={handleVertexClick}
            onBackgroundClick={handleBackgroundClick}
            onUpdateConstraintValue={handleUpdateConstraintValue}
          />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}