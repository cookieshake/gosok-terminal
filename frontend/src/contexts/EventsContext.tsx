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

export interface ToastItem {
  id: string;
  notification: StoredNotification;
}

interface EventsContextValue {
  messages: Message[];
  feedMessages: Message[];
  notifications: StoredNotification[];
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  markRead: (id: string) => void;
  markTabNotificationsRead: (tabId: string) => void;
  readIds: Set<string>;
  unreadInboxCount: number;
  unreadFeedCount: number;
  unreadNotifCount: number;
  totalUnread: number;
  markAllRead: () => void;
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
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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

    // Toast (auto-dismiss after 4s)
    const toastId = stored.id;
    setToasts(prev => [...prev, { id: toastId, notification: stored }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, 4000);

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

  const markAllRead = useCallback(() => {
    setReadIds(prev => {
      const next = new Set(prev);
      messages.forEach(m => next.add(m.id));
      feedMessages.forEach(m => next.add(m.id));
      notifications.forEach(n => next.add(n.id));
      return next;
    });
    setUnreadInboxCount(0);
    setUnreadFeedCount(0);
    setUnreadNotifCount(0);
  }, [messages, feedMessages, notifications]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markRead = useCallback((id: string) => {
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // Decrement the appropriate unread counter
    if (id.startsWith('notif-')) {
      setUnreadNotifCount(prev => Math.max(0, prev - 1));
    } else {
      // Could be inbox or feed — check both
      const isInbox = messages.some(m => m.id === id);
      if (isInbox) setUnreadInboxCount(prev => Math.max(0, prev - 1));
      else setUnreadFeedCount(prev => Math.max(0, prev - 1));
    }
  }, [messages]);

  const markTabNotificationsRead = useCallback((tabId: string) => {
    const unreadForTab = notifications.filter(n => n.tab_id === tabId && !readIds.has(n.id));
    if (unreadForTab.length === 0) return;
    setReadIds(prev => {
      const next = new Set(prev);
      unreadForTab.forEach(n => next.add(n.id));
      return next;
    });
    setUnreadNotifCount(prev => Math.max(0, prev - unreadForTab.length));
  }, [notifications, readIds]);

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
      toasts,
      dismissToast,
      markRead,
      markTabNotificationsRead,
      readIds,
      unreadInboxCount,
      unreadFeedCount,
      unreadNotifCount,
      totalUnread,
      markAllRead,
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
