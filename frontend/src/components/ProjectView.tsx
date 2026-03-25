import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tab, Project } from '../api/types';
import * as api from '../api/client';
import TabCard from './TabCard';
import TerminalPane from './TerminalPane';
import MobileKeybar from './MobileKeybar';
import { useIsMobile } from '../hooks/useIsMobile';
import { Terminal as TerminalIcon } from 'lucide-react';

const AI_TOOLS = [
  { type: 'claude-code', label: 'Claude', color: '#2563eb' },
  { type: 'codex',       label: 'Codex',  color: '#16a34a' },
  { type: 'gemini-cli',  label: 'Gemini', color: '#d97706' },
  { type: 'opencode',    label: 'Open',   color: '#7c3aed' },
] as const;

interface ProjectViewProps {
  project: Project;
}

export default function ProjectView({ project }: ProjectViewProps) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [openTerminals, setOpenTerminals] = useState<Map<string, string>>(new Map());
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const isMobile = useIsMobile();
  const sendDataFns = useRef<Map<string, (data: string) => void>>(new Map());
  const swipeStartX = useRef<number | null>(null);

  const loadTabs = useCallback(async () => {
    const list = await api.listTabs(project.id);
    setTabs(list || []);
    return list || [];
  }, [project.id]);

  useEffect(() => {
    setOpenTerminals(new Map());
    setActiveTabId(null);
    loadTabs().then((list) => {
      const first = list.find((t: Tab) => t.status?.session_id);
      if (first && first.status?.session_id) {
        setOpenTerminals(new Map([[first.id, first.status.session_id]]));
        setActiveTabId(first.id);
      }
    });
  }, [loadTabs]);

  const openTerminal = (tabId: string, sessionId: string) => {
    setOpenTerminals((prev) => new Map(prev).set(tabId, sessionId));
    setActiveTabId(tabId);
  };

  const closeTerminal = (tabId: string) => {
    setOpenTerminals((prev) => {
      const next = new Map(prev);
      next.delete(tabId);
      return next;
    });
    setActiveTabId((prev) => {
      if (prev !== tabId) return prev;
      const remaining = [...openTerminals.keys()].filter((id) => id !== tabId);
      return remaining[0] ?? null;
    });
  };

  const handleStart = async (tabId: string) => {
    const st = await api.startTab(tabId);
    await loadTabs();
    if (st.session_id) openTerminal(tabId, st.session_id);
  };

  const handleStop = async (tabId: string) => {
    await api.stopTab(tabId);
    closeTerminal(tabId);
    await loadTabs();
  };

  const handleDelete = async (tabId: string) => {
    await api.deleteTab(tabId);
    closeTerminal(tabId);
    await loadTabs();
  };

  const handleOpenTerminal = (tab: Tab) => {
    if (!tab.status?.session_id) return;
    openTerminal(tab.id, tab.status.session_id);
  };

  const handleAddTab = async (data: { tab_type: string }) => {
    const sameType = tabs.filter(t => t.tab_type === data.tab_type).length;
    const name = sameType === 0 ? data.tab_type : `${data.tab_type}-${sameType + 1}`;
    const tab = await api.createTab(project.id, { name, tab_type: data.tab_type });
    setShowAddTab(false);
    await loadTabs();
    await handleStart(tab.id);
  };

  const handleSwipeEnd = (endX: number) => {
    if (swipeStartX.current === null) return;
    const delta = endX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 80) return;

    const tabIds = tabs.map(t => t.id).filter(id => openTerminals.has(id));
    const idx = tabIds.indexOf(activeTabId ?? '');
    if (delta < 0 && idx < tabIds.length - 1) setActiveTabId(tabIds[idx + 1]);
    if (delta > 0 && idx > 0) setActiveTabId(tabIds[idx - 1]);
  };

  const runningCount = tabs.filter((t) => t.status?.status === 'running').length;
  const hasTerminal = activeTabId !== null && openTerminals.has(activeTabId);

  return (
    <div className="flex flex-col h-full" style={{ background: '#f1f2f5' }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3"
        style={{ height: '52px', background: '#ffffff', borderBottom: '1px solid #e3e5e8', paddingLeft: isMobile ? '48px' : '28px', paddingRight: '16px' }}
      >
        <span style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap' }}>gosok</span>
        <span style={{ fontSize: '12px', color: '#d1d5db' }}>/</span>
        <span style={{
          fontSize: '13px', fontWeight: 600, color: '#111827',
          letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {project.name}
        </span>
        {!isMobile && (
          <span style={{
            fontSize: '10.5px', fontFamily: 'monospace', color: '#9ca3af',
            background: '#f3f4f6', padding: '2px 7px', borderRadius: '4px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px',
          }}>
            {project.path}
          </span>
        )}
        {runningCount > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px',
            background: '#dcfce7', color: '#16a34a',
            border: '1px solid #bbf7d0', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {runningCount} running
          </span>
        )}

        {/* Font size controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setFontSize(s => Math.max(10, s - 1))}
            style={{
              width: '26px', height: '26px', borderRadius: '5px', border: '1px solid #e3e5e8',
              background: '#ffffff', cursor: 'pointer', color: '#6b7280', fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Decrease font size"
          >
            A-
          </button>
          <button
            onClick={() => setFontSize(s => Math.min(20, s + 1))}
            style={{
              width: '26px', height: '26px', borderRadius: '5px', border: '1px solid #e3e5e8',
              background: '#ffffff', cursor: 'pointer', color: '#6b7280', fontSize: '11px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Increase font size"
          >
            A+
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="shrink-0 flex items-end"
        style={{
          height: '38px', borderBottom: '1px solid #e3e5e8',
          background: '#f1f2f5', overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: '4px',
        }}
      >
        {tabs.map((t) => (
          <TabCard
            key={t.id}
            tab={t}
            isActive={activeTabId === t.id}
            isOpen={openTerminals.has(t.id)}
            onStart={() => handleStart(t.id)}
            onStop={() => handleStop(t.id)}
            onFocus={() => setActiveTabId(t.id)}
            onOpenTerminal={() => handleOpenTerminal(t)}
            onDelete={() => handleDelete(t.id)}
          />
        ))}
        {/* New shell tab */}
        <button
          onClick={() => handleAddTab({ tab_type: 'shell' })}
          style={{
            height: '36px', width: '36px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: '#c9d0d8', fontSize: '18px', lineHeight: 1,
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#0d9488'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#c9d0d8'; }}
          title="New shell tab"
        >
          +
        </button>

        {/* AI tool quick-launch buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '4px', paddingLeft: '6px', borderLeft: '1px solid #e3e5e8' }}>
          {AI_TOOLS.map(({ type, label, color }) => (
            <button
              key={type}
              onClick={() => handleAddTab({ tab_type: type })}
              style={{
                height: '24px', padding: '0 8px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
                borderRadius: '5px', border: `1px solid ${color}30`,
                background: `${color}0d`, cursor: 'pointer',
                color: color, fontSize: '11px', fontWeight: 600,
                letterSpacing: '-0.01em', transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = `${color}60`; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${color}0d`; e.currentTarget.style.borderColor = `${color}30`; }}
              title={`New ${type} tab`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal area */}
      <div
        className="flex-1 min-h-0 relative"
        onTouchStart={(e) => { swipeStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX)}
      >
        {[...openTerminals.entries()].map(([tabId, sessionId]) => (
          <div
            key={tabId}
            style={{
              position: 'absolute', inset: 0,
              opacity: tabId === activeTabId ? 1 : 0,
              pointerEvents: tabId === activeTabId ? 'auto' : 'none',
            }}
          >
            <TerminalPane
              key={sessionId}
              wsUrl={`/api/ws/sessions/${sessionId}/terminal`}
              fontSize={fontSize}
              onSendDataReady={(fn) => sendDataFns.current.set(tabId, fn)}
            />
          </div>
        ))}

        {/* Empty state */}
        {!hasTerminal && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#f8f9fb' }}>
            <TerminalIcon style={{ width: '36px', height: '36px', marginBottom: '12px', color: '#e5e7eb' }} />
            <p style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 500 }}>
              {tabs.length === 0 ? 'Open a new tab to get started' : 'Click a tab to open a terminal'}
            </p>
            {tabs.length === 0 && (
              <button
                onClick={() => handleAddTab({ tab_type: 'shell' })}
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

      {/* Mobile special keys toolbar */}
      {isMobile && (
        <MobileKeybar
          onSendData={(data) => {
            if (activeTabId) sendDataFns.current.get(activeTabId)?.(data);
          }}
        />
      )}

    </div>
  );
}
