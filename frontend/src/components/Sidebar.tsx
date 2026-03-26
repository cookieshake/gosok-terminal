import { useRef } from 'react';
import type { Project } from '../api/types';
import * as api from '../api/client';
import { RefreshCw, Plus, Trash2, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';

interface SidebarProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRefresh: () => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onSettings: () => void;
  isSettingsActive?: boolean;
  onReorder: (ids: string[]) => void;
}

export default function Sidebar({
  projects, selectedId, onSelect, onNew, onRefresh, onDelete,
  collapsed, onToggleCollapse, isMobile = false, isOpen = false,
  onSettings, isSettingsActive = false, onReorder,
}: SidebarProps) {
  const dragId = useRef<string | null>(null);
  const dragOverId = useRef<string | null>(null);
  const iconBtn = {
    width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '5px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#9ca3af',
    transition: 'all 0.15s', flexShrink: 0,
  } as React.CSSProperties;

  const mobileStyle: React.CSSProperties = isMobile ? {
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.25s ease',
    boxShadow: isOpen ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
  } : {};

  if (!isMobile && collapsed) {
    return (
      <aside
        className="flex flex-col items-center shrink-0"
        style={{ width: '48px', background: '#f8f9fb', borderRight: '1px solid #e3e5e8', transition: 'width 0.2s' }}
      >
        <div style={{ height: '52px', borderBottom: '1px solid #e3e5e8', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <button
            onClick={onToggleCollapse}
            style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#e9eaec'; e.currentTarget.style.color = '#6b7280'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
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
                    width: '28px', height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: isActive ? '#ffffff' : 'transparent',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#eef0f3'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isActive ? '#ffffff' : 'transparent'; }}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#3b82f6' : '#9ca3af' }} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={onSettings}
            style={{ ...iconBtn, color: isSettingsActive ? '#3b82f6' : '#9ca3af' }}
            onMouseEnter={e => { if (!isSettingsActive) e.currentTarget.style.background = '#eff6ff'; }}
            onMouseLeave={e => { if (!isSettingsActive) e.currentTarget.style.background = 'transparent'; }}
            title="Settings"
          >
            <Settings style={{ width: '14px', height: '14px' }} />
          </button>
          <button
            onClick={onNew}
            style={{ ...iconBtn, color: '#3b82f6' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
      style={{ width: '216px', background: '#f8f9fb', borderRight: '1px solid #e3e5e8', transition: 'width 0.2s', ...mobileStyle }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ height: '52px', borderBottom: '1px solid #e3e5e8', paddingLeft: '24px', paddingRight: '10px' }}
      >
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" style={{ width: '22px', height: '22px', flexShrink: 0 }}>
            <rect x="1" y="1" width="30" height="30" rx="4" fill="#1f2937"/>
            <rect x="4" y="4" width="24" height="17" rx="2" fill="#0d9488"/>
            <polyline points="9,9 13.5,12.5 9,16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="15.5" y1="16" x2="23" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <rect x="1" y="22" width="30" height="1.5" fill="#374151"/>
            <rect x="3" y="24.5" width="7" height="4" rx="2" fill="#fbbf24"/>
            <rect x="22" y="24.5" width="7" height="4" rx="2" fill="#fbbf24"/>
            <rect x="12" y="24.5" width="8" height="4" rx="1.5" fill="#374151"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.03em', color: '#111827' }}>
            gosok
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onRefresh}
            style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#e9eaec'; e.currentTarget.style.color = '#6b7280'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
            title="Refresh"
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
          </button>
          {!isMobile && (
            <button
              onClick={onToggleCollapse}
              style={iconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = '#e9eaec'; e.currentTarget.style.color = '#6b7280'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
              title="Collapse sidebar"
            >
              <PanelLeftClose style={{ width: '12px', height: '12px' }} />
            </button>
          )}
          {isMobile && (
            <button
              onClick={onToggleCollapse}
              style={iconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = '#e9eaec'; e.currentTarget.style.color = '#6b7280'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
              title="Close sidebar"
            >
              <PanelLeftClose style={{ width: '12px', height: '12px' }} />
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '14px 24px 5px', fontSize: '0.594rem', fontWeight: 700, letterSpacing: '0.12em', color: '#9ca3af', textTransform: 'uppercase' }}>
        Projects
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '2px 14px' }}>
        {projects.map((p) => {
          const isActive = p.id === selectedId;
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
                marginBottom: '1px', borderRadius: '6px',
                background: isActive ? '#ffffff' : 'transparent',
                borderLeft: `2px solid ${isActive ? '#3b82f6' : 'transparent'}`,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                cursor: 'grab',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#eef0f3'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? '#ffffff' : 'transparent'; }}
            >
              <button
                onClick={() => onSelect(p.id)}
                className="w-full text-left"
                style={{ display: 'block', padding: '7px 28px 7px 8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
              >
                <div style={{
                  fontSize: '0.781rem', fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#111827' : '#374151',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.4',
                }}>
                  {p.name}
                </div>
                <div style={{
                  fontSize: '0.625rem', color: '#9ca3af', fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px',
                }}>
                  {p.path}
                </div>
              </button>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute"
                onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                style={{
                  top: '50%', right: '6px', transform: 'translateY(-50%)',
                  width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '4px', border: 'none', cursor: 'pointer',
                  background: 'transparent', color: '#9ca3af', padding: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                title="Delete project"
              >
                <Trash2 style={{ width: '11px', height: '11px' }} />
              </button>
            </div>
          );
        })}
        {projects.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6875rem', color: '#c9d0d8' }}>No projects yet</div>
          </div>
        )}
      </div>

      {/* Settings button */}
      <div style={{ padding: '0 10px 4px' }}>
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2 transition-all"
          style={{
            padding: '7px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: isSettingsActive ? '#eff6ff' : 'transparent',
            color: isSettingsActive ? '#3b82f6' : '#9ca3af',
            fontSize: '0.75rem',
          }}
          onMouseEnter={e => { if (!isSettingsActive) { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#6b7280'; } }}
          onMouseLeave={e => { if (!isSettingsActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; } }}
        >
          <Settings style={{ width: '13px', height: '13px', flexShrink: 0 }} />
          Settings
        </button>
      </div>

      {/* New Project button */}
      <div style={{ padding: '10px', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 transition-all"
          style={{
            padding: '8px 12px', borderRadius: '6px',
            border: '1px solid #e3e5e8', background: '#ffffff',
            color: '#3b82f6', fontSize: '0.781rem', fontWeight: 500, cursor: 'pointer',
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
