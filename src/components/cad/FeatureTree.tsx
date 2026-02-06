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
    if (item.children) {
      return <Plane className="h-4 w-4 text-primary" />;
    }
    const data = item.data as { type: string };
    if (data?.type === 'origin') {
      return <Crosshair className="h-4 w-4 text-warning" />;
    }
    return <Plane className="h-4 w-4 text-info" />;
  }
  
  if (item.type === 'sketch') {
    return <PenTool className="h-4 w-4 text-accent" />;
  }
  
  if (item.type === 'feature') {
    return <Box className="h-4 w-4 text-success" />;
  }
  
  return null;
}

function TreeItem({ item, depth, selectedItem, onSelectItem, onToggleExpand }: TreeItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = item.isExpanded !== false;
  const isSelected = selectedItem === item.id;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 w-full justify-start gap-1.5 rounded-md px-2 text-xs font-medium',
          'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          'transition-colors duration-150',
          isSelected && 'bg-primary/15 text-primary ring-1 ring-primary/20 hover:bg-primary/20'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelectItem(item.id)}
      >
        {hasChildren ? (
          <button
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-sidebar-border transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(item.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
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
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Feature Tree
        </h2>
      </div>
      <div className="flex-1 overflow-auto p-2 scrollbar-cad">
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
          <div className="mt-4 rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/30 px-4 py-6 text-center">
            <PenTool className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              Create sketches and features to populate the tree
            </p>
          </div>
        )}
      </div>
    </div>
  );
}