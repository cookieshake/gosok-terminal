import type { Project, Tab, TabStatus } from './types';

const BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Projects
export const listProjects = () => request<Project[]>('/projects');
export const getProject = (id: string) => request<Project>(`/projects/${id}`);
export const createProject = (data: { name: string; path: string; description?: string }) =>
  request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id: string, data: Partial<{ name: string; path: string; description: string }>) =>
  request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProject = (id: string) =>
  request<void>(`/projects/${id}`, { method: 'DELETE' });

// Tabs
export const listTabs = (projectId: string) =>
  request<Tab[]>(`/projects/${projectId}/tabs`);
export const createTab = (projectId: string, data: { name: string; tab_type: string; command?: string }) =>
  request<Tab>(`/projects/${projectId}/tabs`, { method: 'POST', body: JSON.stringify(data) });
export const getTab = (id: string) => request<Tab>(`/tabs/${id}`);
export const updateTab = (id: string, data: Partial<{ name: string; tab_type: string; command: string }>) =>
  request<Tab>(`/tabs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTab = (id: string) =>
  request<void>(`/tabs/${id}`, { method: 'DELETE' });

// Tab lifecycle
export const startTab = (id: string) =>
  request<TabStatus>(`/tabs/${id}/start`, { method: 'POST' });
export const stopTab = (id: string) =>
  request<TabStatus>(`/tabs/${id}/stop`, { method: 'POST' });
export const restartTab = (id: string) =>
  request<TabStatus>(`/tabs/${id}/restart`, { method: 'POST' });

export const setTabTitle = (id: string, title: string) =>
  request<void>(`/tabs/${id}/title`, { method: 'PUT', body: JSON.stringify({ title }) });

export const reorderProjects = (ids: string[]) =>
  request<void>(`/projects/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) });

export const reorderTabs = (ids: string[]) =>
  request<void>(`/tabs/reorder`, { method: 'PUT', body: JSON.stringify({ ids }) });

// Settings
export const listSettings = () =>
  request<Record<string, unknown>>('/settings');

export const getSetting = <T>(key: string) =>
  request<T>(`/settings/${key}`);

export const setSetting = (key: string, value: unknown) =>
  request<unknown>(`/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });

export const resetSetting = (key: string) =>
  request<unknown>(`/settings/${key}`, { method: 'DELETE' });

// Filesystem
export interface DirEntry { name: string; path: string; }
export interface DirListing { path: string; parent: string; entries: DirEntry[]; }
export const listDirs = (path?: string) =>
  request<DirListing>(`/fs/dirs${path ? `?path=${encodeURIComponent(path)}` : ''}`);

export interface FileEntry { name: string; path: string; is_dir: boolean; }
export const listFiles = (path: string) =>
  request<FileEntry[]>(`/fs/files?path=${encodeURIComponent(path)}`);

export const readFile = (path: string) =>
  request<{ path: string; content: string }>(`/fs/file?path=${encodeURIComponent(path)}`);

export const writeFile = (path: string, content: string) =>
  request<void>(`/fs/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });

// Diff
export const listDiffFiles = (id: string, staged = false) =>
  request<{ path: string; status: string }[]>(`/projects/${id}/diff?staged=${staged}`);
export const getDiffFile = (id: string, path: string, staged = false) =>
  request<{ original: string; modified: string }>(`/projects/${id}/diff/file?path=${encodeURIComponent(path)}&staged=${staged}`);
