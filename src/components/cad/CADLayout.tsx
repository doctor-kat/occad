import { useRef, useEffect, useState } from 'react';
import { HeaderBar } from './HeaderBar';
import { FeatureTabs } from './FeatureTabs';
import { FeatureTree } from './FeatureTree';
import { CADViewport } from './CADViewport';
import { ExtrudeDialog } from './ExtrudeDialog';
import { EntitiesPanel } from './EntitiesPanel';
import { useCADState } from '@/hooks/useCADState';
import { useOpenCascade } from '@/hooks/useOpenCascade';
import { AppShell, Box, useMantineTheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import type { SketchElement, SketchTool, SketchPlane, ExtrudeParams } from '@/types/cad';

export function CADLayout() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(164);
  const theme = useMantineTheme();

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
    activeTool,
    selectedTreeItem,
    isSidebarOpen,
    activeSketchId,
    featureTree,
    selectTool,
    switchTab,
    selectTreeItem,
    toggleTreeItemExpansion,
    toggleTreeItemVisibility,
    editTreeItem,
    deleteTreeItem,
    addSketch,
    addFeature,
    updateSketchElements,
    startSketchEdit,
    stopSketchEdit,
    saveProject,
    newProject,
    exportProject,
    importProject,
    toggleSidebar,
    setItemError,
    clearAllItemErrors,
  } = useCADState();

  // Track selected geometry (separate from tree selection)
  const [selectedFaceId, setSelectedFaceId] = useState<number | null>(null);
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

  // Track hovered tree item for plane visibility
  const [hoveredTreeItem, setHoveredTreeItem] = useState<string | null>(null);

  // Track hovered geometry
  const [hoveredFaceId, setHoveredFaceId] = useState<number | null>(null);
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);

  // Track pending face geometry request for sketch creation
  const [pendingSketchOnFace, setPendingSketchOnFace] = useState<number | null>(null);

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
    onFeatureBuilt: (featureId, meshData) => {
      notifications.show({ color: 'green', message: 'Feature built successfully' });
    },
    onFaceGeometry: (faceId, origin, normal) => {
      // Create sketch with the actual face geometry
      if (pendingSketchOnFace === faceId) {
        const plane: SketchPlane = {
          type: 'custom',
          planeRef: `face-${faceId}`,
          offset: 0,
          origin,
          normal,
        };

        const newSketch = addSketch(`Sketch ${project.sketches.length + 1}`, plane);
        startSketchEdit(newSketch.id);
        notifications.show({ color: 'blue', message: `Sketch created on Face ${faceId + 1}` });
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

    if (
      (project.features.length > 0 || project.sketches.length > 0) &&
      (project.version !== lastRebuiltVersion.current || lastRebuiltVersion.current === 0)
    ) {
      lastRebuiltVersion.current = project.version;
      clearAllItemErrors();
      rebuild(project);
    }
  }, [project.id, project.version, occStatus, rebuild, project, clearAllItemErrors]);

  // Extrude dialog state
  const [extrudeDialogOpen, setExtrudeDialogOpen] = useState(false);
  const [extrudeIsCut, setExtrudeIsCut] = useState(false);

  // Handle entering sketch mode when a sketch tool is selected
  useEffect(() => {
    // Check if activeTool is a sketch tool
    const sketchTools: SketchTool[] = [
      'line',
      'rectangle',
      'circle',
      'polygon',
      'arc',
      'ellipse',
      'spline',
      'bezier',
    ];

    if (activeTool && sketchTools.includes(activeTool as SketchTool)) {
      // If no active sketch, create a new one
      if (!activeSketchId) {
        const plane: SketchPlane = {
          type: 'xy',
          planeRef: 'front-plane',
          offset: 0,
        };
        const newSketch = addSketch(`Sketch ${project.sketches.length + 1}`, plane);
        startSketchEdit(newSketch.id);
        notifications.show({ color: 'blue', message: 'Sketch mode active' });
      }
    }
  }, [activeTool, activeSketchId, project.sketches.length, addSketch, startSketchEdit]);

  // Handle extrude tool selection
  useEffect(() => {
    if (activeTool === 'extrude-boss' || activeTool === 'extruded-cut') {
      // Check if there are any closed sketches
      const closedSketches = project.sketches.filter((s) => s.isClosed);

      if (closedSketches.length === 0) {
        // No closed sketches - deselect tool and show error
        selectTool(null);
        notifications.show({
          color: 'yellow',
          title: 'No closed sketches',
          message: 'Create a closed sketch (rectangle, circle, etc.) before extruding.',
        });
        return;
      }

      // Exit sketch mode before opening extrude dialog
      if (activeSketchId) {
        stopSketchEdit();
      }

      setExtrudeIsCut(activeTool === 'extruded-cut');
      setExtrudeDialogOpen(true);
    }
  }, [activeTool, project.sketches, activeSketchId, stopSketchEdit, selectTool]);

  // Handle extrude confirmation
  const handleExtrudeConfirm = (sketchId: string, params: ExtrudeParams) => {
    // Create feature in state
    const featureName = extrudeIsCut
      ? `Cut-Extrude${project.features.length + 1}`
      : `Boss-Extrude${project.features.length + 1}`;

    const feature = addFeature(
      featureName,
      extrudeIsCut ? 'extruded-cut' : 'extrude-boss',
      params,
      sketchId,
      [sketchId]
    );

    // Trigger OpenCascade operation
    extrudeSketch(feature.id, sketchId, params);

    // Deselect tool
    selectTool(null);
    notifications.show({ color: 'green', message: `${extrudeIsCut ? 'Cut' : 'Extrude'} feature created` });
  };

  // Handle sketch update
  const handleUpdateSketch = (sketchId: string, elements: SketchElement[]) => {
    updateSketchElements(sketchId, elements);

    // Build the sketch in the worker so it's available for extrusion
    const sketch = project.sketches.find(s => s.id === sketchId);
    if (sketch && elements.length > 0) {
      buildSketch(sketchId, sketch.plane, elements);
    }
  };

  // Handle finish sketch
  const handleFinishSketch = () => {
    // Build the final sketch state in the worker
    if (activeSketchId) {
      const sketch = project.sketches.find(s => s.id === activeSketchId);
      if (sketch && sketch.elements.length > 0) {
        buildSketch(sketch.id, sketch.plane, sketch.elements);
      }
    }

    stopSketchEdit();
    selectTool(null); // Deselect tool
    notifications.show({ color: 'green', message: 'Sketch completed' });
  };

  // Handle cancel sketch
  const handleCancelSketch = () => {
    stopSketchEdit();
    selectTool(null); // Deselect tool
    notifications.show({ color: 'blue', message: 'Sketch cancelled' });
  };

  // Handle face click from viewport
  const handleFaceClick = (faceId: number) => {
    // Clear all other selections and set face selection
    selectTreeItem(null);
    setSelectedFaceId(faceId);
    setSelectedEdgeIndex(null);
    setSelectedVertexIndex(null);
  };

  // Handle edge click from viewport
  const handleEdgeClick = (edgeIndex: number) => {
    // Clear all other selections and set edge selection
    selectTreeItem(null);
    setSelectedFaceId(null);
    setSelectedEdgeIndex(edgeIndex);
    setSelectedVertexIndex(null);
  };

  // Handle vertex click from viewport
  const handleVertexClick = (vertexIndex: number) => {
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
    if (selectedPlane && selectedPlane.type === 'plane') {
      // Create a new sketch on the selected plane
      let planeType: 'xy' | 'xz' | 'yz' = 'xy';
      if (selectedPlane.id === 'front-plane') planeType = 'xy';
      else if (selectedPlane.id === 'top-plane') planeType = 'xz';
      else if (selectedPlane.id === 'right-plane') planeType = 'yz';

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

      {/* Combined Header: HeaderBar + FeatureTabs */}
      <AppShell.Header
        style={{
          border: 'none',
          backgroundColor: theme.other.colors.cadHeader,
        }}
      >
        <Box ref={headerRef}>
          <HeaderBar
            projectName={project.name}
            onNew={handleNew}
            onOpen={handleOpen}
            onSave={handleSave}
            onExport={handleExport}
          />
          <FeatureTabs
            activeTab={activeTab}
            activeTool={activeTool}
            selectedTreeItem={selectedTreeItem}
            activeSketchId={activeSketchId}
            onTabChange={switchTab}
            onToolSelect={selectTool}
            onSketchButtonClick={handleSketchButtonClick}
          />
        </Box>
      </AppShell.Header>

      {/* Left Sidebar - Feature Tree */}
      <AppShell.Navbar
        style={{
          borderRight: `1px solid ${theme.other.colors.border}`,
          backgroundColor: theme.other.colors.sidebarBackground,
          transition: 'all 300ms ease-in-out',
          overflow: 'hidden',
        }}
      >
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
          onEdit={editTreeItem}
          onDelete={deleteTreeItem}
          onHoverItem={setHoveredTreeItem}
          isCompact={!isSidebarOpen}
          onToggleSidebar={toggleSidebar}
        />
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
            activeTool={activeTool as SketchTool}
            selectedTreeItem={selectedTreeItem}
            hoveredTreeItem={hoveredTreeItem}
            selectedFaceId={selectedFaceId}
            selectedEdgeIndex={selectedEdgeIndex}
            selectedVertexIndex={selectedVertexIndex}
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
            onFaceHover={setHoveredFaceId}
            onEdgeHover={setHoveredEdgeIndex}
            onBackgroundClick={handleBackgroundClick}
          />

          {/* Entities Panel */}
          <EntitiesPanel
            mesh={occMesh}
            selectedFaceId={selectedFaceId}
            selectedEdgeIndex={selectedEdgeIndex}
            hoveredFaceId={hoveredFaceId}
            hoveredEdgeIndex={hoveredEdgeIndex}
            onFaceClick={handleFaceClick}
            onEdgeClick={handleEdgeClick}
            onFaceHover={setHoveredFaceId}
            onEdgeHover={setHoveredEdgeIndex}
          />
        </Box>
      </AppShell.Main>

      {/* Extrude Dialog */}
      <ExtrudeDialog
        open={extrudeDialogOpen}
        onOpenChange={setExtrudeDialogOpen}
        sketches={project.sketches}
        selectedSketchId={selectedTreeItem || undefined}
        isCut={extrudeIsCut}
        onConfirm={handleExtrudeConfirm}
      />
    </AppShell>
  );
}