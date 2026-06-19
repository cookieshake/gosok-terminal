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
  it('manual + activeFirst off returns the list unchanged', () => {
    const out = sortProjects(base, { activeFirst: false, mode: 'manual', runningProjectIds: new Set() });
    expect(out.map(p => p.id)).toEqual(['1', '2', '3', '4']);
  });

  it('alphabetical sorts by name case-insensitively', () => {
    const out = sortProjects(base, { activeFirst: false, mode: 'alphabetical', runningProjectIds: new Set() });
    expect(out.map(p => p.name)).toEqual(['apple', 'Banana', 'cherry', 'date']);
  });

  it('activeFirst floats running projects to the top, preserving base order within each group', () => {
    const out = sortProjects(base, { activeFirst: true, mode: 'manual', runningProjectIds: new Set(['3']) });
    expect(out.map(p => p.id)).toEqual(['3', '1', '2', '4']);
  });

  it('activeFirst combines with alphabetical base order', () => {
    const out = sortProjects(base, { activeFirst: true, mode: 'alphabetical', runningProjectIds: new Set(['4', '1']) });
    // base alpha order: apple(1), Banana(2), cherry(3), date(4)
    // running = {1,4} float up keeping alpha order: apple(1), date(4), then Banana(2), cherry(3)
    expect(out.map(p => p.id)).toEqual(['1', '4', '2', '3']);
  });

  it('does not mutate the input array', () => {
    const input = [...base];
    sortProjects(input, { activeFirst: true, mode: 'alphabetical', runningProjectIds: new Set(['3']) });
    expect(input.map(p => p.id)).toEqual(['1', '2', '3', '4']);
  });
});
