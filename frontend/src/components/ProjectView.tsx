import { useCallback, useEffect, useState } from 'react';
import type { Agent, Project } from '../api/types';
import * as api from '../api/client';
import AgentCard from './AgentCard';
import TerminalPane from './TerminalPane';
import AddAgentDialog from './AddAgentDialog';
import { Terminal as TerminalIcon } from 'lucide-react';

interface ProjectViewProps {
  project: Project;
}

export default function ProjectView({ project }: ProjectViewProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [openTerminals, setOpenTerminals] = useState<Map<string, string>>(new Map());
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);

  const loadAgents = useCallback(async () => {
    const list = await api.listAgents(project.id);
    setAgents(list || []);
  }, [project.id]);

  useEffect(() => {
    loadAgents();
    setOpenTerminals(new Map());
    setActiveAgentId(null);
  }, [loadAgents]);

  const openTerminal = (agentId: string, sessionId: string) => {
    setOpenTerminals((prev) => new Map(prev).set(agentId, sessionId));
    setActiveAgentId(agentId);
  };

  const closeTerminal = (agentId: string) => {
    setOpenTerminals((prev) => {
      const next = new Map(prev);
      next.delete(agentId);
      return next;
    });
    setActiveAgentId((prev) => {
      if (prev !== agentId) return prev;
      const remaining = [...openTerminals.keys()].filter((id) => id !== agentId);
      return remaining[0] ?? null;
    });
  };

  const handleStart = async (agentId: string) => {
    const st = await api.startAgent(agentId);
    await loadAgents();
    if (st.session_id) openTerminal(agentId, st.session_id);
  };

  const handleStop = async (agentId: string) => {
    await api.stopAgent(agentId);
    closeTerminal(agentId);
    await loadAgents();
  };

  const handleDelete = async (agentId: string) => {
    await api.deleteAgent(agentId);
    closeTerminal(agentId);
    await loadAgents();
  };

  const handleOpenTerminal = (agent: Agent) => {
    if (!agent.status?.session_id) return;
    openTerminal(agent.id, agent.status.session_id);
  };

  const handleAddAgent = async (data: { agent_type: string }) => {
    const sameType = agents.filter(a => a.agent_type === data.agent_type).length;
    const name = sameType === 0 ? data.agent_type : `${data.agent_type}-${sameType + 1}`;
    await api.createAgent(project.id, { name, agent_type: data.agent_type });
    setShowAddAgent(false);
    await loadAgents();
  };

  const runningCount = agents.filter((a) => a.status?.status === 'running').length;
  const hasTerminal = activeAgentId !== null && openTerminals.has(activeAgentId);

  return (
    <div className="flex flex-col h-full" style={{ background: '#f1f2f5' }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3"
        style={{ height: '52px', background: '#ffffff', borderBottom: '1px solid #e3e5e8', paddingLeft: '28px', paddingRight: '24px' }}
      >
        <span style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>gosok</span>
        <span style={{ fontSize: '12px', color: '#d1d5db' }}>/</span>
        <span style={{
          fontSize: '13px', fontWeight: 600, color: '#111827',
          letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {project.name}
        </span>
        <span style={{
          fontSize: '10.5px', fontFamily: 'monospace', color: '#9ca3af',
          background: '#f3f4f6', padding: '2px 7px', borderRadius: '4px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px',
        }}>
          {project.path}
        </span>
        {runningCount > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px',
            background: '#dcfce7', color: '#16a34a',
            border: '1px solid #bbf7d0', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {runningCount} running
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div
        className="shrink-0 flex items-end"
        style={{
          height: '38px', borderBottom: '1px solid #e3e5e8',
          background: '#f1f2f5', overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: '4px',
        }}
      >
        {agents.map((a) => (
          <AgentCard
            key={a.id}
            agent={a}
            isActive={activeAgentId === a.id}
            isOpen={openTerminals.has(a.id)}
            onStart={() => handleStart(a.id)}
            onStop={() => handleStop(a.id)}
            onFocus={() => setActiveAgentId(a.id)}
            onOpenTerminal={() => handleOpenTerminal(a)}
            onDelete={() => handleDelete(a.id)}
          />
        ))}
        <button
          onClick={() => setShowAddAgent(true)}
          style={{
            height: '36px', width: '36px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: '#c9d0d8', fontSize: '18px', lineHeight: 1,
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#6b7280'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#c9d0d8'; }}
          title="New tab"
        >
          +
        </button>
      </div>

      {/* Terminal area */}
      <div className="flex-1 min-h-0 relative">
        {[...openTerminals.entries()].map(([agentId, sessionId]) => (
          <div
            key={agentId}
            style={{
              position: 'absolute', inset: 0,
              opacity: agentId === activeAgentId ? 1 : 0,
              pointerEvents: agentId === activeAgentId ? 'auto' : 'none',
            }}
          >
            <TerminalPane key={sessionId} wsUrl={`/api/ws/sessions/${sessionId}/terminal`} />
          </div>
        ))}

        {/* Empty state */}
        {!hasTerminal && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#f8f9fb' }}>
            <TerminalIcon style={{ width: '36px', height: '36px', marginBottom: '12px', color: '#e5e7eb' }} />
            <p style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>
              {agents.length === 0 ? 'Open a new tab to get started' : 'Click a tab to open a terminal'}
            </p>
            {agents.length === 0 && (
              <button
                onClick={() => setShowAddAgent(true)}
                style={{
                  marginTop: '14px', padding: '7px 16px', borderRadius: '7px', cursor: 'pointer',
                  background: '#eff6ff', color: '#3b82f6',
                  border: '1px solid #bfdbfe', fontSize: '12.5px', fontWeight: 500,
                }}
              >
                + New Tab
              </button>
            )}
          </div>
        )}
      </div>

      <AddAgentDialog open={showAddAgent} onSubmit={handleAddAgent} onCancel={() => setShowAddAgent(false)} />
    </div>
  );
}
