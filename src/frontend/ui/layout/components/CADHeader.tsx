import { useState } from 'react';
import { AppShell, Box } from '@mantine/core';
import { Toolbar } from '../../Toolbar';
import { OperationsBar } from '../../operations/OperationsBar';
import { VersionHistoryDrawer } from '../../history/VersionHistoryDrawer';
import { SettingsModal } from '../../settings/SettingsModal';
import { useCADLayoutContext } from '../CADLayoutContext';
import { useViewportStore } from '@/frontend/shared/viewportStore';
import { useProjectStore } from '@/frontend/shared/projectStore';
import { useProject } from '@/frontend/shared/useProjectState';
import { projectApi } from '@/frontend/shared/projectApi';

// Combined Header: Toolbar (file/undo-redo) + OperationsBar (tabs/operation icons).
export function CADHeader() {
  const { theme, headerRef, tessellationLevel, setTessellationLevel, sketchPlaneSelection, projectIO } = useCADLayoutContext();
  const project = useProject();
  const activeTab = useViewportStore((s) => s.activeTab);
  const activeOperation = useViewportStore((s) => s.activeOperation);
  const selectedTreeItem = useViewportStore((s) => s.selectedTreeItem);
  const activeSketchId = useViewportStore((s) => s.activeSketchId);
  const switchTab = useViewportStore((s) => s.switchTab);
  const canUndo = useProjectStore((s) => s.canUndo);
  const canRedo = useProjectStore((s) => s.canRedo);
  const { undo, redo } = projectApi;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <AppShell.Header
      style={{
        border: 'none',
        backgroundColor: theme.other.colors.cadHeader,
      }}
    >
      <Box ref={headerRef}>
        <Toolbar
          projectName={project.name}
          onNew={projectIO.handleNew}
          onOpen={projectIO.handleOpen}
          onSave={projectIO.handleSave}
          onExport={projectIO.handleExport}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          tessellationLevel={tessellationLevel}
          onTessellationLevelChange={setTessellationLevel}
        />
        <OperationsBar
          activeTab={activeTab}
          activeOperation={activeOperation}
          selectedTreeItem={selectedTreeItem}
          activeSketchId={activeSketchId}
          onTabChange={switchTab}
          onOperationSelect={projectIO.handleOperationSelect}
          onSketchButtonClick={sketchPlaneSelection.handleSketchButtonClick}
        />
      </Box>
      <VersionHistoryDrawer opened={historyOpen} onClose={() => setHistoryOpen(false)} />
      <SettingsModal opened={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </AppShell.Header>
  );
}
