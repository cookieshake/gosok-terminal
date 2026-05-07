import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

interface UseTerminalSocketArgs {
  wsUrl: string;
  terminalRef: RefObject<Terminal | null>;
  fitAddonRef: RefObject<FitAddon | null>;
  setConnectionDead: Dispatch<SetStateAction<boolean>>;
  /** Out param: function the parent calls to manually trigger a reconnect. */
  reconnectFnRef: RefObject<(() => void) | null>;
  /** Out param: function the parent calls to send raw data to the PTY. Returns true if WS was OPEN. */
  sendDataRef: RefObject<((data: string) => boolean) | null>;
  /** Out param: function the parent calls when xterm dimensions change. */
  sendResizeRef: RefObject<(() => void) | null>;
  /** Notification when the sendData function becomes available (forwarded to parent). */
  onSendDataReady?: (fn: (data: string) => void) => void;
  /** Trigger to (re)run the effect after the parent has created the terminal. */
  ready: boolean;
}

const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;

/**
 * Owns the PTY WebSocket: connect, snapshot handling, reconnect with
 * exponential backoff, heartbeat, foreground/online/bfcache re-connect, and
 * resize message dedup. Exposes sendData/sendResize/forceReconnect via refs
 * the parent component already holds.
 *
 * The `ready` flag should flip to true once the parent has created the xterm
 * Terminal instance (so terminalRef.current is non-null). The hook returns
 * early when not ready.
 */
export function useTerminalSocket({
  wsUrl,
  terminalRef,
  fitAddonRef,
  setConnectionDead,
  reconnectFnRef,
  sendDataRef,
  sendResizeRef,
  onSendDataReady,
  ready,
}: UseTerminalSocketArgs) {
  const dataListenerRef = useRef<{ dispose: () => void } | null>(null);

  // Stash onSendDataReady in a ref so callers can pass an inline arrow
  // function without triggering a WS reconnect on every parent render.
  // Reads happen at most once per WS connect — fresh value is fine.
  const onSendDataReadyRef = useRef(onSendDataReady);
  useEffect(() => {
    onSendDataReadyRef.current = onSendDataReady;
  });

  useEffect(() => {
    if (!ready) return;
    const terminal = terminalRef.current;
    if (!terminal) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fullUrl = wsUrl.startsWith('ws')
      ? wsUrl
      : `${protocol}//${window.location.host}${wsUrl}`;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;
    let reconnectDelay = RECONNECT_INITIAL_MS;
    let lastMessageAt = Date.now();
    let lastSentCols = 0;
    let lastSentRows = 0;
    const encoder = new TextEncoder();

    const startHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      lastMessageAt = Date.now();
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
        if (Date.now() - lastMessageAt > HEARTBEAT_TIMEOUT_MS && ws?.readyState === WebSocket.OPEN) {
          setConnectionDead(true);
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    const connect = () => {
      let sock: WebSocket;
      try {
        sock = new WebSocket(fullUrl);
      } catch (err) {
        console.error('[terminal] WebSocket construction failed', err);
        setConnectionDead(true);
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
        return;
      }
      ws = sock;
      sock.binaryType = 'arraybuffer';

      let pendingSnapshot = false;

      sock.onopen = () => {
        reconnectDelay = RECONNECT_INITIAL_MS;
        setConnectionDead(false);
        startHeartbeat();
        try { fitAddonRef.current?.fit(); } catch { /* element detached */ }
        sock.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }));
        lastSentCols = terminal.cols;
        lastSentRows = terminal.rows;
      };

      sock.onmessage = (event) => {
        lastMessageAt = Date.now();
        setConnectionDead(false);
        if (event.data instanceof ArrayBuffer) {
          if (pendingSnapshot) {
            terminal.reset();
            pendingSnapshot = false;
          }
          terminal.write(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'snapshot') {
              pendingSnapshot = true;
            } else if (msg.type === 'exit') {
              terminal.writeln(`\r\n[Process exited with code ${msg.code}]`);
            } else if (msg.type === 'error') {
              terminal.writeln(`\r\n[Error: ${msg.message}]`);
            }
          } catch { /* ignore */ }
        }
      };

      sock.onclose = () => {
        if (destroyed) return;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        setConnectionDead(false);
        terminal.writeln('\r\n[Connection lost. Reconnecting...]');
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
      };
    };

    const forceReconnect = () => {
      if (destroyed) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reconnectDelay = RECONNECT_INITIAL_MS;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        try { ws.close(); } catch { /* unreachable */ }
      }
      connect();
    };
    reconnectFnRef.current = forceReconnect;

    const onForeground = () => {
      if (document.visibilityState === 'visible') forceReconnect();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) forceReconnect();
    };
    const onOnline = () => forceReconnect();
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    const sendData = (data: string): boolean => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
        return true;
      }
      return false;
    };
    sendDataRef.current = sendData;
    onSendDataReadyRef.current?.((data) => { sendData(data); });

    const sendResize = () => {
      const c = terminal.cols;
      const r = terminal.rows;
      if (c === lastSentCols && r === lastSentRows) return;
      if (ws?.readyState !== WebSocket.OPEN) return;
      if (terminal.buffer.active.type === 'alternate') {
        terminal.write('\x1b[2J\x1b[H');
      }
      ws.send(JSON.stringify({ type: 'resize', cols: c, rows: r }));
      lastSentCols = c;
      lastSentRows = r;
    };
    sendResizeRef.current = sendResize;

    dataListenerRef.current = terminal.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reconnectFnRef.current = null;
      sendDataRef.current = null;
      sendResizeRef.current = null;
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      dataListenerRef.current?.dispose();
      dataListenerRef.current = null;
      ws?.close();
    };
  }, [wsUrl, ready, terminalRef, fitAddonRef, setConnectionDead, reconnectFnRef, sendDataRef, sendResizeRef]);
}
