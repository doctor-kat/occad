import { 
  ArrowUpFromLine,
  RotateCcw as Revolve,
  Scissors,
  CircleDot,
  CornerDownRight,
  Minus,
  Square,
  Circle,
  Hexagon,
  ArrowRight,
  Ruler
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ToolCategory, Tool, FeatureTool, SketchTool, EvaluateTool } from '@/types/cad';
import { cn } from '@/lib/utils';

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  toolId: Tool;
  isActive: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, isActive, onClick }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-auto flex-col gap-1 px-3 py-2 text-cad-toolbar-foreground hover:bg-secondary hover:text-foreground',
            isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
          )}
          onClick={onClick}
        >
          {icon}
          <span className="text-[10px] leading-tight">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface FeatureTabsProps {
  activeTab: ToolCategory;
  activeTool: Tool;
  onTabChange: (tab: ToolCategory) => void;
  onToolSelect: (tool: Tool) => void;
}

const featureTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'extrude-boss', icon: <ArrowUpFromLine className="h-5 w-5" />, label: 'Extrude Boss/Base' },
  { id: 'revolved-boss', icon: <Revolve className="h-5 w-5" />, label: 'Revolved Boss/Base' },
];

const cutTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'extruded-cut', icon: <Scissors className="h-5 w-5" />, label: 'Extruded Cut' },
  { id: 'revolved-cut', icon: <CircleDot className="h-5 w-5" />, label: 'Revolved Cut' },
];

const modifyTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'fillet', icon: <CornerDownRight className="h-5 w-5" />, label: 'Fillet' },
  { id: 'chamfer', icon: <Minus className="h-5 w-5 rotate-45" />, label: 'Chamfer' },
];

const sketchTools: { id: SketchTool; icon: React.ReactNode; label: string }[] = [
  { id: 'line', icon: <Minus className="h-5 w-5" />, label: 'Line' },
  { id: 'rectangle', icon: <Square className="h-5 w-5" />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle className="h-5 w-5" />, label: 'Circle' },
  { id: 'polygon', icon: <Hexagon className="h-5 w-5" />, label: 'Polygon' },
  { id: 'arc', icon: <ArrowRight className="h-5 w-5" />, label: 'Arc' },
];

const evaluateTools: { id: EvaluateTool; icon: React.ReactNode; label: string }[] = [
  { id: 'measure', icon: <Ruler className="h-5 w-5" />, label: 'Measure' },
];

export function FeatureTabs({ activeTab, activeTool, onTabChange, onToolSelect }: FeatureTabsProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tabs 
        value={activeTab} 
        onValueChange={(v) => onTabChange(v as ToolCategory)}
        className="w-full"
      >
        <TabsList className="h-8 w-full justify-start gap-0 rounded-none border-b border-border bg-cad-toolbar p-0">
          <TabsTrigger
            value="features"
            className="h-8 rounded-none border-b-2 border-transparent px-4 text-xs text-cad-toolbar-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
          >
            Features
          </TabsTrigger>
          <TabsTrigger
            value="sketch"
            className="h-8 rounded-none border-b-2 border-transparent px-4 text-xs text-cad-toolbar-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
          >
            Sketch
          </TabsTrigger>
          <TabsTrigger
            value="evaluate"
            className="h-8 rounded-none border-b-2 border-transparent px-4 text-xs text-cad-toolbar-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
          >
            Evaluate
          </TabsTrigger>
        </TabsList>

        <div className="border-b border-border bg-cad-toolbar px-2 py-1">
          <TabsContent value="features" className="m-0 flex items-center gap-1">
            {/* Boss/Base tools */}
            <div className="flex items-center">
              {featureTools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  icon={tool.icon}
                  label={tool.label}
                  toolId={tool.id}
                  isActive={activeTool === tool.id}
                  onClick={() => onToolSelect(tool.id)}
                />
              ))}
            </div>

            <Separator orientation="vertical" className="mx-1 h-12 bg-cad-divider" />

            {/* Cut tools */}
            <div className="flex items-center">
              {cutTools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  icon={tool.icon}
                  label={tool.label}
                  toolId={tool.id}
                  isActive={activeTool === tool.id}
                  onClick={() => onToolSelect(tool.id)}
                />
              ))}
            </div>

            <Separator orientation="vertical" className="mx-1 h-12 bg-cad-divider" />

            {/* Modify tools */}
            <div className="flex items-center">
              {modifyTools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  icon={tool.icon}
                  label={tool.label}
                  toolId={tool.id}
                  isActive={activeTool === tool.id}
                  onClick={() => onToolSelect(tool.id)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sketch" className="m-0 flex items-center gap-1">
            {sketchTools.map((tool) => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                toolId={tool.id}
                isActive={activeTool === tool.id}
                onClick={() => onToolSelect(tool.id)}
              />
            ))}
          </TabsContent>

          <TabsContent value="evaluate" className="m-0 flex items-center gap-1">
            {evaluateTools.map((tool) => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                toolId={tool.id}
                isActive={activeTool === tool.id}
                onClick={() => onToolSelect(tool.id)}
              />
            ))}
          </TabsContent>
        </div>
      </Tabs>
    </TooltipProvider>
  );
}