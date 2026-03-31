import { useEffect, useRef } from 'react';
import { Bell, MessageSquare, X } from 'lucide-react';
import { useEventsContext } from '../contexts/EventsContext';
import type { StoredNotification } from '../contexts/EventsContext';
import type { Message } from '../api/types';
import { useState } from 'react';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  isMobile: boolean;
}

type FilterTab = 'all' | 'messages' | 'notifications';

type UnifiedItem =
  | { kind: 'message'; data: Message; created_at: string }
  | { kind: 'notification'; data: StoredNotification; created_at: string };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationCenter({ open, onClose, onNavigateTab, isMobile }: NotificationCenterProps) {
  const { messages, feedMessages, notifications, readIds, markAllRead } = useEventsContext();
  const [filter, setFilter] = useState<FilterTab>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  // Mark all as read when closed (so user sees unread state while panel is open)
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      markAllRead();
    }
  }, [open, markAllRead]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  // Build unified list
  const allMessages: UnifiedItem[] = [...messages, ...feedMessages].map(m => ({
    kind: 'message',
    data: m,
    created_at: m.created_at,
  }));

  const allNotifications: UnifiedItem[] = notifications.map(n => ({
    kind: 'notification',
    data: n,
    created_at: n.created_at,
  }));

  let unified: UnifiedItem[] = [];
  if (filter === 'all') {
    unified = [...allMessages, ...allNotifications];
  } else if (filter === 'messages') {
    unified = allMessages;
  } else {
    unified = allNotifications;
  }

  unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const scopeLabel: Record<string, string> = {
    direct: 'direct',
    broadcast: 'broadcast',
    global: 'feed',
  };

  const panelWidth = isMobile ? '100%' : '340px';

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 200,
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: panelWidth,
          background: '#eff1f5',
          border: '2px solid #5c5470',
          borderRight: 'none',
          borderTop: 'none',
          borderBottom: 'none',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.22s ease-out',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #bcc0cc',
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: '#4c4f69', letterSpacing: '0.01em' }}>
            Notifications
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#5c5470',
                display: 'flex',
                alignItems: 'center',
                padding: 2,
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #bcc0cc',
            flexShrink: 0,
          }}
        >
          {(['all', 'messages', 'notifications'] as FilterTab[]).map(tab => {
            const label = tab === 'all' ? 'All' : tab === 'messages' ? 'Messages' : 'Alerts';
            const active = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid #5c5470' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 700 : 400,
                  color: active ? '#4c4f69' : '#8c8fa1',
                  transition: 'color 0.1s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Item list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {unified.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#8c8fa1',
                fontSize: 13,
                padding: '32px 16px',
              }}
            >
              No notifications
            </div>
          ) : (
            unified.map((item, idx) => {
              const itemId = item.kind === 'message' ? item.data.id : item.data.id;
              const isRead = readIds.has(itemId);
              if (item.kind === 'message') {
                const msg = item.data;
                const targetTabId = msg.scope === 'direct' ? msg.to_tab_id : msg.from_tab_id;
                return (
                  <div
                    key={msg.id ?? idx}
                    onClick={() => { onNavigateTab(targetTabId); onClose(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #dce0e8',
                      borderLeft: isRead ? '3px solid transparent' : '3px solid #89b4fa',
                      background: isRead ? 'transparent' : '#e6e9ef',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ccd0da')}
                    onMouseLeave={e => (e.currentTarget.style.background = isRead ? 'transparent' : '#e6e9ef')}
                  >
                    <MessageSquare size={16} color="#89b4fa" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: 11,
                            color: '#8c8fa1',
                            background: '#ccd0da',
                            borderRadius: 4,
                            padding: '1px 5px',
                            flexShrink: 0,
                          }}
                        >
                          {scopeLabel[msg.scope] ?? msg.scope}
                        </span>
                        <span style={{ fontSize: 11, color: '#8c8fa1', fontFamily: 'monospace', flexShrink: 0 }}>
                          {msg.from_tab_id.slice(0, 8)}
                        </span>
                        <span style={{ fontSize: 11, color: '#8c8fa1', marginLeft: 'auto', flexShrink: 0 }}>
                          {relativeTime(msg.created_at)}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: '#4c4f69',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.45,
                        }}
                      >
                        {msg.body}
                      </p>
                    </div>
                  </div>
                );
              } else {
                const notif = item.data;
                return (
                  <div
                    key={notif.id ?? idx}
                    onClick={() => { if (notif.tab_id) { onNavigateTab(notif.tab_id); onClose(); } }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 16px',
                      cursor: notif.tab_id ? 'pointer' : 'default',
                      borderBottom: '1px solid #dce0e8',
                      borderLeft: isRead ? '3px solid transparent' : '3px solid #f38ba8',
                      background: isRead ? 'transparent' : '#e6e9ef',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (notif.tab_id) e.currentTarget.style.background = '#ccd0da'; }}
                    onMouseLeave={e => (e.currentTarget.style.background = isRead ? 'transparent' : '#e6e9ef')}
                  >
                    <Bell size={16} color="#f38ba8" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#4c4f69' }}>
                          {notif.title}
                        </span>
                        <span style={{ fontSize: 11, color: '#8c8fa1', flexShrink: 0, marginLeft: 8 }}>
                          {relativeTime(notif.created_at)}
                        </span>
                      </div>
                      {notif.body && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: '#4c4f69',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.45,
                          }}
                        >
                          {notif.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </div>
    </>
  );
}
