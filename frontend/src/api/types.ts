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
  last_activity?: number; // UnixMilli
}

export interface Shortcut {
  label: string;
  command: string;
  enabled: boolean;
  appendEnter?: boolean;
}

export interface Message {
  id: string;
  scope: 'direct' | 'broadcast' | 'global';
  from_tab_id: string;
  to_tab_id: string;
  body: string;
  created_at: string;
}
