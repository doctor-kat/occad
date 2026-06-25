import { Pen } from '@phosphor-icons/react';
import { Tabs, Box, Group, Stack, useMantineTheme } from '@mantine/core';
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
  transformOperations,
  evaluateOperations,
  ioOperations,
  disabledOperations
} from './OperationData';

type OperationItem = { id: Operation; icon: React.ReactNode; label: string };

// Sketch operations that render as a stacked column of compact (icon + inline text)
// buttons instead of large square buttons. Line is rendered as a group (split button)
// via lineGroup, so only Rectangle remains as a plain compact button here.
const stackedSketchOps: SketchOperation[] = [SketchOperation.RECTANGLE];

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

  const renderCompactButtons = (operations: OperationItem[]) =>
    operations.map((operation) => (
      <CompactOperationButton
        key={operation.id}
        icon={operation.icon}
        label={operation.label}
        operationId={operation.id}
        isActive={activeOperation === operation.id}
        onClick={() => onOperationSelect(operation.id)}
        disabled={disabledOperations.includes(operation.id)}
      />
    ));

  const stackedSketchOperations = sketchOperations.filter((op) => stackedSketchOps.includes(op.id));
  // Line is handled by the line group split-button; exclude it (and the stacked ops)
  // from the full-size square button row.
  const fullSketchOperations = sketchOperations.filter(
    (op) => op.id !== SketchOperation.LINE && !stackedSketchOps.includes(op.id),
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
                  icon={<Pen size={16} weight="regular" />}
                  label="Sketch"
                  operationId={null}
                  isActive={!!activeSketchId}
                  onClick={() => onSketchButtonClick?.()}
                />
                <OperationDivider />
                <Stack gap={4} align="stretch" justify="center">
                  <OperationGroupButton
                    options={lineGroup.options}
                    variant="compact"
                    activeOperation={activeOperation}
                    onOperationSelect={onOperationSelect}
                  />
                  {renderCompactButtons(stackedSketchOperations)}
                </Stack>
                {renderOperationGroup(fullSketchOperations)}
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
