import {
  ArrowLineUp,
  ArrowCounterClockwise,
  Scissors,
  DotOutline,
  ArrowElbowDownRight,
  Minus,
  Square,
  Circle,
  Hexagon,
  ArrowRight,
  Ruler,
  Cube,
  Globe,
  Cylinder,
  Triangle,
  Target,
  Wind,
  Stack,
  GitMerge,
  Copy,
  DotsThree,
  Pen,
  WaveSine,
  ArrowsOutCardinal,
  ArrowClockwise,
  FlipHorizontal,
  ArrowsOut,
  UploadSimple,
  DownloadSimple,
  FileCode,
  Package,
  Unite
} from '@phosphor-icons/react';
import { Tabs, Button, Divider, Box, Group, useMantineTheme } from '@mantine/core';
import { ToolCategory, Tool, FeatureTool, SketchTool, EvaluateTool, TransformTool, IOTool } from '@/types/cad';

const toolButtonInternalStyles = {
  inner: {
    display: 'block !important',
    height: '100%',
    width: '100%',
  },
  label: {
    display: 'block !important',
    height: '100%',
  },
};

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  toolId: Tool;
  isActive: boolean;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

function ToolButton({ icon, label, isActive, onClick, disabled = false }: ToolButtonProps) {
  const theme = useMantineTheme();

  return (
    <Button
      variant={isActive ? 'light' : 'subtle'}
      size="xs"
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 72,
        width: 72,
        minWidth: 72,
        padding: 0,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 200ms',
      }}
      styles={{
        root: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '--button-bg': isActive ? `${theme.colors.blue[5]}15` : undefined,
          '--button-bd': isActive ? `1px solid ${theme.colors.blue[5]}30` : undefined,
        },
        ...toolButtonInternalStyles,
      }}
    >
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 4,
        }}
      >
        <Box style={{ fontSize: 24, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </Box>
        <Box component="span" style={{ fontSize: 10, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>
          {label}
        </Box>
      </Box>
    </Button>
  );
}

function ToolDivider() {
  return <Divider orientation="vertical" h={56} mx={8} />;
}

interface CADTabProps {
  value: string;
  label: string;
  isActive: boolean;
  theme: any;
}

function CADTab({ value, label, isActive, theme }: CADTabProps) {
  return (
    <Tabs.Tab
      value={value}
      style={{
        borderRadius: 0,
        borderBottom: isActive ? `2px solid ${theme.colors.blue[5]}` : '2px solid transparent',
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 8,
        paddingBottom: 8,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: isActive ? theme.colors.blue[5] : theme.other.colors.mutedForeground,
        backgroundColor: isActive ? `${theme.colors.blue[5]}15` : 'transparent',
        transition: 'all 200ms',
      }}
    >
      {label}
    </Tabs.Tab>
  );
}

interface FeatureTabsProps {
  activeTab: ToolCategory;
  activeTool: Tool;
  selectedTreeItem?: string | null;
  activeSketchId?: string | null;
  onTabChange: (tab: ToolCategory) => void;
  onToolSelect: (tool: Tool) => void;
  onSketchButtonClick?: () => void;
}

const featureTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'extrude-boss', icon: <ArrowLineUp size={16} weight="regular" />, label: 'Extrude Boss' },
  { id: 'revolved-boss', icon: <ArrowCounterClockwise size={16} weight="regular" />, label: 'Revolve Boss' },
];

const cutTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'extruded-cut', icon: <Scissors size={16} weight="regular" />, label: 'Extrude Cut' },
  { id: 'revolved-cut', icon: <DotOutline size={16} weight="regular" />, label: 'Revolve Cut' },
];

const modifyTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'fillet', icon: <ArrowElbowDownRight size={16} weight="regular" />, label: 'Fillet' },
  { id: 'chamfer', icon: <Minus size={16} weight="regular" style={{ transform: 'rotate(45deg)' }} />, label: 'Chamfer' },
  { id: 'shell', icon: <Stack size={16} weight="regular" />, label: 'Shell' },
  { id: 'offset', icon: <Copy size={16} weight="regular" />, label: 'Offset' },
];

const primitiveTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'box', icon: <Cube size={16} weight="regular" />, label: 'Box' },
  { id: 'sphere', icon: <Globe size={16} weight="regular" />, label: 'Sphere' },
  { id: 'cylinder', icon: <Cylinder size={16} weight="regular" />, label: 'Cylinder' },
  { id: 'cone', icon: <Triangle size={16} weight="regular" />, label: 'Cone' },
  { id: 'torus', icon: <Target size={16} weight="regular" />, label: 'Torus' },
  { id: 'wedge', icon: <Triangle size={16} weight="regular" style={{ transform: 'rotate(180deg)' }} />, label: 'Wedge' },
];

const operationTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'sweep', icon: <Wind size={16} weight="regular" />, label: 'Sweep' },
  { id: 'loft', icon: <Stack size={16} weight="regular" />, label: 'Loft' },
];

const booleanTools: { id: FeatureTool; icon: React.ReactNode; label: string }[] = [
  { id: 'union', icon: <GitMerge size={16} weight="regular" />, label: 'Union' },
  { id: 'intersect', icon: <Unite size={16} weight="regular" />, label: 'Intersect' },
];

const sketchTools: { id: SketchTool; icon: React.ReactNode; label: string }[] = [
  { id: 'line', icon: <Minus size={16} weight="regular" />, label: 'Line' },
  { id: 'rectangle', icon: <Square size={16} weight="regular" />, label: 'Rectangle' },
  { id: 'circle', icon: <Circle size={16} weight="regular" />, label: 'Circle' },
  { id: 'polygon', icon: <Hexagon size={16} weight="regular" />, label: 'Polygon' },
  { id: 'arc', icon: <ArrowRight size={16} weight="regular" />, label: 'Arc' },
  { id: 'ellipse', icon: <DotsThree size={16} weight="regular" style={{ transform: 'rotate(90deg)' }} />, label: 'Ellipse' },
  { id: 'spline', icon: <Pen size={16} weight="regular" />, label: 'Spline' },
  { id: 'bezier', icon: <WaveSine size={16} weight="regular" />, label: 'Bezier' },
];

const evaluateTools: { id: EvaluateTool; icon: React.ReactNode; label: string }[] = [
  { id: 'measure', icon: <Ruler size={16} weight="regular" />, label: 'Measure' },
];

const transformTools: { id: TransformTool; icon: React.ReactNode; label: string }[] = [
  { id: 'move', icon: <ArrowsOutCardinal size={16} weight="regular" />, label: 'Move' },
  { id: 'rotate', icon: <ArrowClockwise size={16} weight="regular" />, label: 'Rotate' },
  { id: 'mirror', icon: <FlipHorizontal size={16} weight="regular" />, label: 'Mirror' },
  { id: 'scale', icon: <ArrowsOut size={16} weight="regular" />, label: 'Scale' },
];

const ioTools: { id: IOTool; icon: React.ReactNode; label: string }[] = [
  { id: 'import-step', icon: <UploadSimple size={16} weight="regular" />, label: 'Import STEP' },
  { id: 'import-iges', icon: <UploadSimple size={16} weight="regular" />, label: 'Import IGES' },
  { id: 'export-step', icon: <DownloadSimple size={16} weight="regular" />, label: 'Export STEP' },
  { id: 'export-iges', icon: <DownloadSimple size={16} weight="regular" />, label: 'Export IGES' },
  { id: 'export-stl', icon: <Package size={16} weight="regular" />, label: 'Export STL' },
  { id: 'export-gltf', icon: <FileCode size={16} weight="regular" />, label: 'Export GLTF' },
];

// Tools that are not yet implemented (disabled in UI)
const disabledTools: Tool[] = [
  // Primitives - not yet implemented
  'box', 'sphere', 'cylinder', 'cone', 'torus', 'wedge',
  // 3D Operations - not yet implemented
  'sweep', 'loft',
  // Boolean operations - backend exists but no UI yet
  'union', 'intersect',
  // Modifications - not yet implemented
  'fillet', 'chamfer', 'shell', 'offset',
  // Evaluate - not yet implemented
  'measure',
  // Transform - not yet implemented
  'move', 'rotate', 'mirror', 'scale',
  // I/O - not yet implemented
  'import-step', 'import-iges', 'export-step', 'export-iges', 'export-stl', 'export-gltf',
];

export function FeatureTabs({ activeTab, activeTool, selectedTreeItem, activeSketchId, onTabChange, onToolSelect, onSketchButtonClick }: FeatureTabsProps) {
  const theme = useMantineTheme();

  const renderToolGroup = (tools: { id: Tool; icon: React.ReactNode; label: string }[]) => (
    <Group gap={4} align="center" wrap="nowrap">
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          toolId={tool.id}
          isActive={activeTool === tool.id}
          onClick={() => onToolSelect(tool.id)}
          disabled={disabledTools.includes(tool.id)}
        />
      ))}
    </Group>
  );

  return (
    <Box
      style={{
        borderBottom: `1px solid ${theme.other.colors.border}`,
        backgroundColor: theme.other.colors.cadToolbar,
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(v) => onTabChange(v as ToolCategory)}
        styles={{
          root: { width: '100%' },
          list: { flexDirection: 'row' },
          panel: { flex: 1 },
        }}
      >
        <Box style={{ display: 'flex', flexDirection: 'column' }}>
          <Box style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: 8 }}>
            <Tabs.Panel value="features" style={{ margin: 0 }}>
              <Group gap={4} align="center" wrap="nowrap">
                {renderToolGroup(featureTools)}
                <ToolDivider />
                {renderToolGroup(cutTools)}
                <ToolDivider />
                {renderToolGroup(primitiveTools)}
                <ToolDivider />
                {renderToolGroup(operationTools)}
                <ToolDivider />
                {renderToolGroup(booleanTools)}
                <ToolDivider />
                {renderToolGroup(modifyTools)}
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="sketch" style={{ margin: 0 }}>
              <Group gap={4} align="center" wrap="nowrap">
                <ToolButton
                  icon={<Pen size={16} weight="regular" />}
                  label="Sketch"
                  toolId={null}
                  isActive={!!activeSketchId}
                  onClick={() => onSketchButtonClick?.()}
                />
                <ToolDivider />
                {renderToolGroup(sketchTools)}
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="transform" style={{ margin: 0 }}>
              {renderToolGroup(transformTools)}
            </Tabs.Panel>

            <Tabs.Panel value="evaluate" style={{ margin: 0 }}>
              {renderToolGroup(evaluateTools)}
            </Tabs.Panel>

            <Tabs.Panel value="io" style={{ margin: 0 }}>
              {renderToolGroup(ioTools)}
            </Tabs.Panel>
          </Box>

          {/* Tab triggers at the bottom */}
          <Tabs.List
            style={{
              height: 'auto',
              width: '100%',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              gap: 0,
              borderRadius: 0,
              borderTop: `1px solid ${theme.other.colors.border}`,
              padding: 0,
            }}
          >
            <CADTab value="features" label="Features" isActive={activeTab === 'features'} theme={theme} />
            <CADTab value="sketch" label="Sketch" isActive={activeTab === 'sketch'} theme={theme} />
            <CADTab value="transform" label="Transform" isActive={activeTab === 'transform'} theme={theme} />
            <CADTab value="evaluate" label="Evaluate" isActive={activeTab === 'evaluate'} theme={theme} />
            <CADTab value="io" label="I/O" isActive={activeTab === 'io'} theme={theme} />
          </Tabs.List>
        </Box>
      </Tabs>
    </Box>
  );
}
