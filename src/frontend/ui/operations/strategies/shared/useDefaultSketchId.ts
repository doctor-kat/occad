import { useState } from 'react';
import type { CADProject } from '@/cad/types';

/**
 * Initial sketch selection shared by extrude/revolve: prefer the sketch being
 * edited (`initialSketchId`), then the sketch selected in the tree, then the
 * first closed sketch. A lazy `useState` initializer, not an effect — this is
 * the eventual fix noted in ROADMAP's `no-adjust-state-on-prop-change` entry.
 */
export function useDefaultSketchId(project: CADProject, initialSketchId: string | undefined, selectedTreeItem: string | null | undefined) {
  return useState<string>(() => {
    if (initialSketchId) return initialSketchId;
    const selectedSketch = project.sketches.find((s) => s.id === selectedTreeItem);
    if (selectedSketch) return selectedSketch.id;
    const closedSketches = project.sketches.filter((s) => s.isClosed);
    return closedSketches.length > 0 ? closedSketches[0].id : '';
  });
}
