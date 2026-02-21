export interface ShellParams {
  /** Thickness of the shell (positive for outward, negative for inward) */
  thickness: number;
  /** Face references to remove (open the shell) */
  faces: string[];
}
