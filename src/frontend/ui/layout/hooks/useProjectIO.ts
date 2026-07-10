import { useRef } from 'react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { CADProject, Operation, ImportFormat, ImportParams, ExportFormat } from '@/cad/types';
import { FeatureOperation, EXPORT_EXTENSIONS } from '@/cad/types';
import { parseIoOperation } from '../ioOperations';

interface UseProjectIOArgs {
  project: CADProject;
  currentFeatureShapeId: string | null;
  exportShape: (requestId: string, shapeId: string, format: ExportFormat, fileName: string) => void;
  addFeature: (name: string, type: FeatureOperation, params?: any) => void;
  selectOperation: (operation: Operation | null) => void;
  importProject: (file: File) => void;
  newProject: () => void;
  saveProject: () => void;
  exportProject: () => void;
}

// File-system-adjacent I/O: project new/open/save/export, and CAD geometry
// import/export (STEP/IGES/OBJ/STL), including the hidden <input> refs that
// drive the OS file pickers.
export function useProjectIO({
  project,
  currentFeatureShapeId,
  exportShape,
  addFeature,
  selectOperation,
  importProject,
  newProject,
  saveProject,
  exportProject,
}: UseProjectIOArgs) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cadImportInputRef = useRef<HTMLInputElement>(null);
  const pendingImportFormat = useRef<ImportFormat | null>(null);

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

  const handleCadExport = (format: ExportFormat) => {
    if (!currentFeatureShapeId) {
      notifications.show({ color: 'red', title: 'Nothing to export', message: 'Build a feature first' });
      return;
    }
    const requestId = crypto.randomUUID();
    const baseName = (project.name || 'model').replace(/\s+/g, '_');
    exportShape(requestId, currentFeatureShapeId, format, `${baseName}.${EXPORT_EXTENSIONS[format]}`);
    notifications.show({ color: 'blue', message: `Exporting ${format.toUpperCase()}…` });
  };

  // Intercept I/O operations (they act immediately — no OperationPanel), and
  // pass everything else through to the normal operation selection.
  const handleOperationSelect = (operation: Operation) => {
    const io = operation ? parseIoOperation(operation as string) : null;
    if (io?.direction === 'import') {
      pendingImportFormat.current = io.format;
      cadImportInputRef.current?.click();
      return;
    }
    if (io?.direction === 'export') {
      handleCadExport(io.format);
      return;
    }
    selectOperation(operation);
  };

  const handleCadImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const format = pendingImportFormat.current;
    e.target.value = '';
    pendingImportFormat.current = null;
    if (!file || !format) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      const params: ImportParams = { format, fileName: file.name, content };
      addFeature(`Import ${file.name}`, FeatureOperation.IMPORT, params);
      notifications.show({ color: 'green', message: `Imported ${file.name}` });
    };
    reader.onerror = () => {
      notifications.show({ color: 'red', title: 'Import failed', message: `Could not read ${file.name}` });
    };
    reader.readAsText(file);
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

  return {
    fileInputRef,
    cadImportInputRef,
    handleOpen,
    handleFileChange,
    handleOperationSelect,
    handleCadImportFileChange,
    handleNew,
    handleSave,
    handleExport,
  };
}
