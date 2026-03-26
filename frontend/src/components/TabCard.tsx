import type { Tab } from '../api/types';
import { X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

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
  const isMobile = useIsMobile();

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
        background: isActive ? '#FDF6E8' : 'transparent',
        borderRight: '2px solid #3D2410',
        borderLeft: 'none',
        borderTop: `3px solid ${isActive ? '#2E8B84' : 'transparent'}`,
        borderBottom: 'none',
        transition: 'all 0.1s',
        minWidth: '100px',
        maxWidth: '180px',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#DCC898'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Status dot */}
      <div
        className={isRunning ? 'running-dot' : ''}
        style={{
          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
          background: isRunning ? '#2E8B84' : '#C8A870',
          boxShadow: isRunning ? '0 0 5px rgba(45,155,138,0.5)' : 'none',
          border: '1px solid #3D2410',
        }}
      />

      {/* Name */}
      <span style={{
        fontSize: '0.75rem',
        fontWeight: isActive ? 700 : 400,
        color: isActive ? '#1E1008' : '#5C3A18',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1,
        transition: 'color 0.1s',
      }}>
        {title || tab.name}
      </span>

      {/* Close / stop button */}
      <button
        className={isMobile ? 'flex-shrink-0' : 'opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0'}
        onClick={(e) => {
          e.stopPropagation();
          onClose(isRunning);
        }}
        style={{
          width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '2px', border: 'none', cursor: 'pointer',
          background: 'transparent', color: '#8B5E30', padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F5D0C4'; e.currentTarget.style.color = '#C94A28'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#8B5E30'; e.currentTarget.style.background = 'transparent'; }}
        title={isRunning ? 'Stop' : 'Delete'}
      >
        <X style={{ width: '10px', height: '10px' }} />
      </button>
    </div>
  );
}
