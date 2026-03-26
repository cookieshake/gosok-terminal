export interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Tab {
  id: string;
  project_id: string;
  name: string;
  title: string;
  tab_type: TabType;
  command: string;
  args: string;
  env: string;
  created_at: string;
  updated_at: string;
  status: TabStatus;
}

export interface TabStatus {
  tab_id: string;
  status: 'stopped' | 'running' | 'starting';
  session_id?: string;
}

export type TabType = 'shell' | 'claude-code' | 'codex' | 'gemini-cli' | 'opencode' | 'editor';

export const TAB_TYPES: Record<TabType, { label: string; command: string }> = {
  'shell':       { label: 'Shell',       command: '$SHELL' },
  'claude-code': { label: 'Claude Code', command: 'claude' },
  'codex':       { label: 'Codex',       command: 'codex' },
  'gemini-cli':  { label: 'Gemini CLI',  command: 'gemini' },
  'opencode':    { label: 'OpenCode',    command: 'opencode' },
  'editor':      { label: 'Editor',      command: '' },
};

export interface Shortcut {
  type: string;
  label: string;
  command: string;
  enabled: boolean;
  appendEnter?: boolean;
}
