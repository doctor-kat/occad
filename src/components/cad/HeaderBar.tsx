import { 
  Box, 
  FolderOpen, 
  Save, 
  Download, 
  RotateCcw, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Grid3X3,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

interface HeaderBarProps {
  projectName: string;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
}

export function HeaderBar({ projectName, onOpen, onSave, onExport }: HeaderBarProps) {
  return (
    <header className="gradient-border flex h-12 items-center justify-between bg-cad-header px-4">
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-4">
          {/* Logo and App Name */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg shadow-lg shadow-primary/20">
              <Box className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight gradient-text">
                CAD Studio
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">
                {projectName}
              </span>
            </div>
          </div>

          <Separator orientation="vertical" className="h-6 bg-cad-divider" />

          {/* File operations */}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-3 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                  onClick={onOpen}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="hidden text-xs sm:inline">Open</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open Project</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-3 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                  onClick={onSave}
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden text-xs sm:inline">Save</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Save Project</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 px-3 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                  onClick={onExport}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden text-xs sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export as JSON</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6 bg-cad-divider" />

          {/* View controls */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Undo</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Redo</TooltipContent>
            </Tooltip>

            <div className="mx-1 h-4 w-px bg-cad-divider" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Zoom Out</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Zoom In</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Fit to View</TooltipContent>
            </Tooltip>

            <div className="mx-1 h-4 w-px bg-cad-divider" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Toggle Grid</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">View Options</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
    </header>
  );
}