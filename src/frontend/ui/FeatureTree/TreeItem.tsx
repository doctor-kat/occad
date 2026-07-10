import { useState, type ComponentType } from 'react';
import { CaretRight, CaretDown, PencilSimple, Trash, Eye, EyeClosed, Warning } from '@phosphor-icons/react';
import {
  PlaneIcon,
  OriginIcon,
  SketchIcon,
  FeatureIcon,
  ExtrudeBossIcon,
  RevolveIcon,
  ExtrudeCutIcon,
  RevolveCutIcon,
  BoxIcon,
  SphereIcon,
  CylinderIcon,
  ConeIcon,
  TorusIcon,
  WedgeIcon,
  SweepIcon,
  LoftIcon,
  UnionIcon,
  IntersectIcon,
  FilletIcon,
  ChamferIcon,
  ShellIcon,
  OffsetIcon,
  MoveIcon,
  Rotate2Icon,
  MirrorIcon,
  ScaleIcon,
  MeasureIcon,
  type CadIconProps,
} from '@/frontend/shared/icons';
import { FeatureTreeItem as TreeItemType, FeatureTreeItemType, ReferenceGeometryType, FeatureOperation } from '@/cad/types';
import { Box, Text, useMantineTheme, ActionIcon, Group, Tooltip } from '@mantine/core';
import { useViewportStore } from '@/frontend/shared/viewportStore.ts';

/** Icon per feature operation, keyed by the same FeatureOperation used to build/rebuild the feature. */
const FEATURE_OPERATION_ICONS: Record<FeatureOperation, ComponentType<CadIconProps>> = {
  [FeatureOperation.EXTRUDE_BOSS]: ExtrudeBossIcon,
  [FeatureOperation.REVOLVED_BOSS]: RevolveIcon,
  [FeatureOperation.EXTRUDED_CUT]: ExtrudeCutIcon,
  [FeatureOperation.REVOLVED_CUT]: RevolveCutIcon,
  [FeatureOperation.BOX]: BoxIcon,
  [FeatureOperation.SPHERE]: SphereIcon,
  [FeatureOperation.CYLINDER]: CylinderIcon,
  [FeatureOperation.CONE]: ConeIcon,
  [FeatureOperation.TORUS]: TorusIcon,
  [FeatureOperation.WEDGE]: WedgeIcon,
  [FeatureOperation.SWEEP]: SweepIcon,
  [FeatureOperation.LOFT]: LoftIcon,
  [FeatureOperation.UNION]: UnionIcon,
  [FeatureOperation.INTERSECT]: IntersectIcon,
  [FeatureOperation.FILLET]: FilletIcon,
  [FeatureOperation.CHAMFER]: ChamferIcon,
  [FeatureOperation.SHELL]: ShellIcon,
  [FeatureOperation.OFFSET]: OffsetIcon,
  [FeatureOperation.MOVE]: MoveIcon,
  [FeatureOperation.ROTATE]: Rotate2Icon,
  [FeatureOperation.MIRROR]: MirrorIcon,
  [FeatureOperation.SCALE]: ScaleIcon,
  [FeatureOperation.MEASURE]: MeasureIcon,
};

function getItemIcon(item: TreeItemType, theme: any) {
  const iconSize = 16;

  if (item.type === FeatureTreeItemType.REFERENCE_GEOMETRY) {
    if (item.children) {
      return <PlaneIcon size={iconSize} color={theme.colors.cyan[5]} />;
    }
    const data = item.data as { type: ReferenceGeometryType };
    if (data?.type === ReferenceGeometryType.ORIGIN) {
      return <OriginIcon size={iconSize} color={theme.other.colors.warning} />;
    }
    return <PlaneIcon size={iconSize} color={theme.other.colors.info} />;
  }

  if (item.type === FeatureTreeItemType.SKETCH) {
    return <SketchIcon size={iconSize} color={theme.colors.purple[5]} />;
  }

  if (item.type === FeatureTreeItemType.FEATURE) {
    const data = item.data as { type: FeatureOperation } | undefined;
    const Icon = (data?.type && FEATURE_OPERATION_ICONS[data.type]) || FeatureIcon;
    return <Icon size={iconSize} color={theme.other.colors.success} />;
  }

  return null;
}

export interface TreeItemProps {
  item: TreeItemType;
  depth: number;
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isCompact?: boolean;
  /** Called when a feature is dropped relative to another feature (drag-reorder). */
  onReorder?: (draggedId: string, targetId: string, place: 'before' | 'after') => void;
}

export function TreeItem({ item, depth, selectedItem, onSelectItem, onToggleExpand, onToggleVisibility, onEdit, onDelete, isCompact, onReorder }: TreeItemProps) {
  const setHoveredTreeItem = useViewportStore((state) => state.setHoveredTreeItem);
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = item.isExpanded !== false;
  const isSelected = selectedItem === item.id;
  const isVisible = item.visible !== false;
  const isRolledBack = item.rolledBack === true;
  const theme = useMantineTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<'before' | 'after' | null>(null);

  // Only top-level features participate in drag-reorder.
  const isDraggable = !!onReorder && depth === 0 && item.type === FeatureTreeItemType.FEATURE;

  // Don't allow editing/deleting reference geometry (planes and origin)
  const canEdit = item.type !== FeatureTreeItemType.REFERENCE_GEOMETRY;
  const canDelete = item.type !== FeatureTreeItemType.REFERENCE_GEOMETRY;

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
            transition: 'background-color 150ms, border-color 150ms, opacity 150ms',
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
        data-rolled-back={isRolledBack}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => {
          e.dataTransfer.setData('application/x-feature-id', item.id);
          e.dataTransfer.effectAllowed = 'move';
        } : undefined}
        onDragOver={isDraggable ? (e) => {
          if (!e.dataTransfer.types.includes('application/x-feature-id')) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const rect = e.currentTarget.getBoundingClientRect();
          setDropIndicator(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
        } : undefined}
        onDragLeave={isDraggable ? () => setDropIndicator(null) : undefined}
        onDrop={isDraggable ? (e) => {
          e.preventDefault();
          const draggedId = e.dataTransfer.getData('application/x-feature-id');
          const place = dropIndicator ?? 'before';
          setDropIndicator(null);
          if (draggedId && draggedId !== item.id) onReorder!(draggedId, item.id, place);
        } : undefined}
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
          borderTop: dropIndicator === 'before' ? `2px solid ${theme.colors.blue[5]}` : undefined,
          borderBottom: dropIndicator === 'after' ? `2px solid ${theme.colors.blue[5]}` : undefined,
          borderRadius: theme.radius.sm,
          // Rolled-back rows (past the history bar) grey out more strongly than
          // merely-hidden rows so the "not built" state reads at a glance.
          opacity: isRolledBack ? 0.35 : isVisible ? 1 : 0.5,
          fontStyle: isRolledBack ? 'italic' : undefined,
          cursor: isDraggable ? 'grab' : undefined,
          transition: 'background-color 150ms, border-color 150ms, opacity 150ms',
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
              onReorder={onReorder}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
