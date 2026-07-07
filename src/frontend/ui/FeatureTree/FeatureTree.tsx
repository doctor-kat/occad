import { SketchModeIcon } from '@/frontend/shared/icons';
import { FeatureTreeItem as TreeItemType } from '@/cad/types';
import { Stack, Box, ScrollArea, Text, useMantineTheme } from '@mantine/core';
import { TreeItem } from './TreeItem';

export interface FeatureTreeProps {
  items: TreeItemType[];
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isCompact?: boolean;
  onToggleSidebar?: () => void;
  /** Reorder a feature relative to another (drag-and-drop). */
  onReorder?: (draggedId: string, targetId: string, place: 'before' | 'after') => void;
}

export function FeatureTree({ items, selectedItem, onSelectItem, onToggleExpand, onToggleVisibility, onEdit, onDelete, isCompact, onToggleSidebar, onReorder }: FeatureTreeProps) {
  const theme = useMantineTheme();

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
                selectedItem={selectedItem}
                onSelectItem={onSelectItem}
                onToggleExpand={onToggleExpand}
                onToggleVisibility={onToggleVisibility}
                onEdit={onEdit}
                onDelete={onDelete}
                isCompact={true}
              />
            ))}
          </Stack>
        </ScrollArea>
      </Stack>
    );
  }

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      <ScrollArea
        style={{
          flex: 1,
        }}
      >
        <Stack gap={2} p={8}>
          {items.map((item) => (
            <TreeItem
              key={item.id}
              item={item}
              depth={0}
              selectedItem={selectedItem}
              onSelectItem={onSelectItem}
              onToggleExpand={onToggleExpand}
              onToggleVisibility={onToggleVisibility}
              onEdit={onEdit}
              onDelete={onDelete}
              isCompact={false}
              onReorder={onReorder}
            />
          ))}

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
