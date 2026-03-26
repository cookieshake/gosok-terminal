import { useRef, useState } from 'react';
import type { Project } from '../api/types';
import * as api from '../api/client';
import { RefreshCw, Plus, Pencil, PanelLeftClose, PanelLeftOpen, Settings, Trash2, Check, X, LayoutDashboard } from 'lucide-react';

export interface SidebarStats {
  totalProjects: number;
  runningSessions: number;
  totalTabs: number;
}

interface SidebarProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
  onEdit: (id: string, data: { name: string; path: string }) => void;
  onDelete: (id: string) => void;
  onDashboard: () => void;
  isDashboardActive?: boolean;
  stats: SidebarStats;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onSettings: () => void;
  isSettingsActive?: boolean;
  onReorder: (ids: string[]) => void;
  width?: number;
}

function ProjectEditForm({ project, onSave, onDelete, onCancel }: {
  project: Project;
  onSave: (data: { name: string; path: string }) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(project.name);
  const [path, setPath] = useState(project.path);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '4px 6px', borderRadius: '2px',
    border: '1px solid #C8A870', background: '#FDF6E8', color: '#1E1008',
    fontSize: '0.75rem', outline: 'none',
  };

  return (
    <div
      style={{ padding: '8px', background: '#FDF6E8', border: '2px solid #3D2410', borderRadius: '3px', boxShadow: '3px 3px 0 #3D2410' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: '6px' }}>
        <label style={{ fontSize: '0.594rem', fontWeight: 700, color: '#8B5E30', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          autoFocus
          onFocus={(e) => e.target.select()}
        />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '0.594rem', fontWeight: 700, color: '#8B5E30', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Path</label>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.6875rem' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
        <button
          onClick={() => { if (confirm('Delete this project?')) onDelete(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            padding: '3px 8px', borderRadius: '2px', border: '1px solid #C94A28',
            background: 'transparent', color: '#C94A28', fontSize: '0.6875rem', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F5D0C4'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Trash2 style={{ width: '10px', height: '10px' }} />
          Delete
        </button>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={onCancel}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '3px 8px', borderRadius: '2px', border: '1px solid #C8A870',
              background: 'transparent', color: '#8B5E30', fontSize: '0.6875rem', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E8D4B0'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X style={{ width: '10px', height: '10px' }} />
          </button>
          <button
            onClick={() => { if (name.trim()) onSave({ name: name.trim(), path: path.trim() }); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '3px 8px', borderRadius: '2px', border: '1px solid #2E8B84',
              background: '#2E8B84', color: '#FDF6E8', fontSize: '0.6875rem', cursor: 'pointer', fontWeight: 600,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1A7A6A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2E8B84'; }}
          >
            <Check style={{ width: '10px', height: '10px' }} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  projects, selectedId, onSelect, onNew, onRefresh, onEdit, onDelete,
  onDashboard, isDashboardActive = false, stats,
  collapsed, onToggleCollapse, isMobile = false, isOpen = false,
  onSettings, isSettingsActive = false, onReorder, width = 216,
}: SidebarProps) {
  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const iconBtn = {
    width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '3px', border: '1px solid transparent', cursor: 'pointer',
    background: 'transparent', color: '#8B5E30',
    transition: 'all 0.1s', flexShrink: 0,
  } as React.CSSProperties;

  const mobileStyle: React.CSSProperties = isMobile ? {
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.25s ease',
    boxShadow: isOpen ? '4px 0 0 #3D2410' : 'none',
  } : {};

  if (!isMobile && collapsed) {
    return (
      <aside
        className="flex flex-col items-center shrink-0"
        style={{ width: '48px', background: '#E8D4B0', borderRight: '2px solid #3D2410', transition: 'width 0.2s' }}
      >
        <div style={{ height: '52px', borderBottom: '2px solid #3D2410', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <button
            onClick={onToggleCollapse}
            style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#FDF6E8'; e.currentTarget.style.borderColor = '#C8A870'; e.currentTarget.style.color = '#5C3A18'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#8B5E30'; }}
            title="Expand sidebar"
          >
            <PanelLeftOpen style={{ width: '14px', height: '14px' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full" style={{ padding: '6px 0' }}>
          {projects.map((p) => {
            const isActive = p.id === selectedId;
            return (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'center', marginBottom: '2px' }}>
                <button
                  onClick={() => onSelect(p.id)}
                  title={p.name}
                  style={{
                    width: '28px', height: '28px', borderRadius: '3px',
                    border: isActive ? '2px solid #3D2410' : '1px solid transparent',
                    cursor: 'pointer',
                    background: isActive ? '#FDF6E8' : 'transparent',
                    boxShadow: isActive ? '2px 2px 0 #3D2410' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#DCC898'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isActive ? '#FDF6E8' : 'transparent'; }}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#2E8B84' : '#8B5E30' }} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={onSettings}
            style={{ ...iconBtn, color: isSettingsActive ? '#2E8B84' : '#8B5E30', border: isSettingsActive ? '2px solid #3D2410' : '1px solid transparent', background: isSettingsActive ? '#FDF6E8' : 'transparent' }}
            onMouseEnter={e => { if (!isSettingsActive) { e.currentTarget.style.background = '#FDF6E8'; e.currentTarget.style.borderColor = '#C8A870'; } }}
            onMouseLeave={e => { if (!isSettingsActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
            title="Settings"
          >
            <Settings style={{ width: '14px', height: '14px' }} />
          </button>
          <button
            onClick={onNew}
            style={{ ...iconBtn, color: '#2E8B84' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FDF6E8'; e.currentTarget.style.borderColor = '#C8A870'; e.currentTarget.style.color = '#1A7A6A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#2E8B84'; }}
            title="New Project"
          >
            <Plus style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{ width: isMobile ? '216px' : `${width}px`, background: '#E8D4B0', borderRight: '2px solid #3D2410', ...mobileStyle }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ height: '52px', borderBottom: '2px solid #3D2410', paddingLeft: '16px', paddingRight: '10px', background: '#DCC898' }}
      >
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" style={{ width: '22px', height: '22px', flexShrink: 0 }}>
            <rect x="1" y="1" width="30" height="30" rx="2" fill="#3D2410"/>
            <rect x="4" y="4" width="24" height="17" rx="1" fill="#2E8B84"/>
            <polyline points="9,9 13.5,12.5 9,16" fill="none" stroke="#FDF6E8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="15.5" y1="16" x2="23" y2="16" stroke="#FDF6E8" strokeWidth="2" strokeLinecap="round"/>
            <rect x="1" y="22" width="30" height="1.5" fill="#3D2410"/>
            <rect x="3" y="24.5" width="7" height="4" rx="1" fill="#D9A030"/>
            <rect x="22" y="24.5" width="7" height="4" rx="1" fill="#D9A030"/>
            <rect x="12" y="24.5" width="8" height="4" rx="1" fill="#3D2410"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.05em', color: '#1E1008', textTransform: 'uppercase' }}>
            gosok
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onRefresh}
            style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#FDF6E8'; e.currentTarget.style.borderColor = '#C8A870'; e.currentTarget.style.color = '#5C3A18'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#8B5E30'; }}
            title="Refresh"
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
          </button>
          <button
            onClick={onToggleCollapse}
            style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#FDF6E8'; e.currentTarget.style.borderColor = '#C8A870'; e.currentTarget.style.color = '#5C3A18'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#8B5E30'; }}
            title={isMobile ? 'Close sidebar' : 'Collapse sidebar'}
          >
            <PanelLeftClose style={{ width: '12px', height: '12px' }} />
          </button>
        </div>
      </div>

      {/* Overview */}
      <div style={{ padding: '10px 10px 0' }}>
        <button
          onClick={onDashboard}
          className="w-full transition-all"
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 8px', borderRadius: '3px',
            border: isDashboardActive ? '2px solid #3D2410' : '2px solid transparent',
            cursor: 'pointer',
            background: isDashboardActive ? '#FDF6E8' : 'transparent',
            boxShadow: isDashboardActive ? '2px 2px 0 #3D2410' : 'none',
          }}
          onMouseEnter={e => { if (!isDashboardActive) { e.currentTarget.style.background = '#DCC898'; e.currentTarget.style.borderColor = '#C8A870'; } }}
          onMouseLeave={e => { if (!isDashboardActive) { e.currentTarget.style.background = isDashboardActive ? '#FDF6E8' : 'transparent'; e.currentTarget.style.borderColor = isDashboardActive ? '#3D2410' : 'transparent'; } }}
        >
          <LayoutDashboard style={{ width: '14px', height: '14px', flexShrink: 0, color: isDashboardActive ? '#2E8B84' : '#8B5E30' }} />
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: isDashboardActive ? 700 : 500, color: isDashboardActive ? '#1E1008' : '#5C3A18' }}>
              Overview
            </div>
            <div style={{ fontSize: '0.594rem', color: '#8B5E30', marginTop: '1px' }}>
              {stats.totalProjects} project{stats.totalProjects !== 1 ? 's' : ''}
              {stats.runningSessions > 0 && (
                <span> · <span style={{ color: '#2E8B84', fontWeight: 600 }}>{stats.runningSessions} active</span></span>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* Section label */}
      <div style={{ padding: '14px 16px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.594rem', fontWeight: 700, letterSpacing: '0.15em', color: '#8B5E30', textTransform: 'uppercase' }}>
          Projects
        </span>
        <button
          onClick={onNew}
          style={{
            width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '3px', border: '1px solid transparent', cursor: 'pointer',
            background: 'transparent', color: '#8B5E30', padding: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FDF6E8'; e.currentTarget.style.borderColor = '#C8A870'; e.currentTarget.style.color = '#2E8B84'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#8B5E30'; }}
          title="New Project"
        >
          <Plus style={{ width: '12px', height: '12px' }} />
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '2px 10px' }}>
        {projects.map((p) => {
          const isActive = p.id === selectedId;
          const isEditing = editingId === p.id;

          if (isEditing) {
            return (
              <div key={p.id} style={{ marginBottom: '3px' }}>
                <ProjectEditForm
                  project={p}
                  onSave={(data) => { onEdit(p.id, data); setEditingId(null); }}
                  onDelete={() => { onDelete(p.id); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            );
          }

          return (
            <div
              key={p.id}
              className="group relative transition-all"
              draggable
              onDragStart={() => { dragId.current = p.id; }}
              onDragOver={(e) => { e.preventDefault(); dragOverId.current = p.id; e.currentTarget.style.opacity = '0.5'; }}
              onDragLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              onDrop={(e) => {
                e.currentTarget.style.opacity = '1';
                if (!dragId.current || dragId.current === dragOverId.current) return;
                const ids = projects.map(x => x.id);
                const from = ids.indexOf(dragId.current);
                const to = ids.indexOf(dragOverId.current!);
                ids.splice(from, 1);
                ids.splice(to, 0, dragId.current);
                dragId.current = null;
                dragOverId.current = null;
                onReorder(ids);
                api.reorderProjects(ids);
              }}
              onDragEnd={() => { dragId.current = null; dragOverId.current = null; }}
              style={{
                marginBottom: '3px', borderRadius: '3px',
                background: isActive ? '#FDF6E8' : 'transparent',
                border: isActive ? '2px solid #3D2410' : '2px solid transparent',
                boxShadow: isActive ? '3px 3px 0 #3D2410' : 'none',
                cursor: 'grab',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#DCC898'; e.currentTarget.style.borderColor = '#C8A870'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
            >
              <button
                onClick={() => onSelect(p.id)}
                className="w-full text-left"
                style={{ display: 'block', padding: '7px 24px 7px 8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
              >
                <div style={{
                  fontSize: '0.781rem', fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#1E1008' : '#5C3A18',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.4',
                }}>
                  {p.name}
                </div>
                <div style={{
                  fontSize: '0.625rem', color: '#8B5E30', fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
                }}>
                  {p.path}
                </div>
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute"
                onClick={(e) => { e.stopPropagation(); setEditingId(p.id); }}
                style={{
                  top: '50%', right: '6px', transform: 'translateY(-50%)',
                  width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '3px', border: 'none', cursor: 'pointer',
                  background: 'transparent', color: '#8B5E30', padding: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FDF6E8'; e.currentTarget.style.color = '#5C3A18'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B5E30'; }}
                title="Edit project"
              >
                <Pencil style={{ width: '11px', height: '11px' }} />
              </button>
            </div>
          );
        })}
        {projects.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6875rem', color: '#C8A870' }}>No projects yet</div>
          </div>
        )}
      </div>

      {/* Settings button */}
      <div style={{ padding: '0 10px', paddingBottom: 'max(4px, env(safe-area-inset-bottom))' }}>
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2 transition-all"
          style={{
            padding: '7px 10px', borderRadius: '3px',
            border: isSettingsActive ? '2px solid #3D2410' : '2px solid transparent',
            cursor: 'pointer',
            background: isSettingsActive ? '#FDF6E8' : 'transparent',
            boxShadow: isSettingsActive ? '2px 2px 0 #3D2410' : 'none',
            color: isSettingsActive ? '#2E8B84' : '#8B5E30',
            fontSize: '0.75rem', fontWeight: isSettingsActive ? 700 : 400,
          }}
          onMouseEnter={e => { if (!isSettingsActive) { e.currentTarget.style.background = '#DCC898'; e.currentTarget.style.borderColor = '#C8A870'; e.currentTarget.style.color = '#5C3A18'; } }}
          onMouseLeave={e => { if (!isSettingsActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#8B5E30'; } }}
        >
          <Settings style={{ width: '13px', height: '13px', flexShrink: 0 }} />
          Settings
        </button>
      </div>

    </aside>
  );
}
