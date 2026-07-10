import { AppShell, Box } from '@mantine/core';
import { Toolbar } from '../../Toolbar';
import { OperationsBar } from '../../operations/OperationsBar';
import { useCADLayoutContext } from '../CADLayoutContext';

// Combined Header: Toolbar (file/undo-redo) + OperationsBar (tabs/operation icons).
export function CADHeader() {
  const { theme, headerRef, cadState, tessellationLevel, setTessellationLevel, sketchPlaneSelection, projectIO } = useCADLayoutContext();
  const { project, activeTab, activeOperation, selectedTreeItem, activeSketchId, switchTab, undo, redo, canUndo, canRedo } = cadState;

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
    </AppShell.Header>
  );
}
