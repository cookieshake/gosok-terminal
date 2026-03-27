# Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Inbox/Feed 전체화면 뷰를 오른쪽 슬라이드 오버레이 알림 패널로 대체하고, 알림에 tab_id를 포함시켜 항목 클릭 시 해당 탭으로 이동할 수 있게 한다.

**Architecture:** Backend에서 NotifPayload에 tab_id를 추가하고 CLI가 자동 포함하도록 변경. Frontend에서 EventsContext에 notification 축적을 추가하고, InboxPanel/FeedPanel을 삭제한 뒤 NotificationCenter 슬라이드 패널로 대체. 탭바 오른쪽 끝에 벨 아이콘으로 트리거.

**Tech Stack:** Go (backend API, events hub, CLI), React 19 + TypeScript (frontend), TailwindCSS 4, Lucide icons

---

### Task 1: Backend — NotifPayload에 tab_id 추가

**Files:**
- Modify: `internal/events/hub.go:31-34` (NotifPayload struct)
- Modify: `internal/events/hub.go:94-102` (PublishNotification function)
- Modify: `internal/api/notify.go:14-30` (handler)

- [ ] **Step 1: NotifPayload에 TabID 필드 추가**

`internal/events/hub.go` — NotifPayload struct 수정:

```go
type NotifPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	TabID string `json:"tab_id,omitempty"`
}
```

- [ ] **Step 2: PublishNotification 시그니처에 tabID 추가**

`internal/events/hub.go` — PublishNotification 수정:

```go
func (h *Hub) PublishNotification(title, body, tabID string) {
	h.Publish(Event{
		Type: EventNotification,
		Notification: &NotifPayload{
			Title: title,
			Body:  body,
			TabID: tabID,
		},
	})
}
```

- [ ] **Step 3: notify handler에서 tab_id 수신 및 전달**

`internal/api/notify.go` — req struct에 TabID 추가, PublishNotification 호출 변경:

```go
func (h *notifyHandler) send(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title string `json:"title"`
		Body  string `json:"body"`
		TabID string `json:"tab_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	h.hub.PublishNotification(req.Title, req.Body, req.TabID)
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 4: 빌드 확인**

Run: `go vet ./...`
Expected: no errors (PublishNotification 호출부가 하나뿐이라 컴파일 에러 없어야 함)

- [ ] **Step 5: Commit**

```bash
git add internal/events/hub.go internal/api/notify.go
git commit -m "feat: add tab_id to notification payload"
```

---

### Task 2: CLI — gosok notify에서 GOSOK_TAB_ID 자동 포함

**Files:**
- Modify: `cmd/gosok/cli.go:127-156` (runNotify function)

- [ ] **Step 1: runNotify에서 tab_id를 payload에 포함**

`cmd/gosok/cli.go` — runNotify 함수의 payload 구성 변경:

```go
func runNotify(args []string) {
	fs := flag.NewFlagSet("notify", flag.ExitOnError)
	body := fs.String("body", "", "notification body")
	fs.Parse(args)

	remaining := fs.Args()
	if len(remaining) < 1 {
		fmt.Fprintln(os.Stderr, "usage: gosok notify <title> [--body <body>]")
		os.Exit(1)
	}

	payload := map[string]string{
		"title":  strings.Join(remaining, " "),
		"body":   *body,
		"tab_id": tabID(),
	}

	resp, err := postJSON(apiURL()+"/api/v1/notify", payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		fmt.Fprintf(os.Stderr, "error: %s\n", b)
		os.Exit(1)
	}
	fmt.Println("notification sent")
}
```

유일한 변경: `"tab_id": tabID()` 추가. `tabID()` 함수는 이미 `os.Getenv("GOSOK_TAB_ID")`를 반환함 (cli.go:24).

- [ ] **Step 2: 빌드 확인**

Run: `go vet ./...`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add cmd/gosok/cli.go
git commit -m "feat: auto-include GOSOK_TAB_ID in gosok notify"
```

---

### Task 3: Frontend — EventsContext에 notification 축적 추가

**Files:**
- Modify: `frontend/src/hooks/useEvents.ts:12-15` (NotificationEvent interface)
- Modify: `frontend/src/contexts/EventsContext.tsx` (전체 리팩터)

- [ ] **Step 1: NotificationEvent에 tab_id 추가**

`frontend/src/hooks/useEvents.ts` — NotificationEvent interface 수정:

```typescript
export interface NotificationEvent {
  title: string;
  body: string;
  tab_id?: string;
}
```

- [ ] **Step 2: EventsContext에 notifications 배열 및 통합 unread 추가**

`frontend/src/contexts/EventsContext.tsx` — 전체 교체:

```typescript
import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useEvents } from '../hooks/useEvents';
import type { MessageEvent, NotificationEvent } from '../hooks/useEvents';
import type { Message } from '../api/types';

export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  tab_id?: string;
  created_at: string;
}

interface EventsContextValue {
  messages: Message[];
  feedMessages: Message[];
  notifications: StoredNotification[];
  unreadInboxCount: number;
  unreadFeedCount: number;
  unreadNotifCount: number;
  totalUnread: number;
  clearInbox: () => void;
  clearFeed: () => void;
  clearNotifications: () => void;
  clearAll: () => void;
}

const EventsContext = createContext<EventsContextValue | null>(null);

let notifIdCounter = 0;

export function EventsProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedMessages, setFeedMessages] = useState<Message[]>([]);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [unreadFeedCount, setUnreadFeedCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const handleMessage = useCallback((msg: MessageEvent) => {
    const message: Message = {
      id: msg.id,
      scope: msg.scope as Message['scope'],
      from_tab_id: msg.from_tab_id,
      to_tab_id: msg.to_tab_id || '',
      body: msg.body,
      created_at: msg.created_at,
    };

    if (msg.scope === 'global') {
      setFeedMessages(prev => [...prev, message]);
      setUnreadFeedCount(prev => prev + 1);
    } else {
      setMessages(prev => [...prev, message]);
      setUnreadInboxCount(prev => prev + 1);
    }
  }, []);

  const handleNotification = useCallback((notif: NotificationEvent) => {
    // Store in-app
    const stored: StoredNotification = {
      id: `notif-${++notifIdCounter}`,
      title: notif.title,
      body: notif.body,
      tab_id: notif.tab_id,
      created_at: new Date().toISOString(),
    };
    setNotifications(prev => [...prev, stored]);
    setUnreadNotifCount(prev => prev + 1);

    // Browser notification (desktop only, fails silently on mobile)
    try {
      if (Notification.permission === 'granted') {
        new Notification(notif.title, { body: notif.body });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') {
            new Notification(notif.title, { body: notif.body });
          }
        });
      }
    } catch {
      // mobile browsers throw on new Notification()
    }
  }, []);

  useEvents({ onMessage: handleMessage, onNotification: handleNotification });

  const totalUnread = unreadInboxCount + unreadFeedCount + unreadNotifCount;

  const clearInbox = useCallback(() => {
    setMessages([]);
    setUnreadInboxCount(0);
  }, []);

  const clearFeed = useCallback(() => {
    setFeedMessages([]);
    setUnreadFeedCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadNotifCount(0);
  }, []);

  const clearAll = useCallback(() => {
    clearInbox();
    clearFeed();
    clearNotifications();
  }, [clearInbox, clearFeed, clearNotifications]);

  return (
    <EventsContext.Provider value={{
      messages,
      feedMessages,
      notifications,
      unreadInboxCount,
      unreadFeedCount,
      unreadNotifCount,
      totalUnread,
      clearInbox,
      clearFeed,
      clearNotifications,
      clearAll,
    }}>
      {children}
    </EventsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEventsContext() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEventsContext must be used within EventsProvider');
  return ctx;
}
```

- [ ] **Step 3: 빌드 확인**

Run: `cd frontend && npx tsc --noEmit`
Expected: 기존 `unreadInboxCount`, `unreadFeedCount` 사용처는 유지되므로 에러 없어야 함. 단, `InboxPanel`/`FeedPanel`에서 `clearInbox`/`clearFeed`를 사용 중이면 아직은 호환됨.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useEvents.ts frontend/src/contexts/EventsContext.tsx
git commit -m "feat: store notifications in EventsContext for in-app panel"
```

---

### Task 4: Frontend — NotificationCenter 컴포넌트 생성

**Files:**
- Create: `frontend/src/components/NotificationCenter.tsx`

- [ ] **Step 1: NotificationCenter 컴포넌트 작성**

`frontend/src/components/NotificationCenter.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { X, Bell, MessageSquare } from 'lucide-react';
import { useEventsContext } from '../contexts/EventsContext';
import type { StoredNotification } from '../contexts/EventsContext';
import type { Message } from '../api/types';

type FilterTab = 'all' | 'messages' | 'notifications';

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  isMobile: boolean;
}

type UnifiedItem =
  | { kind: 'message'; data: Message }
  | { kind: 'notification'; data: StoredNotification };

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return '방금';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간전`;
  const day = Math.floor(hr / 24);
  return `${day}일전`;
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case 'direct': return 'direct';
    case 'broadcast': return 'broadcast';
    case 'global': return 'feed';
    default: return scope;
  }
}

export default function NotificationCenter({ open, onClose, onNavigateTab, isMobile }: NotificationCenterProps) {
  const { messages, feedMessages, notifications, totalUnread, clearAll } = useEventsContext();
  const [filter, setFilter] = useState<FilterTab>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc key closes panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Build unified list
  const allMessages: Message[] = [...messages, ...feedMessages];
  const items: UnifiedItem[] = [];

  if (filter === 'all' || filter === 'messages') {
    for (const m of allMessages) {
      items.push({ kind: 'message', data: m });
    }
  }
  if (filter === 'all' || filter === 'notifications') {
    for (const n of notifications) {
      items.push({ kind: 'notification', data: n });
    }
  }

  // Sort by time descending (newest first)
  items.sort((a, b) => {
    const ta = a.kind === 'message' ? a.data.created_at : a.data.created_at;
    const tb = b.kind === 'message' ? b.data.created_at : b.data.created_at;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  const handleItemClick = (item: UnifiedItem) => {
    const tabId = item.kind === 'message' ? item.data.from_tab_id : item.data.tab_id;
    if (tabId) {
      onNavigateTab(tabId);
      onClose();
    }
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'messages', label: '메시지' },
    { key: 'notifications', label: '알림' },
  ];

  const panelWidth = isMobile ? '100%' : '340px';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50,
          transition: 'opacity 0.2s',
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: panelWidth, zIndex: 51,
          background: '#faf7f2', borderLeft: '2px solid #5c5470',
          display: 'flex', flexDirection: 'column',
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '2px solid #5c5470',
          height: '52px',
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#4c4f69' }}>알림센터</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {totalUnread > 0 && (
              <button
                onClick={clearAll}
                style={{
                  fontSize: '0.6875rem', color: '#8c8fa1', background: 'none',
                  border: 'none', cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                모두 읽음
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'none', cursor: 'pointer', color: '#6c6f85',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: '2px', padding: '8px 16px',
          borderBottom: '1px solid #cdc8bf',
        }}>
          {filterTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              style={{
                padding: '4px 12px', borderRadius: '3px', border: '1px solid',
                fontSize: '0.6875rem', fontWeight: filter === t.key ? 700 : 400,
                cursor: 'pointer',
                background: filter === t.key ? '#4c4f69' : 'transparent',
                color: filter === t.key ? '#faf7f2' : '#8c8fa1',
                borderColor: filter === t.key ? '#4c4f69' : '#cdc8bf',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Items list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {items.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#8c8fa1', fontSize: '0.8125rem' }}>
              알림이 없습니다
            </div>
          ) : (
            items.map((item, i) => {
              const tabId = item.kind === 'message' ? item.data.from_tab_id : item.data.tab_id;
              const clickable = !!tabId;
              return (
                <div
                  key={item.kind === 'message' ? item.data.id : item.data.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    padding: '10px 16px', cursor: clickable ? 'pointer' : 'default',
                    borderBottom: i < items.length - 1 ? '1px solid #e6e2db' : undefined,
                  }}
                  onMouseEnter={e => { if (clickable) e.currentTarget.style.background = '#f0ece4'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.kind === 'message' ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <MessageSquare size={12} style={{ color: '#179299', flexShrink: 0 }} />
                        <span style={{
                          fontSize: '0.625rem', padding: '1px 6px', borderRadius: '2px',
                          background: '#e6e2db', color: '#5c5f77', fontWeight: 600,
                        }}>
                          {scopeLabel(item.data.scope)}
                        </span>
                        <span style={{ fontSize: '0.625rem', color: '#8c8fa1' }}>
                          {item.data.from_tab_id?.slice(0, 8)}
                        </span>
                        <span style={{ fontSize: '0.625rem', color: '#8c8fa1', marginLeft: 'auto' }}>
                          {relativeTime(item.data.created_at)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#4c4f69', lineHeight: 1.4 }}>
                        {item.data.body}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <Bell size={12} style={{ color: '#df8e1d', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4c4f69' }}>
                          {item.data.title}
                        </span>
                        <span style={{ fontSize: '0.625rem', color: '#8c8fa1', marginLeft: 'auto' }}>
                          {relativeTime(item.data.created_at)}
                        </span>
                      </div>
                      {item.data.body && (
                        <div style={{ fontSize: '0.8125rem', color: '#5c5f77', lineHeight: 1.4 }}>
                          {item.data.body}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (컴포넌트가 아직 마운트되지 않으므로 임포트 에러 없음)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/NotificationCenter.tsx
git commit -m "feat: add NotificationCenter slide panel component"
```

---

### Task 5: Frontend — 탭바에 벨 아이콘 추가 + ProjectView에 패널 마운트

**Files:**
- Modify: `frontend/src/components/ProjectView.tsx:197-272` (tab bar area)
- Modify: `frontend/src/components/ProjectView.tsx:134` (root div)

- [ ] **Step 1: ProjectView에 import 추가 및 상태 선언**

`frontend/src/components/ProjectView.tsx` 상단에 import 추가:

```typescript
import { Bell } from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { useEventsContext } from '../contexts/EventsContext';
```

컴포넌트 내부에 상태와 context 추가 (기존 state 선언 영역):

```typescript
const [notifOpen, setNotifOpen] = useState(false);
const { totalUnread } = useEventsContext();
```

- [ ] **Step 2: 탭바 오른쪽 끝에 벨 아이콘 추가**

`frontend/src/components/ProjectView.tsx` — `+ Shell` 버튼 뒤, 탭바 닫는 `</div>}` (line 272) 직전에 벨 아이콘 추가:

```typescript
        {/* Notification bell */}
        <button
          onClick={() => setNotifOpen(o => !o)}
          style={{
            marginLeft: 'auto', marginRight: '8px', flexShrink: 0,
            width: '26px', height: '26px', alignSelf: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #5c5470', borderRadius: '3px',
            background: notifOpen ? '#4c4f69' : '#faf7f2',
            color: notifOpen ? '#faf7f2' : '#5c5f77',
            cursor: 'pointer', position: 'relative',
            boxShadow: '2px 2px 0 #5c5470',
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'translate(1px, 1px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #5c5470'; }}
          onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 2px 0 #5c5470'; }}
          title="알림센터"
        >
          <Bell size={14} />
          {totalUnread > 0 && (
            <span style={{
              position: 'absolute', top: '-5px', right: '-5px',
              minWidth: '16px', height: '16px', borderRadius: '8px',
              background: '#e64553', color: '#fff', fontSize: '0.625rem',
              fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px', lineHeight: 1,
            }}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
```

- [ ] **Step 3: ProjectView 루트에 NotificationCenter 마운트**

`frontend/src/components/ProjectView.tsx` — 루트 div를 `position: relative`로 변경하고 (이미 transparent background가 있는 line 134), 컴포넌트 끝 (`</div>` 최하단) 직전에 NotificationCenter 추가:

```typescript
      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onNavigateTab={(tabId) => {
          const tab = tabs.find(t => t.id === tabId);
          if (tab) setActiveTabId(tabId);
        }}
        isMobile={isMobile}
      />
    </div>
```

루트 div 스타일에 `position: 'relative'` 추가 (NotificationCenter의 absolute 포지셔닝 기준):

기존: `<div className="flex flex-col h-full" style={{ background: 'transparent' }}>`
변경: `<div className="flex flex-col h-full" style={{ background: 'transparent', position: 'relative' }}>`

- [ ] **Step 4: 벨 아이콘이 비-terminals 모드에서도 보이도록 header에도 추가**

`frontend/src/components/ProjectView.tsx` — header의 font size controls (`ml-auto` div, line 164) 앞에 벨 아이콘 추가:

```typescript
          {/* Notification bell (in header for non-terminal modes) */}
          {mode !== 'terminals' && (
            <button
              onClick={() => setNotifOpen(o => !o)}
              style={{
                marginLeft: 'auto', flexShrink: 0,
                width: '26px', height: '26px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #5c5470', borderRadius: '3px',
                background: notifOpen ? '#4c4f69' : '#faf7f2',
                color: notifOpen ? '#faf7f2' : '#5c5f77',
                cursor: 'pointer', position: 'relative',
                boxShadow: '2px 2px 0 #5c5470',
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translate(1px, 1px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #5c5470'; }}
              onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '2px 2px 0 #5c5470'; }}
              title="알림센터"
            >
              <Bell size={14} />
              {totalUnread > 0 && (
                <span style={{
                  position: 'absolute', top: '-5px', right: '-5px',
                  minWidth: '16px', height: '16px', borderRadius: '8px',
                  background: '#e64553', color: '#fff', fontSize: '0.625rem',
                  fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', lineHeight: 1,
                }}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          )}
```

해당 div의 `ml-auto`를 제거 (벨 아이콘의 `marginLeft: 'auto'`가 대체):

기존: `<div className="flex items-center gap-1 ml-auto">`
변경 (terminals 모드): `<div className="flex items-center gap-1 ml-auto">`  (terminals 모드에서는 벨이 탭바에 있으므로 유지)
변경 (non-terminals 모드): 벨 아이콘이 `marginLeft: 'auto'`를 가지므로 font controls div에서 `ml-auto` 조건부 적용:

```typescript
        <div className={`flex items-center gap-1 ${mode === 'terminals' ? 'ml-auto' : ''}`}>
```

- [ ] **Step 5: 빌드 확인**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ProjectView.tsx
git commit -m "feat: add bell icon to tab bar and mount NotificationCenter"
```

---

### Task 6: Frontend — Inbox/Feed 전체화면 뷰 제거 및 Sidebar 정리

**Files:**
- Delete: `frontend/src/components/InboxPanel.tsx`
- Delete: `frontend/src/components/FeedPanel.tsx`
- Modify: `frontend/src/App.tsx` (showInbox/showFeed 제거, import 제거)
- Modify: `frontend/src/components/Sidebar.tsx` (Inbox/Feed 버튼 제거)
- Modify: `frontend/src/components/Layout.tsx` (Inbox/Feed props 제거)

- [ ] **Step 1: App.tsx에서 Inbox/Feed 상태 및 관련 로직 제거**

`frontend/src/App.tsx` 변경:

import에서 제거:
```typescript
// 삭제: import InboxPanel from './components/InboxPanel';
// 삭제: import FeedPanel from './components/FeedPanel';
```

상태 제거:
```typescript
// 삭제: const [showInbox, setShowInbox] = useState(false);
// 삭제: const [showFeed, setShowFeed] = useState(false);
```

EventsContext에서 `unreadInboxCount`, `unreadFeedCount` 사용 제거:
```typescript
// 기존: const { unreadInboxCount, unreadFeedCount } = useEventsContext();
// 삭제 (더이상 App에서 사용 안 함)
```

Layout props 정리 — Inbox/Feed 관련 props 제거:
```typescript
        onSettings={() => { setShowSettings(s => !s); }}
        isSettingsActive={showSettings}
        // 삭제: onInbox, isInboxActive, inboxBadge, onFeed, isFeedActive, feedBadge
```

children 렌더링 정리:
```typescript
        {showSettings ? (
          <SettingsView />
        ) : selectedProject ? (
          <ProjectView project={selectedProject} />
        ) : (
          <Dashboard projects={projects} onSelectProject={(id) => { setSelectedProjectId(id); setShowSettings(false); }} />
        )}
```

- [ ] **Step 2: Layout.tsx에서 Inbox/Feed props 제거**

`frontend/src/components/Layout.tsx` — LayoutProps interface에서 제거:

```typescript
// 삭제: onInbox?, isInboxActive?, inboxBadge?, onFeed?, isFeedActive?, feedBadge?
```

함수 파라미터와 Sidebar 전달에서도 동일하게 제거.

- [ ] **Step 3: Sidebar.tsx에서 Inbox/Feed 버튼 제거**

`frontend/src/components/Sidebar.tsx`:
- Props interface에서 `onInbox`, `isInboxActive`, `inboxBadge`, `onFeed`, `isFeedActive`, `feedBadge` 제거
- 함수 파라미터에서 제거
- Inbox 버튼 JSX (lines ~448-470) 제거
- Feed 버튼 JSX (lines ~471-493) 제거

- [ ] **Step 4: InboxPanel.tsx, FeedPanel.tsx 파일 삭제**

```bash
rm frontend/src/components/InboxPanel.tsx frontend/src/components/FeedPanel.tsx
```

- [ ] **Step 5: 빌드 확인**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS (모든 참조가 정리되었으므로 에러 없음)

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/components/InboxPanel.tsx frontend/src/components/FeedPanel.tsx \
  frontend/src/App.tsx frontend/src/components/Layout.tsx frontend/src/components/Sidebar.tsx
git commit -m "refactor: remove Inbox/Feed full-screen views, consolidate into NotificationCenter"
```

---

### Task 7: 통합 테스트 — 프로덕션 빌드 및 E2E 확인

**Files:** (변경 없음, 확인만)

- [ ] **Step 1: 백엔드 테스트**

Run: `make test`
Expected: all tests pass

- [ ] **Step 2: 프론트엔드 빌드**

Run: `cd frontend && npm run build`
Expected: build succeeds with no errors

- [ ] **Step 3: 프로덕션 바이너리 빌드**

Run: `make build`
Expected: `bin/gosok` binary created

- [ ] **Step 4: 수동 E2E 확인**

서버 실행 후:
1. 브라우저에서 프로젝트 선택 → terminals 모드 → 탭바 오른쪽에 벨 아이콘 확인
2. `./bin/gosok notify "테스트" --body "알림 테스트"` 실행
3. 벨 아이콘에 빨간 뱃지 나타나는지 확인
4. 벨 클릭 → 오른쪽 슬라이드 패널에 알림 항목 표시 확인
5. 항목 클릭 → 해당 탭으로 이동 확인
6. 패널 외부 클릭 / Esc → 패널 닫힘 확인
7. 필터 탭 (전체/메시지/알림) 전환 확인
8. 왼쪽 사이드바에 Inbox/Feed 버튼 없는 것 확인

- [ ] **Step 5: Commit (필요 시 수정사항)**

수동 테스트에서 발견된 문제가 있으면 수정 후 커밋.
