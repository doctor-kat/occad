import { useRef } from 'react';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { HeaderBar } from './HeaderBar';
import { FeatureTabs } from './FeatureTabs';
import { FeatureTree } from './FeatureTree';
import { CanvasPlaceholder } from './CanvasPlaceholder';
import { useCADState } from '@/hooks/useCADState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Combined Header Bar */}
        <HeaderBar
          projectName={project.name}
          onOpen={handleOpen}
          onSave={handleSave}
          onExport={handleExport}
        />

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
              'flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out',
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
          <div className="relative z-20">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'absolute top-3 h-8 w-8 rounded-lg border border-border bg-card shadow-md',
                    'hover:bg-secondary transition-all duration-200',
                    isSidebarOpen ? '-left-4' : 'left-2'
                  )}
                  onClick={toggleSidebar}
                >
                  {isSidebarOpen ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isSidebarOpen ? 'Hide Feature Tree' : 'Show Feature Tree'}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Main Canvas Area */}
          <main className="flex-1 overflow-hidden">
            <CanvasPlaceholder />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}