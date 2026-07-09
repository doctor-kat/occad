import type { ReactNode } from 'react';
import type { Operation } from '@/cad/types';

export interface OperationGroupOption {
  id: Operation;
  icon: ReactNode;
  label: string;
  disabled?: boolean;
}
