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
