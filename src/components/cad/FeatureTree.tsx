import { ChevronRight, ChevronDown, Plane, Crosshair, PenTool, Box } from 'lucide-react';
import { FeatureTreeItem as TreeItemType } from '@/types/cad';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FeatureTreeProps {
  items: TreeItemType[];
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
}

interface TreeItemProps {
  item: TreeItemType;
  depth: number;
  selectedItem: string | null;
  onSelectItem: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
}

function getItemIcon(item: TreeItemType) {
  if (item.type === 'reference-geometry') {
    // Check if it's a group or an actual item
    if (item.children) {
      return <Plane className="h-4 w-4 text-muted-foreground" />;
    }
    const data = item.data as { type: string };
    if (data?.type === 'origin') {
      return <Crosshair className="h-4 w-4 text-primary" />;
    }
    return <Plane className="h-4 w-4 text-primary" />;
  }
  
  if (item.type === 'sketch') {
    return <PenTool className="h-4 w-4 text-accent" />;
  }
  
  if (item.type === 'feature') {
    return <Box className="h-4 w-4 text-accent" />;
  }
  
  return null;
}

function TreeItem({ item, depth, selectedItem, onSelectItem, onToggleExpand }: TreeItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = item.isExpanded !== false; // Default to expanded
  const isSelected = selectedItem === item.id;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-7 w-full justify-start gap-1 rounded-sm px-1 text-xs font-normal text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isSelected && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => onSelectItem(item.id)}
      >
        {hasChildren ? (
          <button
            className="flex h-4 w-4 items-center justify-center hover:bg-sidebar-border rounded-sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {getItemIcon(item)}
        <span className="truncate">{item.name}</span>
      </Button>

      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedItem={selectedItem}
              onSelectItem={onSelectItem}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FeatureTree({ items, selectedItem, onSelectItem, onToggleExpand }: FeatureTreeProps) {
  return (
    <div className="flex flex-col">
      <div className="border-b border-sidebar-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Feature Tree
        </h2>
      </div>
      <div className="flex-1 overflow-auto p-1 scrollbar-cad">
        {items.map((item) => (
          <TreeItem
            key={item.id}
            item={item}
            depth={0}
            selectedItem={selectedItem}
            onSelectItem={onSelectItem}
            onToggleExpand={onToggleExpand}
          />
        ))}
        
        {items.length <= 1 && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            Create sketches and features to populate the tree
          </div>
        )}
      </div>
    </div>
  );
}