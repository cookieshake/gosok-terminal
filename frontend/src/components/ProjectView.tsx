import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tab, Project } from '../api/types';
import * as api from '../api/client';
import TabCard from './TabCard';
import TerminalPane from './TerminalPane';
import EditorPane from './EditorPane';
import DiffPane from './DiffPane';
import MobileKeybar from './MobileKeybar';
import { useIsMobile } from '../hooks/useIsMobile';
import { Terminal as TerminalIcon } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import type { AiTool } from '../api/types';

interface ProjectViewProps {
  project: Project;
}

type Mode = 'terminals' | 'editor' | 'diff';

export default function ProjectView({ project }: ProjectViewProps) {
  const [mode, setMode] = useState<Mode>('terminals');
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [openTerminals, setOpenTerminals] = useState<Map<string, string>>(new Map());
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [tabTitles, setTabTitles] = useState<Map<string, string>>(new Map());
  const isMobile = useIsMobile();
  const { getSetting, setSetting } = useSettings();
  const terminalFontSize = getSetting<number>('terminal_font_size', 14);
  const terminalFontFamily = getSetting<string>('terminal_font_family', 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace');
  const editorFontSize = getSetting<number>('editor_font_size', 14);
  const editorFontFamily = getSetting<string>('editor_font_family', 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace');
  const aiTools = getSetting<AiTool[]>('ai_tools', []).filter(t => t.enabled);
  const sendDataFns = useRef<Map<string, (data: string) => void>>(new Map());
  const pendingCommands = useRef<Map<string, string>>(new Map());
  const swipeStartX = useRef<number | null>(null);
  const tabDragId = useRef<string | null>(null);
  const tabDragOverId = useRef<string | null>(null);

  const loadTabs = useCallback(async () => {
    const list = await api.listTabs(project.id);
    setTabs(list || []);
    return list || [];
  }, [project.id]);

  useEffect(() => {
    setOpenTerminals(new Map());
    setActiveTabId(null);
    loadTabs().then((list) => {
      setTabTitles(new Map(list.filter(t => t.title).map(t => [t.id, t.title])));
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

  const handleClose = async (tabId: string, isRunning: boolean) => {
    if (isRunning) await api.stopTab(tabId);
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
    await loadTabs();
    await handleStart(tab.id);
  };

  const handleAddShortcut = async (tool: AiTool) => {
    const shellCount = tabs.filter(t => t.tab_type === 'shell').length;
    const name = shellCount === 0 ? tool.label : `${tool.label}-${shellCount + 1}`;
    const tab = await api.createTab(project.id, { name, tab_type: 'shell' });
    await loadTabs();
    const st = await api.startTab(tab.id);
    if (st.session_id) {
      pendingCommands.current.set(tab.id, tool.command);
      openTerminal(tab.id, st.session_id);
    }
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

  const hasTerminal = activeTabId !== null && openTerminals.has(activeTabId);

  return (
    <div className="flex flex-col h-full" style={{ background: '#f1f2f5' }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3"
        style={{ height: '52px', background: '#ffffff', borderBottom: '1px solid #e3e5e8', paddingLeft: isMobile ? '48px' : '28px', paddingRight: '8px' }}
      >
        {/* Mode switcher */}
        <div style={{ display: 'flex', background: '#f1f2f5', borderRadius: '7px', padding: '3px', gap: '2px' }}>
          {(['terminals', 'editor', 'diff'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                height: '26px', padding: '0 12px', borderRadius: '5px', border: 'none',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: mode === m ? 600 : 400,
                background: mode === m ? '#ffffff' : 'transparent',
                color: mode === m ? '#111827' : '#6b7280',
                boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'terminals' ? 'Terminals' : m === 'editor' ? 'Editor' : 'Diff'}
            </button>
          ))}
        </div>

        {/* Font size controls */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setSetting(mode === 'editor' ? 'editor_font_size' : 'terminal_font_size', Math.max(10, Math.round(((mode === 'editor' ? editorFontSize : terminalFontSize) - 0.5) * 10) / 10))}
            style={{
              width: '26px', height: '26px', borderRadius: '5px', border: '1px solid #e3e5e8',
              background: '#ffffff', cursor: 'pointer', color: '#6b7280', fontSize: '0.6875rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Decrease font size"
          >
            A-
          </button>
          <button
            onClick={() => setSetting(mode === 'editor' ? 'editor_font_size' : 'terminal_font_size', Math.min(24, Math.round(((mode === 'editor' ? editorFontSize : terminalFontSize) + 0.5) * 10) / 10))}
            style={{
              width: '26px', height: '26px', borderRadius: '5px', border: '1px solid #e3e5e8',
              background: '#ffffff', cursor: 'pointer', color: '#6b7280', fontSize: '0.6875rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Increase font size"
          >
            A+
          </button>
        </div>
      </div>

      {/* Tab bar */}
      {mode === 'terminals' && <div
        className="shrink-0 flex items-end"
        style={{
          height: '38px', borderBottom: '1px solid #e3e5e8',
          background: '#f1f2f5', overflowX: 'auto', scrollbarWidth: 'none', paddingLeft: '4px',
        }}
      >
        {tabs.map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={() => { tabDragId.current = t.id; }}
            onDragOver={(e) => { e.preventDefault(); tabDragOverId.current = t.id; e.currentTarget.style.opacity = '0.5'; }}
            onDragLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            onDrop={(e) => {
              e.currentTarget.style.opacity = '1';
              if (!tabDragId.current || tabDragId.current === tabDragOverId.current) return;
              const ids = tabs.map(x => x.id);
              const from = ids.indexOf(tabDragId.current);
              const to = ids.indexOf(tabDragOverId.current!);
              ids.splice(from, 1);
              ids.splice(to, 0, tabDragId.current);
              tabDragId.current = null;
              tabDragOverId.current = null;
              setTabs(prev => ids.map(id => prev.find(x => x.id === id)!));
              api.reorderTabs(ids);
            }}
            onDragEnd={() => { tabDragId.current = null; tabDragOverId.current = null; }}
            style={{ display: 'contents' }}
          >
            <TabCard
              tab={t}
              title={tabTitles.get(t.id)}
              isActive={activeTabId === t.id}
              isOpen={openTerminals.has(t.id)}
              onStart={() => handleStart(t.id)}
              onFocus={() => setActiveTabId(t.id)}
              onOpenTerminal={() => handleOpenTerminal(t)}
              onClose={(isRunning) => handleClose(t.id, isRunning)}
            />
          </div>
        ))}
        {/* New shell tab */}
        <button
          onClick={() => handleAddTab({ tab_type: 'shell' })}
          style={{
            height: '24px', padding: '0 9px', flexShrink: 0, alignSelf: 'center', marginLeft: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            border: '1px solid #d1d5db', borderRadius: '5px',
            background: '#ffffff', cursor: 'pointer',
            color: '#374151', fontSize: '0.6875rem', fontWeight: 500,
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = '#86efac'; e.currentTarget.style.color = '#16a34a'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#374151'; }}
          title="New shell tab"
        >
          <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>+</span> Shell
        </button>

      </div>}

      {/* Shortcut bar */}
      {mode === 'terminals' && aiTools.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '5px 10px', borderBottom: '1px solid #e3e5e8',
          background: '#f8f9fb', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
        }}>
          {aiTools.map((tool) => (
            <button
              key={tool.type}
              onClick={() => handleAddShortcut(tool)}
              style={{
                height: '22px', padding: '0 10px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
                borderRadius: '4px', border: '1px solid #e3e5e8',
                background: '#ffffff', cursor: 'pointer',
                color: '#6b7280', fontSize: '0.6875rem', fontWeight: 500,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f1f2f5'; e.currentTarget.style.borderColor = '#c9d0d8'; e.currentTarget.style.color = '#374151'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e3e5e8'; e.currentTarget.style.color = '#6b7280'; }}
              title={tool.label}
            >
              {tool.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor mode */}
      {mode === 'editor' && (
        <div className="flex-1 min-h-0">
          <EditorPane rootPath={project.path} fontSize={editorFontSize} fontFamily={editorFontFamily} />
        </div>
      )}

      {/* Diff mode */}
      {mode === 'diff' && (
        <div className="flex-1 min-h-0">
          <DiffPane projectId={project.id} fontSize={editorFontSize} fontFamily={editorFontFamily} />
        </div>
      )}

      {/* Terminal area */}
      <div
        className="flex-1 min-h-0 relative"
        style={{ display: mode === 'terminals' ? undefined : 'none' }}
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
              fontSize={terminalFontSize}
              fontFamily={terminalFontFamily}
              onTitleChange={(title) => {
                setTabTitles((prev) => new Map(prev).set(tabId, title));
                api.setTabTitle(tabId, title);
              }}
              onSendDataReady={(fn) => {
                sendDataFns.current.set(tabId, fn);
                const cmd = pendingCommands.current.get(tabId);
                if (cmd) {
                  pendingCommands.current.delete(tabId);
                  setTimeout(() => fn(cmd + '\r'), 600);
                }
              }}
            />
          </div>
        ))}

        {/* Empty state */}
        {!hasTerminal && (
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: '#f8f9fb' }}>
            <TerminalIcon style={{ width: '36px', height: '36px', marginBottom: '12px', color: '#e5e7eb' }} />
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af', fontWeight: 500 }}>
              {tabs.length === 0 ? 'Open a new tab to get started' : 'Click a tab to open a terminal'}
            </p>
            {tabs.length === 0 && (
              <button
                onClick={() => handleAddTab({ tab_type: 'shell' })}
                style={{
                  marginTop: '14px', padding: '7px 16px', borderRadius: '7px', cursor: 'pointer',
                  background: '#eff6ff', color: '#3b82f6',
                  border: '1px solid #bfdbfe', fontSize: '0.781rem', fontWeight: 500,
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
