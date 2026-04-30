import { useEffect, useRef, useCallback } from 'react';

export interface MessageEvent {
  id: string;
  scope: string;
  from_tab_id: string;
  to_tab_id?: string;
  body: string;
  created_at: string;
}

export interface NotificationEvent {
  title: string;
  body: string;
  tab_id?: string;
  flag?: boolean;
}

interface EventData {
  type: 'message' | 'notification';
  message?: MessageEvent;
  notification?: NotificationEvent;
}

interface UseEventsOptions {
  onMessage?: (msg: MessageEvent) => void;
  onNotification?: (notif: NotificationEvent) => void;
}

export function useEvents({ onMessage, onNotification }: UseEventsOptions) {
  const onMessageRef = useRef(onMessage);
  const onNotificationRef = useRef(onNotification);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onNotificationRef.current = onNotification;
  });

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/api/ws/events`;
    const ws = new WebSocket(url);

    ws.onmessage = (e) => {
      try {
        const data: EventData = JSON.parse(e.data);
        if (data.type === 'message' && data.message) {
          onMessageRef.current?.(data.message);
        } else if (data.type === 'notification' && data.notification) {
          onNotificationRef.current?.(data.notification);
        }
      } catch { /* ignore */ }
    };

    return ws;
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectDelay = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let destroyed = false;

    const scheduleReconnect = () => {
      if (destroyed) return;
      reconnectTimer = setTimeout(connectAndAttach, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    };

    const connectAndAttach = () => {
      if (destroyed) return;
      try {
        ws = connect();
        ws.onopen = () => {
          reconnectDelay = 1000;
          (window as unknown as { __GOSOK_EVENTS_READY?: boolean }).__GOSOK_EVENTS_READY = true;
        };
        ws.onclose = () => {
          (window as unknown as { __GOSOK_EVENTS_READY?: boolean }).__GOSOK_EVENTS_READY = false;
          scheduleReconnect();
        };
      } catch (error) {
        console.error('WebSocket connection failed, retrying:', error);
        scheduleReconnect();
      }
    };

    // Mobile OS often suspends TCP while the tab is backgrounded; the socket
    // can come back as a zombie or surface a close only after a long delay.
    // On foreground/online, drop whatever we have and reconnect immediately
    // instead of riding out the backoff.
    const forceReconnect = () => {
      if (destroyed) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectDelay = 1000;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        // close() only throws on invalid code/reason, neither of which we pass.
        try { ws.close(); } catch { /* unreachable */ }
      }
      connectAndAttach();
    };
    const onForeground = () => {
      if (document.visibilityState === 'visible') forceReconnect();
    };
    // Only bfcache restores — normal loads already connect via the initial
    // connectAndAttach() call, and the visible case is covered by visibilitychange.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) forceReconnect();
    };
    const onOnline = () => forceReconnect();
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    connectAndAttach();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      if (ws) ws.close();
    };
  }, [connect]);
}
