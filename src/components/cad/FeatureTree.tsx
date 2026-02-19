import {
  CaretRight,
  CaretDown,
  SidebarSimple,
  Sidebar,
  PencilSimple,
  Trash,
  Eye,
  EyeClosed,
  Perspective,
  VectorThree,
  DotsNine,
  Cube,
  Pen,
  Warning
} from '@phosphor-icons/react';
import { FeatureTreeItem as TreeItemType } from '@/types/cad';
import { Button, Stack, Box, ScrollArea, Text, useMantineTheme, ActionIcon, Group, Tooltip } from '@mantine/core';
import { useState } from 'react';
import { useViewportStore } from '@/stores/viewportStore';

interface FeatureTreeProps {
  items: TreeItemType[];
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isCompact?: boolean;
  onToggleSidebar?: () => void;
}


function getItemIcon(item: TreeItemType, theme: any) {
  const iconSize = 16;

  if (item.type === 'reference-geometry') {
    if (item.children) {
      return <Perspective size={iconSize} weight="regular" color={theme.colors.cyan[5]} />;
    }
    const data = item.data as { type: string };
    if (data?.type === 'origin') {
      return <VectorThree size={iconSize} weight="regular" color={theme.other.colors.warning} />;
    }
    return <Perspective size={iconSize} weight="regular" color={theme.other.colors.info} />;
  }

  if (item.type === 'sketch') {
    return <DotsNine size={iconSize} weight="regular" color={theme.colors.purple[5]} />;
  }

  if (item.type === 'feature') {
    return <Cube size={iconSize} weight="regular" color={theme.other.colors.success} />;
  }

  return null;
}

interface TreeItemProps {
  item: TreeItemType;
  depth: number;
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isCompact?: boolean;
}

function TreeItem({ item, depth, selectedItem, onSelectItem, onToggleExpand, onToggleVisibility, onEdit, onDelete, isCompact }: TreeItemProps) {
  const setHoveredTreeItem = useViewportStore((state) => state.setHoveredTreeItem);
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = item.isExpanded !== false;
  const isSelected = selectedItem === item.id;
  const isVisible = item.visible !== false;
  const theme = useMantineTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Don't allow editing/deleting reference geometry (planes and origin)
  const canEdit = item.type !== 'reference-geometry';
  const canDelete = item.type !== 'reference-geometry';

  if (isCompact) {
    // Compact mode: only show icon, no nesting
    return (
      <Tooltip label={item.name} position="right">
        <ActionIcon
          variant={isSelected ? 'light' : 'subtle'}
          size="lg"
          onClick={() => onSelectItem(item.id)}
          style={{
            width: '100%',
            height: 40,
            borderRadius: theme.radius.sm,
            transition: 'all 150ms',
            opacity: isVisible ? 1 : 0.4,
          }}
          styles={{
            root: {
              '--ai-bg': isSelected ? `${theme.colors.blue[5]}15` : undefined,
              '--ai-bd': isSelected ? `1px solid ${theme.colors.blue[5]}33` : undefined,
            },
          }}
        >
          {getItemIcon(item, theme)}
        </ActionIcon>
      </Tooltip>
    );
  }

  return (
    <Box>
      <Group
        gap={0}
        wrap="nowrap"
        className="tree-item-row"
        data-selected={isSelected}
        style={{
          height: 32,
          paddingLeft: depth * 16 + 8,
          paddingRight: 4,
          backgroundColor: isSelected
            ? `${theme.colors.blue[5]}15`
            : isHovered
              ? `${theme.colors.orange[5]}15`
              : 'transparent',
          border: isSelected
            ? `1px solid ${theme.colors.blue[5]}33`
            : isHovered
              ? `1px solid ${theme.colors.orange[5]}33`
              : '1px solid transparent',
          borderRadius: theme.radius.sm,
          opacity: isVisible ? 1 : 0.5,
          transition: 'all 150ms',
        }}
        onMouseEnter={() => {
          setIsHovered(true);
          setHoveredTreeItem(item.id);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setHoveredTreeItem(null);
        }}
      >
        {/* Visibility Checkbox */}
        <ActionIcon
          variant="subtle"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility?.(item.id);
          }}
          style={{
            width: 20,
            height: 20,
            borderRadius: theme.radius.xs,
            flexShrink: 0,
          }}
        >
          {isVisible ? (
            <Eye size={14} weight="regular" color={theme.other.colors.mutedForeground} />
          ) : (
            <EyeClosed size={14} weight="regular" color={theme.other.colors.mutedForeground} />
          )}
        </ActionIcon>

        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
            style={{
              width: 20,
              height: 20,
              borderRadius: theme.radius.xs,
              flexShrink: 0,
            }}
          >
            {isExpanded ? (
              <CaretDown size={14} weight="regular" color={theme.other.colors.mutedForeground} />
            ) : (
              <CaretRight size={14} weight="regular" color={theme.other.colors.mutedForeground} />
            )}
          </ActionIcon>
        ) : (
          <Box style={{ width: 20, flexShrink: 0 }} />
        )}

        {/* Icon and Name - Clickable Area */}
        <Box
          onClick={() => onSelectItem(item.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minWidth: 0,
            cursor: 'pointer',
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          {getItemIcon(item, theme)}
          <Text
            size="xs"
            fw={500}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: isVisible ? theme.other.colors.foreground : theme.other.colors.mutedForeground,
            }}
          >
            {item.name}
          </Text>
        </Box>

        {/* Warning icon for rebuild errors */}
        {item.error && (
          <Tooltip label={item.error} position="top" multiline maw={300}>
            <Box style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Warning size={14} weight="fill" color={theme.other.colors.warning} />
            </Box>
          </Tooltip>
        )}

        {/* Edit and Delete Buttons */}
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          {canEdit && onEdit && (
            <Tooltip label="Edit" position="top">
              <ActionIcon
                variant="subtle"
                size="xs"
                data-testid={`edit-${item.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item.id);
                }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: theme.radius.xs,
                }}
              >
                <PencilSimple size={12} weight="regular" color={theme.other.colors.mutedForeground} />
              </ActionIcon>
            </Tooltip>
          )}
          {canDelete && onDelete && (
            <Tooltip label="Delete" position="top">
              <ActionIcon
                variant="subtle"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: theme.radius.xs,
                }}
              >
                <Trash size={12} weight="regular" color={theme.colors.red[5]} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {hasChildren && isExpanded && (
        <Box>
          {item.children!.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedItem={selectedItem}
              onSelectItem={onSelectItem}
              onToggleExpand={onToggleExpand}
              onToggleVisibility={onToggleVisibility}
              onEdit={onEdit}
              onDelete={onDelete}
              isCompact={isCompact}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}


export function FeatureTree({ items, selectedItem, onSelectItem, onToggleExpand, onToggleVisibility, onEdit, onDelete, isCompact, onToggleSidebar }: FeatureTreeProps) {
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
              <Pen
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
