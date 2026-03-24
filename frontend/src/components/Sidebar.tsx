import type { Project } from '../api/types';
import { RefreshCw, Plus } from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
}

export default function Sidebar({ projects, selectedId, onSelect, onNew, onRefresh }: SidebarProps) {
  return (
    <aside
      className="flex flex-col shrink-0"
      style={{ width: '216px', background: '#f8f9fb', borderRight: '1px solid #e3e5e8' }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ height: '52px', borderBottom: '1px solid #e3e5e8', paddingLeft: '24px', paddingRight: '16px' }}
      >
        <div className="flex items-center gap-2.5">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#3b82f6' }} />
            <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#93c5fd' }} />
            <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#bfdbfe' }} />
            <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: '#60a5fa' }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.03em', color: '#111827' }}>
            gosok
          </span>
        </div>
        <button
          onClick={onRefresh}
          style={{
            width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#9ca3af',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#e9eaec'; e.currentTarget.style.color = '#6b7280'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
          title="Refresh"
        >
          <RefreshCw style={{ width: '12px', height: '12px' }} />
        </button>
      </div>

      {/* Section label */}
      <div style={{ padding: '14px 24px 5px', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase' }}>
        Projects
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '2px 14px' }}>
        {projects.map((p) => {
          const isActive = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="w-full text-left transition-all"
              style={{
                display: 'block',
                padding: '7px 10px 7px 8px',
                marginBottom: '1px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: isActive ? '#ffffff' : 'transparent',
                borderLeft: `2px solid ${isActive ? '#3b82f6' : 'transparent'}`,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#eef0f3'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{
                fontSize: '12.5px', fontWeight: isActive ? 600 : 400,
                color: isActive ? '#111827' : '#374151',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.4',
              }}>
                {p.name}
              </div>
              <div style={{
                fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
              }}>
                {p.path}
              </div>
            </button>
          );
        })}
        {projects.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#c9d0d8' }}>No projects yet</div>
          </div>
        )}
      </div>

      {/* New Project button */}
      <div style={{ padding: '10px' }}>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 transition-all"
          style={{
            padding: '8px 12px', borderRadius: '6px',
            border: '1px solid #e3e5e8', background: '#ffffff',
            color: '#3b82f6', fontSize: '12.5px', fontWeight: 500, cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e3e5e8'; }}
        >
          <Plus style={{ width: '13px', height: '13px' }} />
          New Project
        </button>
      </div>
    </aside>
  );
}
