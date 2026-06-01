import { useState } from 'react';
import TerminalPane from './TerminalPane';
import { X, Terminal as TerminalIcon } from 'lucide-react';

export interface TerminalTab {
  id: string;
  label: string;
  sessionId: string;
}

interface TerminalTabsProps {
  tabs: TerminalTab[];
  onClose: (id: string) => void;
}

export default function TerminalTabs({ tabs, onClose }: TerminalTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || '');

  if (tabs.length === 0) return null;

  const currentId = tabs.find((t) => t.id === activeTab)?.id ?? tabs[0].id;

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--ctp-base)' }}>
      {/* Tab bar */}
      <div
        className="flex items-stretch shrink-0 overflow-x-auto"
        style={{ height: '36px', background: 'var(--ctp-base)', borderBottom: '1px solid var(--ctp-base)', scrollbarWidth: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === currentId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`terminal-tab-${tab.id}`}
              className="group relative flex items-center gap-2 shrink-0 transition-all"
              style={{
                padding: '0 14px',
                background: isActive ? 'var(--ctp-base)' : 'transparent',
                borderRight: '1px solid var(--ctp-base)',
                borderTop: 'none',
                borderBottom: 'none',
                borderLeft: 'none',
                color: isActive ? 'var(--ctp-subtext1)' : 'var(--ctp-surface2)',
                fontSize: '12px',
                fontWeight: isActive ? 500 : 400,
                cursor: 'pointer',
              }}
            >
              {/* Active indicator: top line */}
              {isActive && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--ctp-teal)' }} />
              )}
              <TerminalIcon style={{ width: '12px', height: '12px', opacity: 0.6, flexShrink: 0 }} />
              <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tab.label}
              </span>
              <span
                onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                className="flex items-center justify-center transition-all"
                style={{
                  width: '16px', height: '16px', borderRadius: '3px',
                  marginLeft: '4px', opacity: 0, flexShrink: 0,
                  color: 'var(--ctp-overlay1)', cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--ctp-red) 12.5%, transparent)';
                  e.currentTarget.style.color = 'var(--ctp-red)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '0';
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--ctp-overlay1)';
                }}
                onFocus={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <X style={{ width: '10px', height: '10px' }} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Terminal content: use absolute overlay for inactive tabs (preserves xterm state) */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              position: 'absolute', inset: 0,
              opacity: tab.id === currentId ? 1 : 0,
              pointerEvents: tab.id === currentId ? 'auto' : 'none',
              transition: 'opacity 0.1s',
            }}
          >
            <TerminalPane key={tab.sessionId} tabId={tab.id} wsUrl={`/api/ws/sessions/${tab.sessionId}/terminal`} />
          </div>
        ))}
      </div>
    </div>
  );
}
