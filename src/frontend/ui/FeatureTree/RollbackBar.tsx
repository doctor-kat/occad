import { DotsSixVertical } from '@phosphor-icons/react';
import { Box, Group, Text, Tooltip, useMantineTheme } from '@mantine/core';

export const ROLLBACK_BAR_DND_TYPE = 'application/x-rollback-bar';

export interface RollbackBarProps {
  /** True while the bar is not at the bottom (some rows are rolled back). */
  active: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

/**
 * The SolidWorks-style history rollback marker rendered between feature-tree
 * rows. Drag it up/down (HTML5 DnD) to rewind / fast-forward the build; rows
 * below it are greyed and skipped on rebuild. See ROADMAP.md §8.
 */
export function RollbackBar({ active, onDragStart, onDragEnd }: RollbackBarProps) {
  const theme = useMantineTheme();
  const color = active ? theme.colors.orange[5] : theme.colors.cyan[5];

  return (
    <Tooltip label="Drag to rewind / fast-forward history" position="right" openDelay={400}>
      <Group
        gap={4}
        wrap="nowrap"
        data-testid="rollback-bar"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(ROLLBACK_BAR_DND_TYPE, 'bar');
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        style={{
          height: 14,
          margin: '1px 0',
          paddingLeft: 6,
          paddingRight: 6,
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <DotsSixVertical size={12} weight="bold" color={color} style={{ flexShrink: 0 }} />
        <Box style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: color }} />
        {active && (
          <Text size="9px" fw={700} style={{ color, letterSpacing: 0.5, flexShrink: 0 }}>
            ROLLED BACK
          </Text>
        )}
      </Group>
    </Tooltip>
  );
}
