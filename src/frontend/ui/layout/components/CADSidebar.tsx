import {
  AppShell, Box, MantineTheme, Tabs, Center, Tooltip, ActionIcon, Group, Stack,
} from '@mantine/core';
import { FeatureTree } from '../../FeatureTree/FeatureTree';
import { OperationPanel } from '../../operations/OperationPanel';
import { EntitiesPanel } from '../../EntitiesPanel';
import { SketchEntitiesPanel } from '../../SketchEntitiesPanel';
import { MeasurePanel } from '../../MeasurePanel';
import { FeatureTreeIcon, EntitiesIcon, MeasureIcon } from '@/frontend/shared/icons';
import { OperationCategory } from '@/cad/types';
import type {
  CADProject, Sketch, Operation, OperationParams, StableRef, SubShapeKind,
  MeshData, MeasurementData, MeasureBetweenData, MeasureSelection, FeatureTreeItem,
} from '@/cad/types';

interface CADSidebarProps {
  theme: MantineTheme;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  project: CADProject;
  // Operation panel
  operationPanelOpen: boolean;
  activeOperation: Operation | null;
  editingFeatureId: string | null;
  selectedTreeItem: string | null;
  onResolveSelector: (kind: SubShapeKind, selector: string) => Promise<StableRef[]>;
  onOperationConfirm: (params: OperationParams, sketchId?: string) => void;
  onOperationCancel: () => void;
  // Sidebar tabs
  activeSidebarTab: string | null;
  setActiveSidebarTab: (tab: string | null) => void;
  // Feature tree
  featureTree: FeatureTreeItem[];
  onSelectTreeItem: (id: string) => void;
  onToggleTreeItemExpansion: (id: string) => void;
  onToggleTreeItemVisibility: (id: string) => void;
  onEditTreeItem: (id: string) => void;
  onDeleteTreeItem: (id: string) => void;
  onReorderFeature: (featureId: string, targetId: string, position: 'before' | 'after') => void;
  rollbackBarIndex: number;
  onMoveRollbackBar: (index: number) => void;
  // Entities
  activeSketchId: string | null;
  activeSketch: Sketch | undefined;
  onRemoveSketchElement: (elementId: string) => void;
  occMesh: MeshData | null;
  onFaceClick: (faceId: number) => void;
  onEdgeClick: (edgeIndex: number) => void;
  // Measure
  measurement: MeasurementData | null;
  currentFeatureShapeId: string | null;
  measurePicks: MeasureSelection[];
  betweenMeasurement: MeasureBetweenData | null;
  onClearMeasurePicks: () => void;
}

// Left Sidebar: OperationPanel (when a non-sketch operation is active) stacked
// above a Feature Tree / Entities / Measure tab set.
export function CADSidebar({
  theme,
  isSidebarOpen,
  toggleSidebar,
  project,
  operationPanelOpen,
  activeOperation,
  editingFeatureId,
  selectedTreeItem,
  onResolveSelector,
  onOperationConfirm,
  onOperationCancel,
  activeSidebarTab,
  setActiveSidebarTab,
  featureTree,
  onSelectTreeItem,
  onToggleTreeItemExpansion,
  onToggleTreeItemVisibility,
  onEditTreeItem,
  onDeleteTreeItem,
  onReorderFeature,
  rollbackBarIndex,
  onMoveRollbackBar,
  activeSketchId,
  activeSketch,
  onRemoveSketchElement,
  occMesh,
  onFaceClick,
  onEdgeClick,
  measurement,
  currentFeatureShapeId,
  measurePicks,
  betweenMeasurement,
  onClearMeasurePicks,
}: CADSidebarProps) {
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
              operation={activeOperation}
              project={project}
              initialParams={editingFeatureId ? (project.features.find(f => f.id === editingFeatureId)?.parameters) : undefined}
              initialSketchId={editingFeatureId ? (project.features.find(f => f.id === editingFeatureId)?.sketchId) : undefined}
              selectedTreeItem={selectedTreeItem}
              onResolveSelector={onResolveSelector}
              onConfirm={onOperationConfirm}
              onCancel={onOperationCancel}
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
                onToggleExpand={onToggleTreeItemExpansion}
                onToggleVisibility={onToggleTreeItemVisibility}
                onEdit={onEditTreeItem}
                onDelete={onDeleteTreeItem}
                isCompact={!isSidebarOpen}
                onToggleSidebar={toggleSidebar}
                onReorder={onReorderFeature}
                rollbackBarIndex={rollbackBarIndex}
                onMoveRollbackBar={onMoveRollbackBar}
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
                    onRemoveElement={onRemoveSketchElement}
                  />
                ) : null
              ) : (
                <EntitiesPanel
                  mesh={occMesh}
                  onFaceClick={onFaceClick}
                  onEdgeClick={onEdgeClick}
                />
              )}
            </Tabs.Panel>
            <Tabs.Panel value="measure">
              <MeasurePanel
                measurement={measurement}
                hasBody={!!currentFeatureShapeId}
                picks={measurePicks}
                between={betweenMeasurement}
                onClearPicks={onClearMeasurePicks}
              />
            </Tabs.Panel>
          </Tabs>
        </Box>
      </Box>
    </AppShell.Navbar>
  );
}
