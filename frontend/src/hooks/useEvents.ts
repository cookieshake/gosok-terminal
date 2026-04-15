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
        };
        ws.onclose = scheduleReconnect;
      } catch (error) {
        console.error('WebSocket connection failed, retrying:', error);
        scheduleReconnect();
      }
    };

    connectAndAttach();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [connect]);
}
