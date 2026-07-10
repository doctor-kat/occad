import { createContext, useContext } from 'react';

export interface FeatureTreeActions {
  onSelectItem: (id: string | null) => void;
  onToggleExpand: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReorder?: (draggedId: string, targetId: string, place: 'before' | 'after') => void;
}

// TreeItem recurses through the feature tree and needs the same CRUD/reorder
// callbacks (owned by useCADState) at every level. A plain Context — provided
// once by CADSidebar around <FeatureTree> — avoids re-threading them as props
// through TreeItem's recursive call without pulling in a module-level Zustand
// store for what's a single-provider, single-consumer-tree relationship
// (selection itself lives in viewportStore.ts since it's read far more broadly).
const FeatureTreeActionsContext = createContext<FeatureTreeActions | null>(null);

export const FeatureTreeActionsProvider = FeatureTreeActionsContext.Provider;

export function useFeatureTreeActions(): FeatureTreeActions {
  const ctx = useContext(FeatureTreeActionsContext);
  if (!ctx) throw new Error('useFeatureTreeActions must be used within a FeatureTreeActionsProvider');
  return ctx;
}
