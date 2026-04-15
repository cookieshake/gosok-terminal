import { useEffect, useState } from 'react';
import type { Tab } from '../api/types';
import { X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useFlaggedTabs } from '../hooks/useFlaggedTabs';

interface TabCardProps {
  tab: Tab;
  isActive?: boolean;
  isOpen?: boolean;
  onStart: () => void;
  onFocus: () => void;
  onOpenTerminal: () => void;
  onClose: (isRunning: boolean) => void;
  dropIndicator?: 'before' | 'after' | null;
}

const ACTIVE_THRESHOLD = 10_000; // 10s

export default function TabCard({
  tab, isActive, isOpen, onStart, onFocus, onOpenTerminal, onClose, dropIndicator,
}: TabCardProps) {
  const isRunning = tab.status?.status === 'running';

  // Re-evaluate activity state every 5s so dot transitions from active→idle
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [isRunning]);
  const isOutputActive = isRunning && !!tab.status?.last_activity && (now - tab.status.last_activity) < ACTIVE_THRESHOLD;
  const isMobile = useIsMobile();
  const flaggedTabs = useFlaggedTabs();
  const isFlagged = flaggedTabs.has(tab.id);

  const handleClick = () => {
    if (isActive && isOpen) return;
    if (isOpen) onFocus();
    else if (isRunning) onOpenTerminal();
    else onStart();
  };

  return (
    <div
      className="group relative flex items-center gap-2 shrink-0 cursor-pointer select-none"
      data-testid={`terminal-tab-${tab.id}`}
      onClick={handleClick}
      style={{
        height: '36px',
        padding: '0 10px 0 12px',
        background: isActive ? '#eff1f5' : 'transparent',
        borderRight: '2px solid #5c5470',
        borderLeft: 'none',
        borderTop: `3px solid ${isActive ? '#89b4fa' : 'transparent'}`,
        borderBottom: 'none',
        transition: 'all 0.1s',
        minWidth: '100px',
        maxWidth: '180px',
        boxShadow: dropIndicator === 'before'
          ? 'inset 3px 0 0 #89b4fa'
          : dropIndicator === 'after'
            ? 'inset -3px 0 0 #89b4fa'
            : isActive ? undefined : 'none',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#ccd0da'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Status dot: active (pulsing) / idle (static teal) / stopped (grey) */}
      <div
        className={isOutputActive ? 'running-dot' : ''}
        style={{
          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
          background: isFlagged ? '#df8e1d' : isRunning ? '#179299' : '#bcc0cc',
          opacity: !isFlagged && isRunning && !isOutputActive ? 0.5 : 1,
          boxShadow: isFlagged ? '0 0 5px rgba(223,142,29,0.5)' : isOutputActive ? '0 0 5px rgba(23,146,153,0.5)' : 'none',
          border: '1px solid #5c5470',
        }}
      />

      {/* Name */}
      <span style={{
        fontSize: '0.75rem',
        fontWeight: isActive ? 700 : 400,
        color: isActive ? '#4c4f69' : '#5c5f77',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1,
        transition: 'color 0.1s',
      }}>
        {tab.name}
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
          background: 'transparent', color: '#8c8fa1', padding: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fce4ec'; e.currentTarget.style.color = '#d20f39'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#8c8fa1'; e.currentTarget.style.background = 'transparent'; }}
        title={isRunning ? 'Stop' : 'Delete'}
      >
        <X style={{ width: '10px', height: '10px' }} />
      </button>
    </div>
  );
}
