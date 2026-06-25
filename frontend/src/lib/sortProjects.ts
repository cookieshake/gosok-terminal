import type { Project } from '../api/types';

export type SortMode = 'manual' | 'alphabetical' | 'running_first' | 'running_first_alpha';

export interface SortOptions {
  mode: SortMode;
  runningProjectIds: Set<string>;
}

// Pure view-layer ordering. Never mutates input or backend sort_order.
export function sortProjects(projects: Project[], opts: SortOptions): Project[] {
  // 1. Base order.
  let base = [...projects];
  if (opts.mode === 'alphabetical' || opts.mode === 'running_first_alpha') {
    base.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  // 2. Float running projects to the top via a stable partition (base order kept within each group).
  if (opts.mode === 'running_first' || opts.mode === 'running_first_alpha') {
    const top = base.filter(p => opts.runningProjectIds.has(p.id));
    const bottom = base.filter(p => !opts.runningProjectIds.has(p.id));
    base = [...top, ...bottom];
  }

  return base;
}
