import { Box, FolderOpen, Save, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeaderBarProps {
  projectName: string;
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
}

export function HeaderBar({ projectName, onOpen, onSave, onExport }: HeaderBarProps) {
  return (
    <header className="flex h-10 items-center justify-between border-b border-border bg-cad-header px-3">
      {/* Left section - Logo and App Name */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
          <Box className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold text-cad-header-foreground">
          CAD Studio
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          {projectName}
        </span>
      </div>

      {/* Right section - File operations */}
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                onClick={onOpen}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="sr-only">Open</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Open Project</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                onClick={onSave}
              >
                <Save className="h-4 w-4" />
                <span className="sr-only">Save</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Save Project</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-cad-header-foreground hover:bg-secondary hover:text-foreground"
                onClick={onExport}
              >
                <Download className="h-4 w-4" />
                <span className="sr-only">Export</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Export as JSON</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </header>
  );
}