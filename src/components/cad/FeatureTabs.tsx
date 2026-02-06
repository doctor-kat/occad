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
  color?: string;
}

function ToolButton({ icon, label, isActive, onClick, color }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-auto flex-col gap-1.5 px-3 py-2 transition-all duration-200',
            'text-secondary-foreground hover:bg-secondary/80 hover:text-foreground',
            isActive && 'bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/20 hover:text-primary'
          )}
          onClick={onClick}
        >
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
            color
          )}>
            {icon}
          </div>
          <span className="text-[10px] font-medium leading-tight max-w-[60px] text-center truncate">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="font-medium">
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
  { id: 'extrude-boss', icon: <ArrowUpFromLine className="h-4 w-4" />, label: 'Extrude Boss' },
  { id: 'revolved-boss', icon: <Revolve className="h-4 w-4" />, label: 'Revolve Boss' },
];

const cutTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'extruded-cut', icon: <Scissors className="h-4 w-4" />, label: 'Extrude Cut' },
  { id: 'revolved-cut', icon: <CircleDot className="h-4 w-4" />, label: 'Revolve Cut' },
];

const modifyTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'fillet', icon: <CornerDownRight className="h-4 w-4" />, label: 'Fillet' },
  { id: 'chamfer', icon: <Minus className="h-4 w-4 rotate-45" />, label: 'Chamfer' },
];

const sketchTools: { id: SketchTool; icon: React.ReactNode; label: string }[] = [
  { id: 'line', icon: <Minus className="h-4 w-4" />, label: 'Line' },
  { id: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle className="h-4 w-4" />, label: 'Circle' },
  { id: 'polygon', icon: <Hexagon className="h-4 w-4" />, label: 'Polygon' },
  { id: 'arc', icon: <ArrowRight className="h-4 w-4" />, label: 'Arc' },
];

const evaluateTools: { id: EvaluateTool; icon: React.ReactNode; label: string }[] = [
  { id: 'measure', icon: <Ruler className="h-4 w-4" />, label: 'Measure' },
];

export function FeatureTabs({ activeTab, activeTool, onTabChange, onToolSelect }: FeatureTabsProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="border-b border-border bg-cad-toolbar">
        <Tabs 
          value={activeTab} 
          onValueChange={(v) => onTabChange(v as ToolCategory)}
          className="w-full"
        >
          {/* Tabs + Tools in one row */}
          <div className="flex items-stretch">
            {/* Tab triggers on the left */}
            <TabsList className="h-auto shrink-0 flex-col items-stretch gap-0 rounded-none border-r border-border bg-transparent p-0">
              <TabsTrigger
                value="features"
                className={cn(
                  'h-10 rounded-none border-l-2 border-transparent px-4 text-xs font-semibold uppercase tracking-wider',
                  'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                  'data-[state=active]:border-l-primary data-[state=active]:bg-secondary/30 data-[state=active]:text-primary'
                )}
              >
                Features
              </TabsTrigger>
              <TabsTrigger
                value="sketch"
                className={cn(
                  'h-10 rounded-none border-l-2 border-transparent px-4 text-xs font-semibold uppercase tracking-wider',
                  'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                  'data-[state=active]:border-l-accent data-[state=active]:bg-secondary/30 data-[state=active]:text-accent'
                )}
              >
                Sketch
              </TabsTrigger>
              <TabsTrigger
                value="evaluate"
                className={cn(
                  'h-10 rounded-none border-l-2 border-transparent px-4 text-xs font-semibold uppercase tracking-wider',
                  'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                  'data-[state=active]:border-l-success data-[state=active]:bg-secondary/30 data-[state=active]:text-success'
                )}
              >
                Evaluate
              </TabsTrigger>
            </TabsList>

            {/* Tool content on the right */}
            <div className="flex-1 p-2">
              <TabsContent value="features" className="m-0 flex items-center gap-1">
                {/* Boss/Base tools */}
                <div className="flex items-center gap-1">
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

                <Separator orientation="vertical" className="mx-2 h-14 bg-cad-divider" />

                {/* Cut tools */}
                <div className="flex items-center gap-1">
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

                <Separator orientation="vertical" className="mx-2 h-14 bg-cad-divider" />

                {/* Modify tools */}
                <div className="flex items-center gap-1">
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
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}