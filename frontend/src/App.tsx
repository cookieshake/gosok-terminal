import { useCallback, useEffect, useState } from 'react';
import type { Project } from './api/types';
import * as api from './api/client';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ProjectView from './components/ProjectView';
import SettingsView from './components/SettingsView';
import CreateProjectDialog from './components/CreateProjectDialog';
import { SettingsProvider } from './contexts/SettingsContext';

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const loadProjects = useCallback(async () => {
    const list = await api.listProjects();
    setProjects(list || []);
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;

  const handleCreateProject = async (data: { name: string; path: string; description: string }) => {
    const p = await api.createProject(data);
    setShowCreateProject(false);
    await loadProjects();
    setSelectedProjectId(p.id);
  };

  const handleDeleteProject = async (id: string) => {
    await api.deleteProject(id);
    if (selectedProjectId === id) setSelectedProjectId(null);
    await loadProjects();
  };

  return (
    <SettingsProvider>
      <div className="dark">
        <Layout
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={(id) => { setSelectedProjectId(id); setShowSettings(false); }}
          onNewProject={() => setShowCreateProject(true)}
          onRefresh={loadProjects}
          onDeleteProject={handleDeleteProject}
          onSettings={() => { setShowSettings(true); setSelectedProjectId(null); }}
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
    </SettingsProvider>
  );
}

export default App;
