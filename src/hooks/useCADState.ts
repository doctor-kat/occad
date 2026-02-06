import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { 
  CADProject, 
  CADState, 
  Tool, 
  ToolCategory, 
  Sketch, 
  Feature,
  FeatureTreeItem,
  createNewProject 
} from '@/types/cad';

const STORAGE_KEY = 'cad-studio-project';

export function useCADState() {
  const [project, setProject] = useLocalStorage<CADProject>(STORAGE_KEY, createNewProject());
  const [activeTab, setActiveTab] = useState<ToolCategory>('features');
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [selectedTreeItem, setSelectedTreeItem] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Build the feature tree structure
  const featureTree = useMemo((): FeatureTreeItem[] => {
    const tree: FeatureTreeItem[] = [];

    // Reference Geometry group
    tree.push({
      id: 'ref-geometry-group',
      name: 'Reference Geometry',
      type: 'reference-geometry',
      isExpanded: true,
      children: project.referenceGeometry.map((ref) => ({
        id: ref.id,
        name: ref.name,
        type: 'reference-geometry' as const,
        data: ref,
      })),
    });

    // Sketches (standalone)
    project.sketches
      .filter((sketch) => !project.features.some((f) => f.sketchId === sketch.id))
      .forEach((sketch) => {
        tree.push({
          id: sketch.id,
          name: sketch.name,
          type: 'sketch',
          data: sketch,
        });
      });

    // Features (with their sketches as children)
    project.features.forEach((feature) => {
      const associatedSketch = project.sketches.find((s) => s.id === feature.sketchId);
      const featureItem: FeatureTreeItem = {
        id: feature.id,
        name: feature.name,
        type: 'feature',
        isExpanded: feature.isExpanded,
        data: feature,
      };

      if (associatedSketch) {
        featureItem.children = [
          {
            id: associatedSketch.id,
            name: associatedSketch.name,
            type: 'sketch',
            data: associatedSketch,
          },
        ];
      }

      tree.push(featureItem);
    });

    return tree;
  }, [project]);

  // Tool selection
  const selectTool = useCallback((tool: Tool) => {
    setActiveTool((current) => (current === tool ? null : tool));
  }, []);

  // Tab switching
  const switchTab = useCallback((tab: ToolCategory) => {
    setActiveTab(tab);
    setActiveTool(null);
  }, []);

  // Tree item selection
  const selectTreeItem = useCallback((id: string | null) => {
    setSelectedTreeItem((current) => (current === id ? null : id));
  }, []);

  // Toggle tree item expansion
  const toggleTreeItemExpansion = useCallback((id: string) => {
    // Check if it's the reference geometry group
    if (id === 'ref-geometry-group') {
      return; // Reference geometry is always expanded
    }

    // Check if it's a feature
    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      features: prev.features.map((f) =>
        f.id === id ? { ...f, isExpanded: !f.isExpanded } : f
      ),
    }));
  }, [setProject]);

  // Add a new sketch
  const addSketch = useCallback((name: string, plane: string = 'Front Plane') => {
    const newSketch: Sketch = {
      id: crypto.randomUUID(),
      name,
      plane,
      createdAt: Date.now(),
    };

    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      sketches: [...prev.sketches, newSketch],
    }));

    return newSketch;
  }, [setProject]);

  // Add a new feature
  const addFeature = useCallback((name: string, type: Feature['type'], sketchId?: string) => {
    const newFeature: Feature = {
      id: crypto.randomUUID(),
      name,
      type,
      sketchId,
      createdAt: Date.now(),
      isExpanded: true,
    };

    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      features: [...prev.features, newFeature],
    }));

    return newFeature;
  }, [setProject]);

  // Save project
  const saveProject = useCallback(() => {
    setProject((prev) => ({
      ...prev,
      updatedAt: Date.now(),
    }));
  }, [setProject]);

  // Create new project
  const newProject = useCallback(() => {
    setProject(createNewProject());
    setSelectedTreeItem(null);
    setActiveTool(null);
  }, [setProject]);

  // Export project as JSON
  const exportProject = useCallback(() => {
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportName = `${project.name.replace(/\s+/g, '_')}_${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
  }, [project]);

  // Import project from JSON
  const importProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as CADProject;
        setProject(imported);
      } catch (error) {
        console.error('Failed to import project:', error);
      }
    };
    reader.readAsText(file);
  }, [setProject]);

  // Toggle sidebar
  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  return {
    // State
    project,
    activeTab,
    activeTool,
    selectedTreeItem,
    isSidebarOpen,
    featureTree,
    
    // Actions
    selectTool,
    switchTab,
    selectTreeItem,
    toggleTreeItemExpansion,
    addSketch,
    addFeature,
    saveProject,
    newProject,
    exportProject,
    importProject,
    toggleSidebar,
  };
}