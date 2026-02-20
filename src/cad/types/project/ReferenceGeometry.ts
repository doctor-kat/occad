export enum ReferenceGeometryType {
  PLANE = 'plane',
  ORIGIN = 'origin'
}

export interface ReferenceGeometry {
  id: string;
  name: string;
  type: ReferenceGeometryType;
  isVisible: boolean;
}

// Default reference geometry that always exists
export const DEFAULT_REFERENCE_GEOMETRY: ReferenceGeometry[] = [
  { id: 'front-plane', name: 'Front Plane', type: ReferenceGeometryType.PLANE, isVisible: false },
  { id: 'top-plane', name: 'Top Plane', type: ReferenceGeometryType.PLANE, isVisible: false },
  { id: 'right-plane', name: 'Right Plane', type: ReferenceGeometryType.PLANE, isVisible: false },
  { id: 'origin', name: 'Origin', type: ReferenceGeometryType.ORIGIN, isVisible: false },
];
