import { useState } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Project } from '../api/types';

interface LayoutProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onRefresh: () => void;
  onDeleteProject: (id: string) => void;
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
  onDeleteProject,
  children,
  onSettings,
  isSettingsActive = false,
  onReorderProjects,
}: LayoutProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex w-screen" style={{ height: '100dvh', background: '#f1f2f5' }}>
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
        onDelete={onDeleteProject}
        collapsed={isMobile ? false : collapsed}
        onToggleCollapse={isMobile ? () => setSidebarOpen(false) : () => setCollapsed(c => !c)}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onSettings={onSettings}
        isSettingsActive={isSettingsActive}
        onReorder={onReorderProjects}
      />

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
