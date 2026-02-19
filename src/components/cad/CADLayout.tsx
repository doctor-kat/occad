import { useRef, useEffect, useState } from 'react';
import { HeaderBar } from './HeaderBar';
import { FeatureTabs } from './FeatureTabs';
import { FeatureTree } from './FeatureTree';
import { CADViewport } from './CADViewport';
import { OperationPanel } from './OperationPanel';
import { EntitiesPanel } from './EntitiesPanel';
import { useCADState } from '@/hooks/useCADState';
import { useOpenCascade } from '@/hooks/useOpenCascade';
import { useViewportStore } from '@/stores/viewportStore';
import { AppShell, Box, useMantineTheme, Tabs, Center, Tooltip, ActionIcon, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { Cube, Polygon } from '@phosphor-icons/react';
import type { SketchElement, SketchTool, SketchPlane, ExtrudeParams } from '@/types/cad';

export function CADLayout() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(164);
  const theme = useMantineTheme();
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>('features');

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
    onFeatureBuilt: (featureId, meshData) => {
      notifications.show({ color: 'green', message: 'Feature built successfully' });
    },
    onRebuildComplete: (meshData) => {
      notifications.show({ color: 'green', message: 'Rebuild complete' });
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

  // Extrude operation state
  const [extrudeActive, setExtrudeActive] = useState(false);
  const [extrudeIsCut, setExtrudeIsCut] = useState(false);
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);

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

      // Exit sketch mode before opening extrude panel
      if (activeSketchId) {
        stopSketchEdit();
      }

      setExtrudeIsCut(activeTool === 'extruded-cut');
      setExtrudeActive(true);
      setEditingFeatureId(null); // Reset editing ID for new feature
      // Ensure sidebar is open when operation is active
      if (!isSidebarOpen) toggleSidebar();
    }
  }, [activeTool, project.sketches, activeSketchId, stopSketchEdit, selectTool, isSidebarOpen, toggleSidebar]);

  // Handle box tool selection
  useEffect(() => {
    if (activeTool === 'box') {
      addFeature(`Box${project.features.length + 1}`, 'box', {
        width: 50,
        height: 50,
        depth: 50,
        center: { x: 0, y: 0, z: 0 },
      });
      selectTool(null);
      notifications.show({ color: 'green', message: 'Box created' });
    }
  }, [activeTool, project.features.length, addFeature, selectTool]);

  // Handle extrude confirmation
  const handleExtrudeConfirm = (sketchId: string, params: ExtrudeParams) => {
    if (editingFeatureId) {
      // Update existing feature
      const feature = project.features.find((f) => f.id === editingFeatureId);
      if (feature) {
        updateFeatureParameters(editingFeatureId, params);
        notifications.show({ color: 'green', message: `${feature.name} updated` });
      }
    } else {
      // Create new feature
      const featureName = extrudeIsCut
        ? `Cut-Extrude${project.features.length + 1}`
        : `Boss-Extrude${project.features.length + 1}`;

      addFeature(
        featureName,
        extrudeIsCut ? 'extruded-cut' : 'extrude-boss',
        params,
        sketchId,
        [sketchId]
      );
      notifications.show({ color: 'green', message: `${extrudeIsCut ? 'Cut' : 'Extrude'} feature created` });
    }

    selectTool(null);
    setExtrudeActive(false);
    setEditingFeatureId(null);
  };

  const handleExtrudeCancel = () => {
    selectTool(null);
    setExtrudeActive(false);
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
    if (feature && (feature.type === 'extrude-boss' || feature.type === 'extruded-cut')) {
      setEditingFeatureId(id);
      setExtrudeIsCut(feature.type === 'extruded-cut');
      setExtrudeActive(true);
      // Ensure sidebar is open
      if (!isSidebarOpen) toggleSidebar();
      return;
    }

    // Default to generic edit logic
    editTreeItem(id);
  };

  // Handle sketch update
  const handleUpdateSketch = (sketchId: string, elements: SketchElement[]) => {
    updateSketchElements(sketchId, elements);
  };

  // Handle finish sketch
  const handleFinishSketch = () => {
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
    // Switch to entities tab if not already there
    setActiveSidebarTab('entities');
  };

  // Handle edge click from viewport
  const handleEdgeClick = (edgeIndex: number) => {
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

      {/* Left Sidebar - Dynamic Panel */}
      <AppShell.Navbar
        style={{
          borderRight: `1px solid ${theme.other.colors.border}`,
          backgroundColor: theme.other.colors.sidebarBackground,
          transition: 'all 300ms ease-in-out',
          overflow: 'hidden',
        }}
      >
        {extrudeActive ? (
          <OperationPanel
            title={editingFeatureId ? `Edit ${project.features.find(f => f.id === editingFeatureId)?.name}` : (extrudeIsCut ? 'Extruded Cut' : 'Extrude Boss')}
            sketches={project.sketches}
            selectedSketchId={editingFeatureId ? (project.features.find(f => f.id === editingFeatureId)?.sketchId) : (selectedTreeItem || undefined)}
            initialParams={editingFeatureId ? (project.features.find(f => f.id === editingFeatureId)?.parameters as ExtrudeParams) : undefined}
            isCut={extrudeIsCut}
            onConfirm={handleExtrudeConfirm}
            onCancel={handleExtrudeCancel}
          />
        ) : (
          <Tabs
            variant="unstyled"
            value={activeSidebarTab}
            onChange={setActiveSidebarTab}
            styles={{
              root: { display: 'flex', flexDirection: 'column', height: '100%' },
              panel: { flex: 1, overflow: 'hidden' },
              list: {
                display: 'flex',
                padding: isSidebarOpen ? '0 12px' : '8px 0',
                borderBottom: `1px solid ${theme.other.colors.sidebarBorder}`,
                backgroundColor: theme.other.colors.sidebarBackground,
                gap: 0,
              },
              tab: {
                flex: isSidebarOpen ? 1 : 'none',
                height: 40,
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
                '&[data-active]': {
                  color: theme.colors.blue[5],
                  borderBottomColor: theme.colors.blue[5],
                  backgroundColor: `${theme.colors.blue[5]}10`,
                },
                '&:hover:not([data-active])': {
                  backgroundColor: `${theme.colors.gray[5]}10`,
                }
              }
            }}
          >
            <Tabs.List>
              <Tabs.Tab
                value="features"
              >
                {isSidebarOpen ? (
                  <Group gap={6} wrap="nowrap">
                    <Cube size={16} />
                    <span>Features</span>
                  </Group>
                ) : (
                  <Tooltip label="Features" position="right">
                    <Center><Cube size={20} /></Center>
                  </Tooltip>
                )}
              </Tabs.Tab>
              <Tabs.Tab
                value="entities"
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

            <Tabs.Panel value="features">
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
        )}
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
          />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}