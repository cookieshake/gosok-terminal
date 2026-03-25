import { useCallback, useEffect, useState } from 'react';
import type { Project } from './api/types';
import * as api from './api/client';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ProjectView from './components/ProjectView';
import CreateProjectDialog from './components/CreateProjectDialog';

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showCreateProject, setShowCreateProject] = useState(false);

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
    <div className="dark">
      <Layout
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onNewProject={() => setShowCreateProject(true)}
        onRefresh={loadProjects}
        onDeleteProject={handleDeleteProject}
      >
        {selectedProject ? (
          <ProjectView project={selectedProject} />
        ) : (
          <Dashboard projects={projects} onSelectProject={setSelectedProjectId} />
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

export default App;
