import { RefObject } from 'react';
import { AppShell, Box, MantineTheme } from '@mantine/core';
import { Toolbar } from '../../Toolbar';
import { OperationsBar } from '../../operations/OperationsBar';
import type { Operation, TessellationLevel, OperationCategory } from '@/cad/types';

interface CADHeaderProps {
  headerRef: RefObject<HTMLDivElement>;
  theme: MantineTheme;
  projectName: string;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  tessellationLevel: TessellationLevel;
  onTessellationLevelChange: (level: TessellationLevel) => void;
  activeTab: OperationCategory;
  activeOperation: Operation | null;
  selectedTreeItem: string | null;
  activeSketchId: string | null;
  onTabChange: (tab: OperationCategory) => void;
  onOperationSelect: (operation: Operation) => void;
  onSketchButtonClick: () => void;
}

// Combined Header: Toolbar (file/undo-redo) + OperationsBar (tabs/operation icons).
export function CADHeader({
  headerRef,
  theme,
  projectName,
  onNew,
  onOpen,
  onSave,
  onExport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  tessellationLevel,
  onTessellationLevelChange,
  activeTab,
  activeOperation,
  selectedTreeItem,
  activeSketchId,
  onTabChange,
  onOperationSelect,
  onSketchButtonClick,
}: CADHeaderProps) {
  return (
    <AppShell.Header
      style={{
        border: 'none',
        backgroundColor: theme.other.colors.cadHeader,
      }}
    >
      <Box ref={headerRef}>
        <Toolbar
          projectName={projectName}
          onNew={onNew}
          onOpen={onOpen}
          onSave={onSave}
          onExport={onExport}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          tessellationLevel={tessellationLevel}
          onTessellationLevelChange={onTessellationLevelChange}
        />
        <OperationsBar
          activeTab={activeTab}
          activeOperation={activeOperation}
          selectedTreeItem={selectedTreeItem}
          activeSketchId={activeSketchId}
          onTabChange={onTabChange}
          onOperationSelect={onOperationSelect}
          onSketchButtonClick={onSketchButtonClick}
        />
      </Box>
    </AppShell.Header>
  );
}
