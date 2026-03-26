import { useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import type { SidebarStats } from './Sidebar';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Project } from '../api/types';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 216;

interface LayoutProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onRefresh: () => void;
  onEditProject: (id: string, data: { name: string; path: string }) => void;
  onDeleteProject: (id: string) => void;
  onDashboard: () => void;
  isDashboardActive?: boolean;
  stats: SidebarStats;
  children: ReactNode;
  onSettings: () => void;
  isSettingsActive?: boolean;
  onReorderProjects: (ids: string[]) => void;
}

export default function Layout({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onRefresh,
  onEditProject,
  onDeleteProject,
  onDashboard,
  isDashboardActive = false,
  stats,
  children,
  onSettings,
  isSettingsActive = false,
  onReorderProjects,
}: LayoutProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const isResizing = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  return (
    <div className="flex w-screen retro-grid" style={{ height: '100dvh' }}>
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }}
        />
      )}

      <Sidebar
        projects={projects}
        selectedId={selectedProjectId}
        onSelect={(id) => { onSelectProject(id); if (isMobile) setSidebarOpen(false); }}
        onNew={onNewProject}
        onRefresh={onRefresh}
        onEdit={onEditProject}
        onDelete={onDeleteProject}
        onDashboard={() => { onDashboard(); if (isMobile) setSidebarOpen(false); }}
        isDashboardActive={isDashboardActive}
        stats={stats}
        collapsed={isMobile ? false : collapsed}
        onToggleCollapse={isMobile ? () => setSidebarOpen(false) : () => setCollapsed(c => !c)}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onSettings={onSettings}
        isSettingsActive={isSettingsActive}
        onReorder={onReorderProjects}
        width={sidebarWidth}
      />

      {!isMobile && !collapsed && (
        <div
          onMouseDown={handleResizeStart}
          style={{
            width: '6px',
            cursor: 'col-resize',
            background: 'transparent',
            flexShrink: 0,
            marginLeft: '-3px',
            marginRight: '-3px',
            position: 'relative',
            zIndex: 20,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(46,139,132,0.25)'; }}
          onMouseLeave={e => { if (!isResizing.current) e.currentTarget.style.background = 'transparent'; }}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden" style={{ position: 'relative' }}>
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: 'absolute', top: '13px', left: '12px', zIndex: 10,
              width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '5px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280',
            }}
          >
            <Menu style={{ width: '16px', height: '16px' }} />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}
