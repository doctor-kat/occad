import { useRef } from 'react';
import { PanelLeft } from 'lucide-react';
import { HeaderBar } from './HeaderBar';
import { SecondaryToolbar } from './SecondaryToolbar';
import { FeatureTabs } from './FeatureTabs';
import { FeatureTree } from './FeatureTree';
import { CanvasPlaceholder } from './CanvasPlaceholder';
import { useCADState } from '@/hooks/useCADState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function CADLayout() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    project,
    activeTab,
    activeTool,
    selectedTreeItem,
    isSidebarOpen,
    featureTree,
    selectTool,
    switchTab,
    selectTreeItem,
    toggleTreeItemExpansion,
    saveProject,
    newProject,
    exportProject,
    importProject,
    toggleSidebar,
  } = useCADState();

  const handleOpen = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importProject(file);
      toast.success('Project imported successfully');
    }
    // Reset the input
    e.target.value = '';
  };

  const handleSave = () => {
    saveProject();
    toast.success('Project saved');
  };

  const handleExport = () => {
    exportProject();
    toast.success('Project exported');
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Header Bar */}
      <HeaderBar
        projectName={project.name}
        onOpen={handleOpen}
        onSave={handleSave}
        onExport={handleExport}
      />

      {/* Secondary Toolbar */}
      <SecondaryToolbar />

      {/* Feature Tabs */}
      <FeatureTabs
        activeTab={activeTab}
        activeTool={activeTool}
        onTabChange={switchTab}
        onToolSelect={selectTool}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Feature Tree */}
        <aside
          className={cn(
            'flex flex-col border-r border-border bg-sidebar transition-all duration-300',
            isSidebarOpen ? 'w-64' : 'w-0'
          )}
        >
          {isSidebarOpen && (
            <FeatureTree
              items={featureTree}
              selectedItem={selectedTreeItem}
              onSelectItem={selectTreeItem}
              onToggleExpand={toggleTreeItemExpansion}
            />
          )}
        </aside>

        {/* Sidebar Toggle Button */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-px top-2 z-10 h-7 w-7 rounded-l-none border border-l-0 border-border bg-card hover:bg-secondary"
            onClick={toggleSidebar}
          >
            <PanelLeft className={cn('h-4 w-4 transition-transform', !isSidebarOpen && 'rotate-180')} />
            <span className="sr-only">Toggle Sidebar</span>
          </Button>
        </div>

        {/* Main Canvas Area */}
        <main className="flex-1 overflow-hidden">
          <CanvasPlaceholder />
        </main>
      </div>
    </div>
  );
}