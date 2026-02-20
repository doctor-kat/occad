/** Rebuild state tracking */
export interface RebuildState {
  /** Whether a rebuild is currently in progress */
  isRebuilding: boolean;
  /** Current rebuild progress (0-1) */
  progress: number;
  /** Error message if rebuild failed */
  error?: string;
  /** ID of feature currently being rebuilt */
  currentFeatureId?: string;
}
