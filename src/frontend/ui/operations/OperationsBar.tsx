import { SketchModeIcon, SmartLinearIcon } from '@/frontend/shared/icons';
import { Tabs, Box, Group, useMantineTheme } from '@mantine/core';
import { OperationCategory, Operation, SketchOperation } from '@/cad/types';
import { OperationButton } from './OperationButton';
import { CompactOperationButton } from './CompactOperationButton';
import { OperationGroupButton } from './OperationGroupButton';
import { OperationDivider } from './OperationDivider';
import { CADTab } from './CADTab';
import {
  featureOperations,
  cutOperations,
  primitiveOperations,
  otherOperations,
  booleanOperations,
  modifyOperations,
  sketchOperations,
  lineGroup,
  rectangleGroup,
  circleGroup,
  arcGroup,
  transformOperations,
  evaluateOperations,
  ioOperations,
  disabledOperations
} from './OperationData';
import type { OperationGroup } from './OperationData';

type OperationItem = { id: Operation; icon: React.ReactNode; label: string };

// In the sketch tab every tool (except the Sketch button itself) is rendered small
// (compact). Tools that have variants are compact split-button groups; the rest are
// plain compact buttons. They flow into 2-row columns.
const sketchGroupsByOp: Partial<Record<SketchOperation, OperationGroup>> = {
  [SketchOperation.LINE]: lineGroup,
  [SketchOperation.RECTANGLE]: rectangleGroup,
  [SketchOperation.CIRCLE]: circleGroup,
  [SketchOperation.ARC]: arcGroup,
};

export interface OperationsBarProps {
  activeTab: OperationCategory;
  activeOperation: Operation;
  selectedTreeItem?: string | null;
  activeSketchId?: string | null;
  onTabChange: (tab: OperationCategory) => void;
  onOperationSelect: (operation: Operation) => void;
  onSketchButtonClick?: () => void;
}

export function OperationsBar({ activeTab, activeOperation, selectedTreeItem, activeSketchId, onTabChange, onOperationSelect, onSketchButtonClick }: OperationsBarProps) {
  const theme = useMantineTheme();

  const renderOperationGroup = (operations: OperationItem[]) => (
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

  // Every sketch tool is small (compact): grouped tools as compact split-buttons, the
  // rest as plain compact buttons. They flow into columns of 2, left to right.
  const renderSketchTools = () => (
    <Box
      style={{
        display: 'grid',
        gridTemplateRows: 'repeat(2, auto)',
        gridAutoFlow: 'column',
        justifyItems: 'start',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {sketchOperations.map((operation) => {
        const group = sketchGroupsByOp[operation.id];
        return group ? (
          <OperationGroupButton
            key={operation.id}
            options={group.options}
            defaultOptionId={group.defaultOptionId}
            variant="compact"
            activeOperation={activeOperation}
            onOperationSelect={onOperationSelect}
          />
        ) : (
          <CompactOperationButton
            key={operation.id}
            icon={operation.icon}
            label={operation.label}
            operationId={operation.id}
            isActive={activeOperation === operation.id}
            onClick={() => onOperationSelect(operation.id)}
            disabled={disabledOperations.includes(operation.id)}
          />
        );
      })}
    </Box>
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
            <Tabs.Panel value="primitives" style={{ margin: 0 }}>
              {renderOperationGroup(primitiveOperations)}
            </Tabs.Panel>

            <Tabs.Panel value="modifications" style={{ margin: 0 }}>
              <Group gap={4} align="center" wrap="nowrap">
                {renderOperationGroup(cutOperations)}
                <OperationDivider />
                {renderOperationGroup(modifyOperations)}
                <OperationDivider />
                {renderOperationGroup(booleanOperations)}
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="advanced" style={{ margin: 0 }}>
              <Group gap={4} align="center" wrap="nowrap">
                {renderOperationGroup(featureOperations)}
                <OperationDivider />
                {renderOperationGroup(otherOperations)}
              </Group>
            </Tabs.Panel>

            <Tabs.Panel value="sketch" style={{ margin: 0 }}>
              <Group gap={4} align="center" wrap="nowrap">
                <OperationButton
                  icon={<SketchModeIcon size={16} />}
                  label="Sketch"
                  operationId={null}
                  isActive={!!activeSketchId}
                  onClick={() => onSketchButtonClick?.()}
                />
                <OperationButton
                  icon={<SmartLinearIcon size={16} />}
                  label="Dimension"
                  operationId={SketchOperation.DIMENSION}
                  isActive={activeOperation === SketchOperation.DIMENSION}
                  onClick={() => onOperationSelect(SketchOperation.DIMENSION)}
                  disabled={!activeSketchId}
                  data-testid="dimension-tool-button"
                />
                <OperationDivider />
                {renderSketchTools()}
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
            <CADTab value={OperationCategory.SKETCH} label="Sketch" isActive={activeTab === OperationCategory.SKETCH} theme={theme} />
            <CADTab value={OperationCategory.PRIMITIVES} label="Primitives" isActive={activeTab === OperationCategory.PRIMITIVES} theme={theme} />
            <CADTab value={OperationCategory.MODIFICATIONS} label="Modifications" isActive={activeTab === OperationCategory.MODIFICATIONS} theme={theme} />
            <CADTab value={OperationCategory.TRANSFORM} label="Transform" isActive={activeTab === OperationCategory.TRANSFORM} theme={theme} />
            <CADTab value={OperationCategory.ADVANCED} label="Advanced" isActive={activeTab === OperationCategory.ADVANCED} theme={theme} />
            <CADTab value={OperationCategory.EVALUATE} label="Evaluate" isActive={activeTab === OperationCategory.EVALUATE} theme={theme} />
            <CADTab value={OperationCategory.IO} label="I/O" isActive={activeTab === OperationCategory.IO} theme={theme} />
          </Tabs.List>
        </Box>
      </Tabs>
    </Box>
  );
}
