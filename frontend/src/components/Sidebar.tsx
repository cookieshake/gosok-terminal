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
    borderRadius: '3px', border: '1px solid transparent', cursor: 'pointer',
    background: 'transparent', color: '#7A4E20',
    transition: 'all 0.1s', flexShrink: 0,
  } as React.CSSProperties;

  const mobileStyle: React.CSSProperties = isMobile ? {
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
    transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 0.25s ease',
    boxShadow: isOpen ? '4px 0 0 #2D2D2D' : 'none',
  } : {};

  if (!isMobile && collapsed) {
    return (
      <aside
        className="flex flex-col items-center shrink-0"
        style={{ width: '48px', background: '#F5E6D0', borderRight: '2px solid #2D2D2D', transition: 'width 0.2s' }}
      >
        <div style={{ height: '52px', borderBottom: '2px solid #2D2D2D', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <button
            onClick={onToggleCollapse}
            style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFFBF5'; e.currentTarget.style.borderColor = '#C4A882'; e.currentTarget.style.color = '#4A2E10'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#7A4E20'; }}
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
                    border: isActive ? '2px solid #2D2D2D' : '1px solid transparent',
                    cursor: 'pointer',
                    background: isActive ? '#FFFBF5' : 'transparent',
                    boxShadow: isActive ? '2px 2px 0 #2D2D2D' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#EAD8C0'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isActive ? '#FFFBF5' : 'transparent'; }}
                >
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#2D9B8A' : '#7A4E20' }} />
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={onSettings}
            style={{ ...iconBtn, color: isSettingsActive ? '#2D9B8A' : '#7A4E20', border: isSettingsActive ? '2px solid #2D2D2D' : '1px solid transparent', background: isSettingsActive ? '#FFFBF5' : 'transparent' }}
            onMouseEnter={e => { if (!isSettingsActive) { e.currentTarget.style.background = '#FFFBF5'; e.currentTarget.style.borderColor = '#C4A882'; } }}
            onMouseLeave={e => { if (!isSettingsActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
            title="Settings"
          >
            <Settings style={{ width: '14px', height: '14px' }} />
          </button>
          <button
            onClick={onNew}
            style={{ ...iconBtn, color: '#2D9B8A' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFFBF5'; e.currentTarget.style.borderColor = '#C4A882'; e.currentTarget.style.color = '#1A7A6A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#2D9B8A'; }}
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
      style={{ width: '216px', background: '#F5E6D0', borderRight: '2px solid #2D2D2D', transition: 'width 0.2s', ...mobileStyle }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{ height: '52px', borderBottom: '2px solid #2D2D2D', paddingLeft: '16px', paddingRight: '10px', background: '#EAD8C0' }}
      >
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" style={{ width: '22px', height: '22px', flexShrink: 0 }}>
            <rect x="1" y="1" width="30" height="30" rx="2" fill="#2D2D2D"/>
            <rect x="4" y="4" width="24" height="17" rx="1" fill="#2D9B8A"/>
            <polyline points="9,9 13.5,12.5 9,16" fill="none" stroke="#FFFBF5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="15.5" y1="16" x2="23" y2="16" stroke="#FFFBF5" strokeWidth="2" strokeLinecap="round"/>
            <rect x="1" y="22" width="30" height="1.5" fill="#2D2D2D"/>
            <rect x="3" y="24.5" width="7" height="4" rx="1" fill="#E8B84B"/>
            <rect x="22" y="24.5" width="7" height="4" rx="1" fill="#E8B84B"/>
            <rect x="12" y="24.5" width="8" height="4" rx="1" fill="#2D2D2D"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.05em', color: '#1A1008', textTransform: 'uppercase' }}>
            gosok
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onRefresh}
            style={iconBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFFBF5'; e.currentTarget.style.borderColor = '#C4A882'; e.currentTarget.style.color = '#4A2E10'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#7A4E20'; }}
            title="Refresh"
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
          </button>
          {!isMobile && (
            <button
              onClick={onToggleCollapse}
              style={iconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = '#FFFBF5'; e.currentTarget.style.borderColor = '#C4A882'; e.currentTarget.style.color = '#4A2E10'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#7A4E20'; }}
              title="Collapse sidebar"
            >
              <PanelLeftClose style={{ width: '12px', height: '12px' }} />
            </button>
          )}
          {isMobile && (
            <button
              onClick={onToggleCollapse}
              style={iconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = '#FFFBF5'; e.currentTarget.style.borderColor = '#C4A882'; e.currentTarget.style.color = '#4A2E10'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#7A4E20'; }}
              title="Close sidebar"
            >
              <PanelLeftClose style={{ width: '12px', height: '12px' }} />
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '14px 16px 5px', fontSize: '0.594rem', fontWeight: 700, letterSpacing: '0.15em', color: '#7A4E20', textTransform: 'uppercase' }}>
        Projects
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '2px 10px' }}>
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
                marginBottom: '3px', borderRadius: '3px',
                background: isActive ? '#FFFBF5' : 'transparent',
                border: isActive ? '2px solid #2D2D2D' : '2px solid transparent',
                boxShadow: isActive ? '3px 3px 0 #2D2D2D' : 'none',
                cursor: 'grab',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = '#EAD8C0'; e.currentTarget.style.borderColor = '#C4A882'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
            >
              <button
                onClick={() => onSelect(p.id)}
                className="w-full text-left"
                style={{ display: 'block', padding: '7px 24px 7px 8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
              >
                <div style={{
                  fontSize: '0.781rem', fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#1A1008' : '#4A2E10',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: '1.4',
                }}>
                  {p.name}
                </div>
                <div style={{
                  fontSize: '0.625rem', color: '#7A4E20', fontFamily: 'monospace',
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
                  borderRadius: '3px', border: 'none', cursor: 'pointer',
                  background: 'transparent', color: '#7A4E20', padding: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FDDCDC'; e.currentTarget.style.color = '#E05A3A'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7A4E20'; }}
                title="Delete project"
              >
                <Trash2 style={{ width: '11px', height: '11px' }} />
              </button>
            </div>
          );
        })}
        {projects.length === 0 && (
          <div style={{ padding: '24px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6875rem', color: '#C4A882' }}>No projects yet</div>
          </div>
        )}
      </div>

      {/* Settings button */}
      <div style={{ padding: '0 10px 4px' }}>
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2 transition-all"
          style={{
            padding: '7px 10px', borderRadius: '3px',
            border: isSettingsActive ? '2px solid #2D2D2D' : '2px solid transparent',
            cursor: 'pointer',
            background: isSettingsActive ? '#FFFBF5' : 'transparent',
            boxShadow: isSettingsActive ? '2px 2px 0 #2D2D2D' : 'none',
            color: isSettingsActive ? '#2D9B8A' : '#7A4E20',
            fontSize: '0.75rem', fontWeight: isSettingsActive ? 700 : 400,
          }}
          onMouseEnter={e => { if (!isSettingsActive) { e.currentTarget.style.background = '#EAD8C0'; e.currentTarget.style.borderColor = '#C4A882'; e.currentTarget.style.color = '#4A2E10'; } }}
          onMouseLeave={e => { if (!isSettingsActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = '#7A4E20'; } }}
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
            padding: '8px 12px', borderRadius: '3px',
            border: '2px solid #2D2D2D',
            background: '#E8B84B',
            color: '#1A1008', fontSize: '0.781rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: '3px 3px 0 #2D2D2D',
            letterSpacing: '0.03em',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '4px 4px 0 #2D2D2D'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translate(0, 0)'; e.currentTarget.style.boxShadow = '3px 3px 0 #2D2D2D'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #2D2D2D'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '4px 4px 0 #2D2D2D'; }}
        >
          <Plus style={{ width: '13px', height: '13px' }} />
          New Project
        </button>
      </div>
    </aside>
  );
}
