import type { Project, Agent, AgentStatus } from './types';

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

// Agents
export const listAgents = (projectId: string) =>
  request<Agent[]>(`/projects/${projectId}/agents`);
export const createAgent = (projectId: string, data: { name: string; agent_type: string; command?: string }) =>
  request<Agent>(`/projects/${projectId}/agents`, { method: 'POST', body: JSON.stringify(data) });
export const getAgent = (id: string) => request<Agent>(`/agents/${id}`);
export const updateAgent = (id: string, data: Partial<{ name: string; agent_type: string; command: string }>) =>
  request<Agent>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAgent = (id: string) =>
  request<void>(`/agents/${id}`, { method: 'DELETE' });

// Agent lifecycle
export const startAgent = (id: string) =>
  request<AgentStatus>(`/agents/${id}/start`, { method: 'POST' });
export const stopAgent = (id: string) =>
  request<AgentStatus>(`/agents/${id}/stop`, { method: 'POST' });
export const restartAgent = (id: string) =>
  request<AgentStatus>(`/agents/${id}/restart`, { method: 'POST' });
