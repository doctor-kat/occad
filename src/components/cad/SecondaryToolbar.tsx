import { 
  RotateCcw, 
  RotateCw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Grid3X3,
  Eye,
  Move3D
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

interface ToolbarButton {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const toolbarButtons: ToolbarButton[][] = [
  [
    { icon: <RotateCcw className="h-4 w-4" />, label: 'Undo' },
    { icon: <RotateCw className="h-4 w-4" />, label: 'Redo' },
  ],
  [
    { icon: <ZoomIn className="h-4 w-4" />, label: 'Zoom In' },
    { icon: <ZoomOut className="h-4 w-4" />, label: 'Zoom Out' },
    { icon: <Maximize2 className="h-4 w-4" />, label: 'Fit to View' },
  ],
  [
    { icon: <Grid3X3 className="h-4 w-4" />, label: 'Toggle Grid' },
    { icon: <Eye className="h-4 w-4" />, label: 'View Options' },
    { icon: <Move3D className="h-4 w-4" />, label: 'Pan/Rotate' },
  ],
];

export function SecondaryToolbar() {
  return (
    <div className="flex h-9 items-center gap-1 border-b border-border bg-cad-toolbar px-2">
      <TooltipProvider delayDuration={300}>
        {toolbarButtons.map((group, groupIndex) => (
          <div key={groupIndex} className="flex items-center">
            {groupIndex > 0 && (
              <Separator orientation="vertical" className="mx-1 h-5 bg-cad-divider" />
            )}
            {group.map((button, buttonIndex) => (
              <Tooltip key={buttonIndex}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-cad-toolbar-foreground hover:bg-secondary hover:text-foreground"
                    onClick={button.onClick}
                  >
                    {button.icon}
                    <span className="hidden text-xs sm:inline">{button.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{button.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ))}
      </TooltipProvider>
    </div>
  );
}