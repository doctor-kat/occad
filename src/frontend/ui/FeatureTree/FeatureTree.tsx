import { Fragment, useState } from 'react';
import { SketchModeIcon } from '@/frontend/shared/icons';
import { FeatureTreeItem as TreeItemType, FeatureTreeItemType } from '@/cad/types';
import { Stack, Box, ScrollArea, Text, useMantineTheme } from '@mantine/core';
import { TreeItem } from './TreeItem';
import { RollbackBar, ROLLBACK_BAR_DND_TYPE } from './RollbackBar';

export interface FeatureTreeProps {
  items: TreeItemType[];
  isCompact?: boolean;
  onToggleSidebar?: () => void;
  /** Current history rollback-bar position (index among top-level flow rows). */
  rollbackBarIndex?: number;
  /** Move the rollback bar to sit before flow-row `newIndex`. */
  onMoveRollbackBar?: (newIndex: number) => void;
}

export function FeatureTree({ items, isCompact, rollbackBarIndex, onMoveRollbackBar }: FeatureTreeProps) {
  const theme = useMantineTheme();
  const [draggingBar, setDraggingBar] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  if (isCompact) {
    // Compact mode: icon-only sidebar showing only top-level items
    return (
      <Stack gap={0} style={{ height: '100%', width: 56 }}>
        <ScrollArea
          style={{
            flex: 1,
          }}
        >
          <Stack gap={4} p={8}>
            {items.map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                depth={0}
                isCompact={true}
              />
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    );
  }

  // Reference geometry is pinned above and not part of the build order; the
  // rollback bar sits only between the "flow" rows (standalone sketches + features).
  const refItems = items.filter((i) => i.type === FeatureTreeItemType.REFERENCE_GEOMETRY);
  const flowItems = items.filter((i) => i.type !== FeatureTreeItemType.REFERENCE_GEOMETRY);
  const barEnabled = !!onMoveRollbackBar && flowItems.length > 0;
  const barPos = rollbackBarIndex ?? flowItems.length;

  // Render the bar at `pos`, or an orange insertion line while it's being dragged there.
  const renderBarSlot = (pos: number) => {
    if (!barEnabled) return null;
    if (draggingBar && dragOverIndex === pos) {
      return <Box key={`ins-${pos}`} style={{ height: 2, margin: '1px 0', backgroundColor: theme.colors.orange[5], borderRadius: 1 }} />;
    }
    // Hide the resting bar at its old spot while dragging (the insertion line leads instead).
    if (barPos === pos && !(draggingBar && dragOverIndex !== null)) {
      return (
        <RollbackBar
          key="rollback-bar"
          active={pos < flowItems.length}
          onDragStart={() => setDraggingBar(true)}
          onDragEnd={() => { setDraggingBar(false); setDragOverIndex(null); }}
        />
      );
    }
    return null;
  };

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      <ScrollArea
        style={{
          flex: 1,
        }}
      >
        <Stack gap={2} p={8}>
          {refItems.map((item) => (
            <TreeItem
              key={item.id}
              item={item}
              depth={0}
              isCompact={false}
            />
          ))}

          {flowItems.map((item, i) => (
            <Fragment key={item.id}>
              {renderBarSlot(i)}
              <Box
                onDragOver={barEnabled ? (e) => {
                  if (!e.dataTransfer.types.includes(ROLLBACK_BAR_DND_TYPE)) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const before = e.clientY < rect.top + rect.height / 2;
                  setDragOverIndex(before ? i : i + 1);
                } : undefined}
                onDrop={barEnabled ? (e) => {
                  if (!e.dataTransfer.types.includes(ROLLBACK_BAR_DND_TYPE)) return;
                  e.preventDefault();
                  // Compute the drop index straight from the cursor rather than
                  // trusting dragOverIndex — a drop can land without a settled
                  // dragover (and its setState may not have flushed yet).
                  const rect = e.currentTarget.getBoundingClientRect();
                  const before = e.clientY < rect.top + rect.height / 2;
                  setDraggingBar(false);
                  setDragOverIndex(null);
                  onMoveRollbackBar!(before ? i : i + 1);
                } : undefined}
              >
                <TreeItem
                  item={item}
                  depth={0}
                  isCompact={false}
                />
              </Box>
            </Fragment>
          ))}
          {renderBarSlot(flowItems.length)}

          {items.length <= 1 && (
            <Box
              style={{
                marginTop: 16,
                borderRadius: theme.radius.lg,
                border: `1px dashed ${theme.other.colors.sidebarBorder}`,
                backgroundColor: `${theme.other.colors.secondary}50`,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 24,
                paddingBottom: 24,
                textAlign: 'center',
              }}
            >
              <SketchModeIcon
                size={24}
                style={{
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  marginBottom: 8,
                  display: 'block',
                  color: `${theme.other.colors.mutedForeground}80`,
                }}
              />
              <Text size="xs" style={{ color: theme.other.colors.mutedForeground }}>
                Create sketches and features to populate the tree
              </Text>
            </Box>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
