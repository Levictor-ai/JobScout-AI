import type { AtsType } from '@/types';
import { ashbyAdapter } from './ashby';
import { greenhouseAdapter } from './greenhouse';
import type { JobSourceAdapter } from './types';

const ADAPTERS: Partial<Record<AtsType, JobSourceAdapter>> = {
  greenhouse: greenhouseAdapter,
  ashby: ashbyAdapter,
};

export function getAdapter(atsType: AtsType): JobSourceAdapter | null {
  return ADAPTERS[atsType] ?? null;
}

export function listSupportedSources(): AtsType[] {
  return Object.keys(ADAPTERS) as AtsType[];
}

export type { JobSourceAdapter, NormalizedJob, SourceConfig } from './types';
export { SourceError } from './types';
