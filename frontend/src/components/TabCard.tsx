import type { Tab } from '../api/types';
import { X } from 'lucide-react';

interface TabCardProps {
  tab: Tab;
  title?: string;
  isActive?: boolean;
  isOpen?: boolean;
  onStart: () => void;
  onFocus: () => void;
  onOpenTerminal: () => void;
  onClose: (isRunning: boolean) => void;
}

export default function TabCard({
  tab, title, isActive, isOpen, onStart, onFocus, onOpenTerminal, onClose,
}: TabCardProps) {
  const isRunning = tab.status?.status === 'running';

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
        borderTop: `2px solid ${isActive ? '#374151' : 'transparent'}`,
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
          background: isRunning ? '#374151' : '#d1d5db',
          boxShadow: isRunning ? '0 0 5px rgba(55,65,81,0.4)' : 'none',
        }}
      />

      {/* Name */}
      <span style={{
        fontSize: '0.75rem',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? '#111827' : '#6b7280',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1,
        transition: 'color 0.1s',
      }}>
        {title || tab.name}
      </span>

      {/* Close / stop button */}
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onClose(isRunning);
        }}
        style={{
          width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '3px', border: 'none', cursor: 'pointer',
          background: 'transparent', color: '#9ca3af', padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'transparent'; }}
        title={isRunning ? 'Stop' : 'Delete'}
      >
        <X style={{ width: '10px', height: '10px' }} />
      </button>
    </div>
  );
}
