import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useEvents } from '../hooks/useEvents';
import type { MessageEvent, NotificationEvent } from '../hooks/useEvents';
import type { Message } from '../api/types';

interface EventsContextValue {
  messages: Message[];
  feedMessages: Message[];
  unreadInboxCount: number;
  unreadFeedCount: number;
  clearInbox: () => void;
  clearFeed: () => void;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [feedMessages, setFeedMessages] = useState<Message[]>([]);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);
  const [unreadFeedCount, setUnreadFeedCount] = useState(0);

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
    if (Notification.permission === 'granted') {
      new Notification(notif.title, { body: notif.body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          new Notification(notif.title, { body: notif.body });
        }
      });
    }
  }, []);

  useEvents({ onMessage: handleMessage, onNotification: handleNotification });

  const clearInbox = useCallback(() => {
    setMessages([]);
    setUnreadInboxCount(0);
  }, []);

  const clearFeed = useCallback(() => {
    setFeedMessages([]);
    setUnreadFeedCount(0);
  }, []);

  return (
    <EventsContext.Provider value={{
      messages,
      feedMessages,
      unreadInboxCount,
      unreadFeedCount,
      clearInbox,
      clearFeed,
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
