import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tab, Project } from '../api/types';
import * as api from '../api/client';
import TabCard from './TabCard';
import TerminalPane from './TerminalPane';
import EditorPane from './EditorPane';
import DiffPane from './DiffPane';
import MobileKeybar from './MobileKeybar';
import { useIsMobile } from '../hooks/useIsMobile';
import { useTouchDragReorder } from '../hooks/useTouchDragReorder';
import { Terminal as TerminalIcon, Bell, X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import type { Shortcut } from '../api/types';
import NotificationCenter from './NotificationCenter';
import { useEventsContext } from '../contexts/EventsContext';
import { generateTabName } from '../lib/utils';
import type { ToastItem } from '../contexts/EventsContext';

interface ProjectViewProps {
  project: Project;
  pendingTabId?: string | null;
  onPendingTabConsumed?: () => void;
  onNavigateToTab?: (tabId: string) => void;
}

type Mode = 'terminals' | 'editor' | 'diff';

export default function ProjectView({ project, pendingTabId, onPendingTabConsumed, onNavigateToTab }: ProjectViewProps) {
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
  const shortcuts = getSetting<Shortcut[]>('shortcuts', []).filter(t => t.enabled);
  const sendDataFns = useRef<Map<string, (data: string) => void>>(new Map());
  const pendingCommands = useRef<Map<string, string>>(new Map());
  const swipeStartX = useRef<number | null>(null);
  const tabDragId = useRef<string | null>(null);
  const tabDragOverId = useRef<string | null>(null);
  const [tabDropIndicator, setTabDropIndicator] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [bellShake, setBellShake] = useState(false);
  const { totalUnread, toasts, dismissToast } = useEventsContext();
  const prevUnreadRef = useRef(totalUnread);

  // Bell shake when new unread arrives
  useEffect(() => {
    if (totalUnread > prevUnreadRef.current && !notifOpen) {
      setBellShake(true);
      const timer = setTimeout(() => setBellShake(false), 600);
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = totalUnread;
  }, [totalUnread, notifOpen]);

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
      // If navigating from a notification click, open that tab
      if (pendingTabId) {
        const pending = list.find((t: Tab) => t.id === pendingTabId);
        if (pending) {
          onPendingTabConsumed?.();
          setMode('terminals');
          if (pending.status?.session_id) {
            setOpenTerminals(new Map([[pending.id, pending.status.session_id]]));
            setActiveTabId(pending.id);
          } else {
            // Tab exists but not running — start it
            api.startTab(pending.id).then(st => {
              if (st.session_id) {
                setOpenTerminals(new Map([[pending.id, st.session_id]]));
                setActiveTabId(pending.id);
              }
              loadTabs();
            });
          }
          return;
        }
      }
      const first = list.find((t: Tab) => t.status?.session_id);
      if (first && first.status?.session_id) {
        setOpenTerminals(new Map([[first.id, first.status.session_id]]));
        setActiveTabId(first.id);
      }
    });
  }, [loadTabs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle pendingTabId changes within the same project (no remount)
  useEffect(() => {
    if (!pendingTabId) return;
    const tab = tabs.find(t => t.id === pendingTabId);
    if (!tab) return;
    onPendingTabConsumed?.();
    setMode('terminals');
    if (openTerminals.has(pendingTabId)) {
      setActiveTabId(pendingTabId);
    } else if (tab.status?.session_id) {
      setOpenTerminals(prev => new Map(prev).set(tab.id, tab.status!.session_id!));
      setActiveTabId(tab.id);
    } else {
      handleStart(tab.id);
    }
  }, [pendingTabId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleToastClick = useCallback((toast: ToastItem) => {
    dismissToast(toast.id);
    const tabId = toast.notification.tab_id;
    if (!tabId) return;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) {
      // Tab not in current project — delegate to parent for cross-project navigation
      onNavigateToTab?.(tabId);
      return;
    }
    setMode('terminals');
    if (openTerminals.has(tabId)) {
      setActiveTabId(tabId);
    } else if (tab.status?.session_id) {
      openTerminal(tabId, tab.status.session_id);
    } else {
      handleStart(tabId);
    }
  }, [tabs, openTerminals, dismissToast, onNavigateToTab]);

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
    const existingNames = new Set(tabs.map(t => t.name));
    const name = generateTabName(existingNames);
    const tab = await api.createTab(project.id, { name, tab_type: data.tab_type });
    await loadTabs();
    await handleStart(tab.id);
  };

  const handleAddShortcut = (sc: Shortcut) => {
    if (!activeTabId) return;
    const sendFn = sendDataFns.current.get(activeTabId);
    if (sendFn) {
      sendFn(sc.appendEnter ? sc.command + '\r' : sc.command);
    }
  };

  const handleTabReorder = useCallback((ids: string[]) => {
    setTabs(prev => ids.map(id => prev.find(x => x.id === id)!));
    api.reorderTabs(ids);
  }, []);

  const { getTouchHandlers: getTabTouchHandlers } = useTouchDragReorder(tabs, handleTabReorder);

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
    <div className="flex flex-col h-full" style={{ background: 'transparent', position: 'relative' }}>
      <style>{`
        @keyframes bellShake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(10deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
        }
        @keyframes toastSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toastSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>

      {/* Toasts */}
      {!notifOpen && toasts.length > 0 && (
        <div style={{
          position: 'fixed', top: '60px', right: '12px', zIndex: 300,
          display: 'flex', flexDirection: 'column', gap: '8px',
          maxWidth: isMobile ? 'calc(100% - 24px)' : '320px',
        }}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              onClick={() => handleToastClick(toast)}
              style={{
                background: '#faf7f2',
                border: '2px solid #5c5470',
                borderRadius: '4px',
                padding: '10px 12px',
                boxShadow: '3px 3px 0 #5c5470',
                cursor: toast.notification.tab_id ? 'pointer' : 'default',
                animation: 'toastSlideIn 0.2s ease-out',
                display: 'flex', alignItems: 'flex-start', gap: '8px',
              }}
            >
              <Bell size={14} color="#df8e1d" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4c4f69' }}>
                  {toast.notification.title}
                </div>
                {toast.notification.body && (
                  <div style={{
                    fontSize: '0.6875rem', color: '#5c5f77', marginTop: '2px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {toast.notification.body}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8c8fa1', padding: 0, flexShrink: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3"
        style={{ height: '52px', background: '#faf7f2', borderBottom: '2px solid #5c5470', paddingLeft: isMobile ? '48px' : '16px', paddingRight: '8px' }}
      >
        {/* Mode switcher */}
        <div style={{ display: 'flex', background: '#e6e2db', borderRadius: '3px', padding: '3px', gap: '2px', border: '2px solid #5c5470', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 1, minWidth: 0 }}>
          {(['terminals', 'editor', 'diff'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                height: '24px', padding: '0 12px', borderRadius: '2px', flexShrink: 0,
                border: mode === m ? '1px solid #5c5470' : '1px solid transparent',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: mode === m ? 700 : 400,
                background: mode === m ? '#faf7f2' : 'transparent',
                color: mode === m ? '#4c4f69' : '#8c8fa1',
                boxShadow: mode === m ? '2px 2px 0 #5c5470' : 'none',
                transition: 'all 0.1s',
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
              }}
            >
              {m === 'terminals' ? 'Terminals' : m === 'editor' ? 'Editor' : 'Diff'}
            </button>
          ))}
        </div>

        {/* Font size controls */}
        <div className="flex items-center gap-1" style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setSetting(mode === 'editor' ? 'editor_font_size' : 'terminal_font_size', Math.max(10, Math.round(((mode === 'editor' ? editorFontSize : terminalFontSize) - 0.5) * 10) / 10))}
            style={{
              width: '26px', height: '26px', borderRadius: '3px', border: '2px solid #5c5470',
              background: '#faf7f2', cursor: 'pointer', color: '#5c5f77', fontSize: '0.6875rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '2px 2px 0 #5c5470',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translate(1px, 1px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #5c5470'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 2px 0 #5c5470'; }}
            title="Decrease font size"
          >
            A-
          </button>
          <button
            onClick={() => setSetting(mode === 'editor' ? 'editor_font_size' : 'terminal_font_size', Math.min(24, Math.round(((mode === 'editor' ? editorFontSize : terminalFontSize) + 0.5) * 10) / 10))}
            style={{
              width: '26px', height: '26px', borderRadius: '3px', border: '2px solid #5c5470',
              background: '#faf7f2', cursor: 'pointer', color: '#5c5f77', fontSize: '0.6875rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '2px 2px 0 #5c5470',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translate(1px, 1px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #5c5470'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 2px 0 #5c5470'; }}
            title="Increase font size"
          >
            A+
          </button>
        </div>

        {/* Notification bell */}
        <button
          onClick={() => setNotifOpen(o => !o)}
          style={{
            flexShrink: 0,
            width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: '50%',
            background: notifOpen ? '#4c4f69' : 'transparent',
            color: notifOpen ? '#faf7f2' : '#5c5f77',
            cursor: 'pointer', position: 'relative',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { if (!notifOpen) e.currentTarget.style.background = '#e6e2db'; }}
          onMouseLeave={e => { if (!notifOpen) e.currentTarget.style.background = 'transparent'; }}
          title="알림센터"
        >
          <Bell size={16} style={bellShake ? { animation: 'bellShake 0.6s ease-in-out' } : undefined} />
          {totalUnread > 0 && (
            <span style={{
              position: 'absolute', top: '1px', right: '1px',
              minWidth: '14px', height: '14px', borderRadius: '7px',
              background: '#e64553', color: '#fff', fontSize: '0.5625rem',
              fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px', lineHeight: 1,
              border: '2px solid #faf7f2',
            }}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      </div>

      {/* Tab bar */}
      {mode === 'terminals' && <div
        className="shrink-0 flex items-end"
        style={{
          height: '38px', borderBottom: '2px solid #5c5470',
          background: '#e6e2db', overflowX: 'auto', scrollbarWidth: 'none',
        }}
      >
        {tabs.map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={() => { tabDragId.current = t.id; }}
            onDragOver={(e) => {
              e.preventDefault();
              tabDragOverId.current = t.id;
              if (tabDragId.current === t.id) { setTabDropIndicator(null); return; }
              const rect = e.currentTarget.getBoundingClientRect();
              const midX = rect.left + rect.width / 2;
              setTabDropIndicator({ id: t.id, position: e.clientX < midX ? 'before' : 'after' });
            }}
            onDragLeave={() => { if (tabDropIndicator?.id === t.id) setTabDropIndicator(null); }}
            onDrop={() => {
              const pos = tabDropIndicator;
              setTabDropIndicator(null);
              if (!tabDragId.current || tabDragId.current === t.id || !pos) return;
              const ids = tabs.map(x => x.id);
              const from = ids.indexOf(tabDragId.current);
              ids.splice(from, 1);
              let to = ids.indexOf(t.id);
              if (pos.position === 'after') to += 1;
              ids.splice(to, 0, tabDragId.current);
              tabDragId.current = null;
              tabDragOverId.current = null;
              handleTabReorder(ids);
            }}
            onDragEnd={() => { tabDragId.current = null; tabDragOverId.current = null; setTabDropIndicator(null); }}
            {...getTabTouchHandlers(t.id)}
            style={{ display: 'flex' }}
          >
            <TabCard
              tab={t}
              isActive={activeTabId === t.id}
              isOpen={openTerminals.has(t.id)}
              dropIndicator={tabDropIndicator?.id === t.id ? tabDropIndicator.position : null}
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
            height: '24px', padding: '0 9px', flexShrink: 0, alignSelf: 'center', marginLeft: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            border: '2px solid #5c5470', borderRadius: '3px',
            background: '#209fb5', cursor: 'pointer',
            color: '#faf7f2', fontSize: '0.6875rem', fontWeight: 700,
            boxShadow: '2px 2px 0 #5c5470',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '3px 3px 0 #5c5470'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 2px 0 #5c5470'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'translate(1px, 1px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #5c5470'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'translate(-1px, -1px)'; e.currentTarget.style.boxShadow = '3px 3px 0 #5c5470'; }}
          title="New shell tab"
        >
          <span style={{ fontSize: '0.875rem', lineHeight: 1 }}>+</span> Shell
        </button>

      </div>}

      {/* Active tab description (dynamic terminal title) */}
      {mode === 'terminals' && activeTabId && tabTitles.get(activeTabId) && (
        <div
          className="shrink-0"
          style={{
            padding: '4px 12px',
            borderBottom: '2px solid #cdc8bf',
            background: '#f0ece4',
            fontSize: '0.6875rem',
            color: '#6c6f85',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tabTitles.get(activeTabId)}
        </div>
      )}

      {/* Shortcut bar */}
      {mode === 'terminals' && shortcuts.length > 0 && activeTabId && openTerminals.has(activeTabId) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px', borderBottom: '2px solid #cdc8bf',
          background: '#e6e2db', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
        }}>
          {shortcuts.map((sc) => (
            <button
              key={sc.type}
              onClick={() => handleAddShortcut(sc)}
              style={{
                height: '22px', padding: '0 10px', flexShrink: 0,
                display: 'flex', alignItems: 'center',
                borderRadius: '3px', border: '1px solid #cdc8bf',
                background: '#faf7f2', cursor: 'pointer',
                color: '#5c5f77', fontSize: '0.6875rem', fontWeight: 500,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#ddd8d0'; e.currentTarget.style.borderColor = '#5c5470'; e.currentTarget.style.color = '#4c4f69'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#faf7f2'; e.currentTarget.style.borderColor = '#cdc8bf'; e.currentTarget.style.color = '#5c5f77'; }}
              title={sc.label}
            >
              {sc.label}
            </button>
          ))}
        </div>
      )}

      {/* Mode panes — stacked via absolute positioning to keep terminal layout alive */}
      <div className="flex-1 min-h-0 relative">
        {/* Editor mode */}
        {mode === 'editor' && (
          <div className="absolute inset-0">
            <EditorPane rootPath={project.path} fontSize={editorFontSize} fontFamily={editorFontFamily} />
          </div>
        )}

        {/* Diff mode */}
        {mode === 'diff' && (
          <div className="absolute inset-0">
            <DiffPane projectId={project.id} fontSize={editorFontSize} fontFamily={editorFontFamily} />
          </div>
        )}

        {/* Terminal area */}
        <div
          className="absolute inset-0"
          style={{
            visibility: mode === 'terminals' ? 'visible' : 'hidden',
            pointerEvents: mode === 'terminals' ? 'auto' : 'none',
          }}
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
              visible={mode === 'terminals' && tabId === activeTabId}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'transparent' }}>
            <div style={{ border: '2px solid #cdc8bf', borderRadius: '4px', padding: '16px', marginBottom: '12px', background: '#faf7f2' }}>
              <TerminalIcon style={{ width: '36px', height: '36px', color: '#cdc8bf' }} />
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#5c5f77', fontWeight: 700 }}>
              {tabs.length === 0 ? 'Open a new tab to get started' : 'Click a tab to open a terminal'}
            </p>
            {tabs.length === 0 && (
              <button
                onClick={() => handleAddTab({ tab_type: 'shell' })}
                style={{
                  marginTop: '14px', padding: '7px 20px', borderRadius: '3px', cursor: 'pointer',
                  background: '#209fb5', color: '#faf7f2',
                  border: '2px solid #5c5470', fontSize: '0.781rem', fontWeight: 700,
                  boxShadow: '3px 3px 0 #5c5470',
                }}
                onMouseDown={e => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #5c5470'; }}
                onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 #5c5470'; }}
              >
                + New Tab
              </button>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Mobile special keys toolbar */}
      {isMobile && (
        <MobileKeybar
          onSendData={(data) => {
            if (activeTabId) sendDataFns.current.get(activeTabId)?.(data);
          }}
        />
      )}

      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNavigateTab={(tabId: string) => {
          const tab = tabs.find(t => t.id === tabId);
          if (!tab) {
            onNavigateToTab?.(tabId);
            return;
          }
          setMode('terminals');
          if (openTerminals.has(tabId)) {
            setActiveTabId(tabId);
          } else if (tab.status?.session_id) {
            openTerminal(tabId, tab.status.session_id);
          } else {
            handleStart(tabId);
          }
        }}
        isMobile={isMobile}
      />

    </div>
  );
}
