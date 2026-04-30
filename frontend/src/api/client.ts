import type { Project, Tab, TabStatus, Message } from './types';

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
export const listDirs = (path?: string, hidden = false) => {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  if (hidden) params.set('hidden', 'true');
  const qs = params.toString();
  return request<DirListing>(`/fs/dirs${qs ? `?${qs}` : ''}`);
};

export interface FileEntry { name: string; path: string; is_dir: boolean; }
export const listFiles = (path: string, hidden = false) => {
  const params = new URLSearchParams({ path });
  if (hidden) params.set('hidden', 'true');
  return request<FileEntry[]>(`/fs/files?${params.toString()}`);
};

export const readFile = (path: string) =>
  request<{ path: string; content: string }>(`/fs/file?path=${encodeURIComponent(path)}`);

export const writeFile = (path: string, content: string) =>
  request<void>(`/fs/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });

// Messages
export const sendMessage = (data: { scope: string; from_tab_id?: string; to_tab_id?: string; body: string }) =>
  request<Message>('/messages', { method: 'POST', body: JSON.stringify(data) });

export const getInbox = (tabId: string, since?: string) =>
  request<Message[]>(`/messages/inbox/${tabId}${since ? `?since=${encodeURIComponent(since)}` : ''}`);

export const getFeed = (since?: string) =>
  request<Message[]>(`/messages/feed${since ? `?since=${encodeURIComponent(since)}` : ''}`);

export const markInboxRead = (tabId: string, lastReadId: string) =>
  request<void>(`/messages/inbox/${tabId}/read`, { method: 'PUT', body: JSON.stringify({ last_read_id: lastReadId }) });

export const markFeedRead = (tabId: string, lastReadId: string) =>
  request<void>(`/messages/feed/read/${tabId}`, { method: 'PUT', body: JSON.stringify({ last_read_id: lastReadId }) });

export const sendNotification = (data: { title: string; body?: string }) =>
  request<void>('/notify', { method: 'POST', body: JSON.stringify(data) });

// Diff
export const listDiffFiles = (id: string, staged = false) =>
  request<{ path: string; status: string }[]>(`/projects/${id}/diff?staged=${staged}`);
export const getDiffFile = (
  id: string,
  path: string,
  opts: { staged?: boolean; ref?: string } = {},
) => {
  const params = new URLSearchParams({ path });
  if (opts.ref) params.set('ref', opts.ref);
  else if (opts.staged) params.set('staged', 'true');
  return request<{ original: string; modified: string }>(
    `/projects/${id}/diff/file?${params.toString()}`,
  );
};

export interface CommitEntry {
  sha: string;
  short_sha: string;
  subject: string;
  author: string;
  time: string;
}
export const listCommits = (id: string, limit = 100) =>
  request<CommitEntry[]>(`/projects/${id}/commits?limit=${limit}`);
export const listCommitFiles = (id: string, sha: string) =>
  request<{ path: string; status: string }[]>(`/projects/${id}/commits/${sha}/files`);
