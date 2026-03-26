import { useCallback, useEffect, useState } from 'react';
import type { Project, Tab } from './api/types';
import * as api from './api/client';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ProjectView from './components/ProjectView';
import SettingsView from './components/SettingsView';
import CreateProjectDialog from './components/CreateProjectDialog';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';

function AppContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTabs, setAllTabs] = useState<Tab[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { getSetting } = useSettings();
  const textScale = getSetting<number>('text_scale', 1);

  useEffect(() => {
    document.documentElement.style.fontSize = `${textScale * 16}px`;
    return () => { document.documentElement.style.fontSize = ''; };
  }, [textScale]);

  const loadProjects = useCallback(async () => {
    const list = await api.listProjects();
    setProjects(list || []);
  }, []);

  const loadAllTabs = useCallback(async () => {
    if (projects.length === 0) { setAllTabs([]); return; }
    const results = await Promise.all(projects.map(p => api.listTabs(p.id).catch(() => [])));
    setAllTabs(results.flat());
  }, [projects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadAllTabs();
    const interval = setInterval(loadAllTabs, 10000);
    return () => clearInterval(interval);
  }, [loadAllTabs]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const stats = {
    totalProjects: projects.length,
    runningSessions: allTabs.filter(t => t.status?.status === 'running').length,
    totalTabs: allTabs.length,
  };

  const handleCreateProject = async (data: { name: string; path: string; description: string }) => {
    const p = await api.createProject(data);
    setShowCreateProject(false);
    await loadProjects();
    setSelectedProjectId(p.id);
  };

  const handleEditProject = async (id: string, data: { name: string; path: string }) => {
    await api.updateProject(id, data);
    await loadProjects();
  };

  const handleDeleteProject = async (id: string) => {
    await api.deleteProject(id);
    if (selectedProjectId === id) setSelectedProjectId(null);
    await loadProjects();
  };

  const handleDashboard = () => {
    setSelectedProjectId(null);
    setShowSettings(false);
  };

  const isDashboardActive = !selectedProject && !showSettings;

  return (
    <div className="dark">
      <Layout
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => { setSelectedProjectId(id); setShowSettings(false); }}
        onNewProject={() => setShowCreateProject(true)}
        onRefresh={loadProjects}
        onEditProject={handleEditProject}
        onDeleteProject={handleDeleteProject}
        onDashboard={handleDashboard}
        isDashboardActive={isDashboardActive}
        stats={stats}
        onReorderProjects={(ids) => setProjects(prev => ids.map(id => prev.find(p => p.id === id)!))}
        onSettings={() => setShowSettings(s => !s)}
        isSettingsActive={showSettings}
      >
        {showSettings ? (
          <SettingsView />
        ) : selectedProject ? (
          <ProjectView project={selectedProject} />
        ) : (
          <Dashboard projects={projects} onSelectProject={(id) => { setSelectedProjectId(id); setShowSettings(false); }} />
        )}
      </Layout>

      <CreateProjectDialog
        open={showCreateProject}
        onSubmit={handleCreateProject}
        onCancel={() => setShowCreateProject(false)}
      />
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App;
