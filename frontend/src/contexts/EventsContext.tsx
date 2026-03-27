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
