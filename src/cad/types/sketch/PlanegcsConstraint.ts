/** A planegcs constraint object (loose — planegcs uses a structural union). */
export type PlanegcsConstraint = Record<string, any> & { id: string; type: string };
