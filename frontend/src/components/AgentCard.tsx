import type { Agent } from '../api/types';
import { X } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  isActive?: boolean;
  isOpen?: boolean;
  onStart: () => void;
  onStop: () => void;
  onFocus: () => void;
  onOpenTerminal: () => void;
  onDelete: () => void;
}

const AGENT_CONFIG: Record<string, { color: string; dimBg: string }> = {
  'shell':       { color: '#0d9488', dimBg: 'rgba(13,148,136,0.08)' },
  'claude-code': { color: '#2563eb', dimBg: 'rgba(37,99,235,0.08)' },
  'codex':       { color: '#16a34a', dimBg: 'rgba(22,163,74,0.08)' },
  'gemini-cli':  { color: '#d97706', dimBg: 'rgba(217,119,6,0.08)' },
  'opencode':    { color: '#7c3aed', dimBg: 'rgba(124,58,237,0.08)' },
};
const DEFAULT_CFG = { color: '#0d9488', dimBg: 'rgba(13,148,136,0.08)' };

export default function AgentCard({
  agent, isActive, isOpen, onStart, onStop, onFocus, onOpenTerminal, onDelete,
}: AgentCardProps) {
  const isRunning = agent.status?.status === 'running';
  const cfg = AGENT_CONFIG[agent.agent_type] ?? DEFAULT_CFG;

  const handleClick = () => {
    if (isActive) return;
    if (isOpen) onFocus();
    else if (isRunning) onOpenTerminal();
    else onStart();
  };

  return (
    <div
      className="group relative flex items-center gap-2 shrink-0 cursor-pointer select-none"
      onClick={handleClick}
      style={{
        height: '36px',
        padding: '0 10px 0 12px',
        background: isActive ? '#ffffff' : 'transparent',
        borderRight: '1px solid #e3e5e8',
        borderLeft: isActive ? '1px solid #e3e5e8' : '1px solid transparent',
        borderTop: `2px solid ${isActive ? cfg.color : 'transparent'}`,
        marginTop: isActive ? '0' : '2px',
        transition: 'all 0.1s',
        minWidth: '100px',
        maxWidth: '180px',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Status dot */}
      <div
        className={isRunning ? 'running-dot' : ''}
        style={{
          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
          background: isRunning ? cfg.color : '#d1d5db',
          boxShadow: isRunning ? `0 0 5px ${cfg.color}60` : 'none',
        }}
      />

      {/* Name */}
      <span style={{
        fontSize: '12px',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? cfg.color : '#6b7280',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1,
        transition: 'color 0.1s',
      }}>
        {agent.agent_type}
      </span>

      {/* Close / stop button */}
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          if (isRunning) onStop();
          else onDelete();
        }}
        style={{
          width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '3px', border: 'none', cursor: 'pointer',
          background: 'transparent', color: '#9ca3af', padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
        title={isRunning ? 'Stop' : 'Delete'}
      >
        <X style={{ width: '10px', height: '10px' }} />
      </button>
    </div>
  );
}
