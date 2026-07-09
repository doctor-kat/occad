import type { ReactNode } from 'react';
import type { Operation } from '@/cad/types';

export type OperationItem = { id: Operation; icon: ReactNode; label: string };
