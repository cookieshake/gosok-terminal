import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import type { Project } from '../api/types';

interface LayoutProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onRefresh: () => void;
  children: ReactNode;
}

export default function Layout({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onRefresh,
  children,
}: LayoutProps) {
  return (
    <div className="flex w-screen h-screen" style={{ background: '#f1f2f5' }}>
      <Sidebar
        projects={projects}
        selectedId={selectedProjectId}
        onSelect={onSelectProject}
        onNew={onNewProject}
        onRefresh={onRefresh}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
