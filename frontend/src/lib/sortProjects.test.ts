import { describe, it, expect } from 'vitest';
import { sortProjects } from './sortProjects';
import type { Project } from '../api/types';

function proj(id: string, name: string): Project {
  return { id, name, path: '', description: '', created_at: '', updated_at: '' };
}

const apple = proj('1', 'apple');
const banana = proj('2', 'Banana');
const cherry = proj('3', 'cherry');
const date = proj('4', 'date');
const base = [apple, banana, cherry, date];

describe('sortProjects', () => {
  it('manual returns the list unchanged', () => {
    const out = sortProjects(base, { mode: 'manual', runningProjectIds: new Set() });
    expect(out.map(p => p.id)).toEqual(['1', '2', '3', '4']);
  });

  it('alphabetical sorts by name case-insensitively', () => {
    const out = sortProjects(base, { mode: 'alphabetical', runningProjectIds: new Set() });
    expect(out.map(p => p.name)).toEqual(['apple', 'Banana', 'cherry', 'date']);
  });

  it('running_first floats running projects to the top, preserving base order within each group', () => {
    const out = sortProjects(base, { mode: 'running_first', runningProjectIds: new Set(['3']) });
    expect(out.map(p => p.id)).toEqual(['3', '1', '2', '4']);
  });

  it('running_first with no running projects keeps base order', () => {
    const out = sortProjects(base, { mode: 'running_first', runningProjectIds: new Set() });
    expect(out.map(p => p.id)).toEqual(['1', '2', '3', '4']);
  });

  it('running_first_alpha floats running to the top with alphabetical order within each group', () => {
    const out = sortProjects(base, { mode: 'running_first_alpha', runningProjectIds: new Set(['4', '1']) });
    // alpha base: apple(1), Banana(2), cherry(3), date(4)
    // running {1,4} float up keeping alpha order: apple(1), date(4), then Banana(2), cherry(3)
    expect(out.map(p => p.id)).toEqual(['1', '4', '2', '3']);
  });

  it('does not mutate the input array', () => {
    const input = [...base];
    sortProjects(input, { mode: 'running_first', runningProjectIds: new Set(['3']) });
    expect(input.map(p => p.id)).toEqual(['1', '2', '3', '4']);
  });
});
