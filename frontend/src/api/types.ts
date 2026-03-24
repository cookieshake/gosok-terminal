export interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  project_id: string;
  name: string;
  agent_type: AgentType;
  command: string;
  args: string;
  env: string;
  created_at: string;
  updated_at: string;
  status: AgentStatus;
}

export interface AgentStatus {
  agent_id: string;
  status: 'stopped' | 'running' | 'starting';
  session_id?: string;
}

export type AgentType = 'shell' | 'claude-code' | 'codex' | 'gemini-cli' | 'opencode';

export const AGENT_TYPES: Record<AgentType, { label: string; command: string }> = {
  'shell':       { label: 'Shell',       command: '$SHELL' },
  'claude-code': { label: 'Claude Code', command: 'claude' },
  'codex':       { label: 'Codex',       command: 'codex' },
  'gemini-cli':  { label: 'Gemini CLI',  command: 'gemini' },
  'opencode':    { label: 'OpenCode',    command: 'opencode' },
};
