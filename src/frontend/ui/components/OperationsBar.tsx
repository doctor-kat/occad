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
import { OperationCategory, Operation, FeatureOperation, SketchOperation, EvaluateOperation, TransformOperation, IOOperation } from '@/cad/types';

const operationButtonInternalStyles = {
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

interface OperationButtonProps {
  icon: React.ReactNode;
  label: string;
  operationId: Operation;
  isActive: boolean;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
}

function OperationButton({ icon, label, isActive, onClick, disabled = false }: OperationButtonProps) {
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
        ...operationButtonInternalStyles,
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

function OperationDivider() {
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

interface OperationsBarProps {
  activeTab: OperationCategory;
  activeOperation: Operation;
  selectedTreeItem?: string | null;
  activeSketchId?: string | null;
  onTabChange: (tab: OperationCategory) => void;
  onOperationSelect: (operation: Operation) => void;
  onSketchButtonClick?: () => void;
}

const featureOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.EXTRUDE_BOSS, icon: <ArrowLineUp size={16} weight="regular" />, label: 'Extrude Boss' },
  { id: FeatureOperation.REVOLVED_BOSS, icon: <ArrowCounterClockwise size={16} weight="regular" />, label: 'Revolve Boss' },
];

const cutOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.EXTRUDED_CUT, icon: <Scissors size={16} weight="regular" />, label: 'Extrude Cut' },
  { id: FeatureOperation.REVOLVED_CUT, icon: <DotOutline size={16} weight="regular" />, label: 'Revolve Cut' },
];

const modifyOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.FILLET, icon: <ArrowElbowDownRight size={16} weight="regular" />, label: 'Fillet' },
  { id: FeatureOperation.CHAMFER, icon: <Minus size={16} weight="regular" style={{ transform: 'rotate(45deg)' }} />, label: 'Chamfer' },
  { id: FeatureOperation.SHELL, icon: <Stack size={16} weight="regular" />, label: 'Shell' },
  { id: FeatureOperation.OFFSET, icon: <Copy size={16} weight="regular" />, label: 'Offset' },
];

const primitiveOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.BOX, icon: <Cube size={16} weight="regular" />, label: 'Box' },
  { id: FeatureOperation.SPHERE, icon: <Globe size={16} weight="regular" />, label: 'Sphere' },
  { id: FeatureOperation.CYLINDER, icon: <Cylinder size={16} weight="regular" />, label: 'Cylinder' },
  { id: FeatureOperation.CONE, icon: <Triangle size={16} weight="regular" />, label: 'Cone' },
  { id: FeatureOperation.TORUS, icon: <Target size={16} weight="regular" />, label: 'Torus' },
  { id: FeatureOperation.WEDGE, icon: <Triangle size={16} weight="regular" style={{ transform: 'rotate(180deg)' }} />, label: 'Wedge' },
];

const otherOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.SWEEP, icon: <Wind size={16} weight="regular" />, label: 'Sweep' },
  { id: FeatureOperation.LOFT, icon: <Stack size={16} weight="regular" />, label: 'Loft' },
];

const booleanOperations: { id: FeatureOperation; icon: React.ReactNode; label: string }[] = [
  { id: FeatureOperation.UNION, icon: <GitMerge size={16} weight="regular" />, label: 'Union' },
  { id: FeatureOperation.INTERSECT, icon: <Unite size={16} weight="regular" />, label: 'Intersect' },
];

const sketchOperations: { id: SketchOperation; icon: React.ReactNode; label: string }[] = [
  { id: SketchOperation.LINE, icon: <Minus size={16} weight="regular" />, label: 'Line' },
  { id: SketchOperation.RECTANGLE, icon: <Square size={16} weight="regular" />, label: 'Rectangle' },
  { id: SketchOperation.CIRCLE, icon: <Circle size={16} weight="regular" />, label: 'Circle' },
  { id: SketchOperation.POLYGON, icon: <Hexagon size={16} weight="regular" />, label: 'Polygon' },
  { id: SketchOperation.ARC, icon: <ArrowRight size={16} weight="regular" />, label: 'Arc' },
  { id: SketchOperation.ELLIPSE, icon: <DotsThree size={16} weight="regular" style={{ transform: 'rotate(90deg)' }} />, label: 'Ellipse' },
  { id: SketchOperation.SPLINE, icon: <Pen size={16} weight="regular" />, label: 'Spline' },
  { id: SketchOperation.BEZIER, icon: <WaveSine size={16} weight="regular" />, label: 'Bezier' },
];

const evaluateOperations: { id: EvaluateOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'measure', icon: <Ruler size={16} weight="regular" />, label: 'Measure' },
];

const transformOperations: { id: TransformOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'move', icon: <ArrowsOutCardinal size={16} weight="regular" />, label: 'Move' },
  { id: 'rotate', icon: <ArrowClockwise size={16} weight="regular" />, label: 'Rotate' },
  { id: 'mirror', icon: <FlipHorizontal size={16} weight="regular" />, label: 'Mirror' },
  { id: 'scale', icon: <ArrowsOut size={16} weight="regular" />, label: 'Scale' },
];

const ioOperations: { id: IOOperation; icon: React.ReactNode; label: string }[] = [
  { id: 'import-step', icon: <UploadSimple size={16} weight="regular" />, label: 'Import STEP' },
  { id: 'import-iges', icon: <UploadSimple size={16} weight="regular" />, label: 'Import IGES' },
  { id: 'export-step', icon: <DownloadSimple size={16} weight="regular" />, label: 'Export STEP' },
  { id: 'export-iges', icon: <DownloadSimple size={16} weight="regular" />, label: 'Export IGES' },
  { id: 'export-stl', icon: <Package size={16} weight="regular" />, label: 'Export STL' },
  { id: 'export-gltf', icon: <FileCode size={16} weight="regular" />, label: 'Export GLTF' },
];

// Operations that are not yet implemented (disabled in UI)
const disabledOperations: Operation[] = [
  // 3D Operations - not yet implemented
  'sweep', 'loft',
  // Boolean operations - backend exists but no UI yet
  'union', 'intersect',
  // Modifications - not yet implemented
  // Evaluate - not yet implemented
  // Transform - not yet implemented
  // I/O - not yet implemented
  'import-step', 'import-iges', 'export-step', 'export-iges', 'export-stl', 'export-gltf',
];

export function OperationsBar({ activeTab, activeOperation, selectedTreeItem, activeSketchId, onTabChange, onOperationSelect, onSketchButtonClick }: OperationsBarProps) {
  const theme = useMantineTheme();

  const renderOperationGroup = (operations: { id: Operation; icon: React.ReactNode; label: string }[]) => (
    <Group gap={4} align="center" wrap="nowrap">
      {operations.map((operation) => (
        <OperationButton
          key={operation.id}
          icon={operation.icon}
          label={operation.label}
          operationId={operation.id}
          isActive={activeOperation === operation.id}
          onClick={() => onOperationSelect(operation.id)}
          disabled={disabledOperations.includes(operation.id)}
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
        onChange={(v) => onTabChange(v as OperationCategory)}
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
                {renderOperationGroup(featureOperations)}
                <OperationDivider />
                {renderOperationGroup(cutOperations)}
                <OperationDivider />
                {renderOperationGroup(primitiveOperations)}
                <OperationDivider />
                {renderOperationGroup(otherOperations)}
                <OperationDivider />
                {renderOperationGroup(booleanOperations)}
                <OperationDivider />
                {renderOperationGroup(modifyOperations)}
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="sketch" style={{ margin: 0 }}>
              <Group gap={4} align="center" wrap="nowrap">
                <OperationButton
                  icon={<Pen size={16} weight="regular" />}
                  label="Sketch"
                  operationId={null}
                  isActive={!!activeSketchId}
                  onClick={() => onSketchButtonClick?.()}
                />
                <OperationDivider />
                {renderOperationGroup(sketchOperations)}
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="transform" style={{ margin: 0 }}>
              {renderOperationGroup(transformOperations)}
            </Tabs.Panel>

            <Tabs.Panel value="evaluate" style={{ margin: 0 }}>
              {renderOperationGroup(evaluateOperations)}
            </Tabs.Panel>

            <Tabs.Panel value="io" style={{ margin: 0 }}>
              {renderOperationGroup(ioOperations)}
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
            <CADTab value={OperationCategory.FEATURES} label="Features" isActive={activeTab === OperationCategory.FEATURES} theme={theme} />
            <CADTab value={OperationCategory.SKETCH} label="Sketch" isActive={activeTab === OperationCategory.SKETCH} theme={theme} />
            <CADTab value={OperationCategory.TRANSFORM} label="Transform" isActive={activeTab === OperationCategory.TRANSFORM} theme={theme} />
            <CADTab value={OperationCategory.EVALUATE} label="Evaluate" isActive={activeTab === OperationCategory.EVALUATE} theme={theme} />
            <CADTab value={OperationCategory.IO} label="I/O" isActive={activeTab === OperationCategory.IO} theme={theme} />
          </Tabs.List>
        </Box>
      </Tabs>
    </Box>
  );
}
