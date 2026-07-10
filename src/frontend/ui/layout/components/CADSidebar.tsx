import {
  AppShell, Box, Tabs, Center, Tooltip, ActionIcon, Group, Stack,
} from '@mantine/core';
import { FeatureTree } from '../../FeatureTree/FeatureTree';
import { OperationPanel } from '../../operations/OperationPanel';
import { EntitiesPanel } from '../../EntitiesPanel';
import { SketchEntitiesPanel } from '../../SketchEntitiesPanel';
import { MeasurePanel } from '../../MeasurePanel';
import { FeatureTreeIcon, EntitiesIcon, MeasureIcon } from '@/frontend/shared/icons';
import { OperationCategory } from '@/cad/types';
import type { FeatureOperation, TransformOperation, SketchOperation } from '@/cad/types';
import { useCADLayoutContext } from '../CADLayoutContext';
import { useCadLayoutUiStore } from '../cadLayoutUiStore';

// Left Sidebar: OperationPanel (when a non-sketch operation is active) stacked
// above a Feature Tree / Entities / Measure tab set. Reads its own UI state
// (active tab, operation-panel open/edit, measurement) straight from
// cadLayoutUiStore so unrelated changes elsewhere don't re-render it, and
// everything else (project, handlers) from CADLayoutContext.
export function CADSidebar() {
  const {
    theme, cadState, activeSketch, occ, sketchEditing, viewportSelection, operationPanel, onSelectTreeItem,
  } = useCADLayoutContext();
  const {
    project, isSidebarOpen, toggleSidebar, selectedTreeItem, activeSketchId, activeOperation, featureTree,
    toggleTreeItemExpansion, toggleTreeItemVisibility, deleteTreeItem, reorderFeatureRelative,
    rollbackBarIndex, moveRollbackBar,
  } = cadState;

  const activeSidebarTab = useCadLayoutUiStore((s) => s.activeSidebarTab);
  const setActiveSidebarTab = useCadLayoutUiStore((s) => s.setActiveSidebarTab);
  const operationPanelOpen = useCadLayoutUiStore((s) => s.operationPanelOpen);
  const editingFeatureId = useCadLayoutUiStore((s) => s.editingFeatureId);
  const measurementData = useCadLayoutUiStore((s) => s.measurement);
  const measurePicks = useCadLayoutUiStore((s) => s.measurePicks);
  const betweenMeasurement = useCadLayoutUiStore((s) => s.betweenMeasurement);
  const setMeasurePicks = useCadLayoutUiStore((s) => s.setMeasurePicks);
  const setBetweenMeasurement = useCadLayoutUiStore((s) => s.setBetweenMeasurement);

  return (
    <AppShell.Navbar
      style={{
        borderRight: `1px solid ${theme.other.colors.border}`,
        backgroundColor: theme.other.colors.sidebarBackground,
        transition: 'background-color 300ms ease-in-out, border-color 300ms ease-in-out',
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
              onResolveSelector={occ.resolveSelectorAsync}
              onConfirm={operationPanel.handleOperationConfirm}
              onCancel={operationPanel.handleOperationCancel}
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
                transition: 'color 200ms, border-bottom-color 200ms',
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
                    <FeatureTreeIcon size={16} />
                    <span>Feature Tree</span>
                  </Group>
                ) : (
                  <Tooltip label="Feature Tree" position="right">
                    <Center><FeatureTreeIcon size={20} /></Center>
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
                    <EntitiesIcon size={16} />
                    <span>Entities</span>
                  </Group>
                ) : (
                  <Tooltip label="Entities" position="right">
                    <Center><EntitiesIcon size={20} /></Center>
                  </Tooltip>
                )}
              </Tabs.Tab>
              <Tabs.Tab
                value="measure"
                data-testid="measure-tab"
                style={{
                  transition: 'background-color 200ms, border-color 200ms, color 200ms',
                  ...(activeSidebarTab === 'measure' && {
                    color: theme.colors.blue[5],
                    borderBottomColor: theme.colors.blue[5],
                    backgroundColor: `${theme.colors.blue[5]}15`,
                  })
                }}
              >
                {isSidebarOpen ? (
                  <Group gap={6} wrap="nowrap">
                    <MeasureIcon size={16} />
                    <span>Measure</span>
                  </Group>
                ) : (
                  <Tooltip label="Measure" position="right">
                    <Center><MeasureIcon size={20} /></Center>
                  </Tooltip>
                )}
              </Tabs.Tab>

              {!isSidebarOpen && (
                <Box mt="auto" px={8} pb={8} style={{ width: '100%' }}>
                  <Tooltip label="Expand Sidebar" position="right">
                    <ActionIcon variant="subtle" color="gray" onClick={toggleSidebar} w="100%" h={40}>
                      <FeatureTreeIcon size={20} />
                    </ActionIcon>
                  </Tooltip>
                </Box>
              )}
            </Tabs.List>

            <Tabs.Panel value={OperationCategory.FEATURES}>
              <FeatureTree
                items={featureTree}
                selectedItem={selectedTreeItem}
                onSelectItem={onSelectTreeItem}
                onToggleExpand={toggleTreeItemExpansion}
                onToggleVisibility={toggleTreeItemVisibility}
                onEdit={operationPanel.handleEditTreeItem}
                onDelete={deleteTreeItem}
                isCompact={!isSidebarOpen}
                onToggleSidebar={toggleSidebar}
                onReorder={reorderFeatureRelative}
                rollbackBarIndex={rollbackBarIndex}
                onMoveRollbackBar={moveRollbackBar}
              />
            </Tabs.Panel>
            <Tabs.Panel value="entities">
              {!isSidebarOpen ? (
                <Stack gap={4} p={8} align="center">
                  <Tooltip label="Faces" position="right">
                    <ActionIcon variant="subtle" size="lg">
                      <EntitiesIcon size={20} />
                    </ActionIcon>
                  </Tooltip>
                </Stack>
              ) : activeSketchId ? (
                activeSketch ? (
                  <SketchEntitiesPanel
                    sketch={activeSketch}
                    onRemoveElement={sketchEditing.handleRemoveSketchElement}
                  />
                ) : null
              ) : (
                <EntitiesPanel
                  mesh={occ.occMesh}
                  onFaceClick={viewportSelection.handleFaceClick}
                  onEdgeClick={viewportSelection.handleEdgeClick}
                />
              )}
            </Tabs.Panel>
            <Tabs.Panel value="measure">
              <MeasurePanel
                measurement={measurementData}
                hasBody={!!occ.currentFeatureShapeId}
                picks={measurePicks}
                between={betweenMeasurement}
                onClearPicks={() => { setMeasurePicks([]); setBetweenMeasurement(null); }}
              />
            </Tabs.Panel>
          </Tabs>
        </Box>
      </Box>
    </AppShell.Navbar>
  );
}
