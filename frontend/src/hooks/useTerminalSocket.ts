import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

// v2 frame format: [1B type][2B meta_len BE][meta JSON][body]
const FRAME_OUTPUT = 0x01;
const FRAME_SNAPSHOT = 0x02;
const FRAME_EXIT = 0x03;
const FRAME_ERROR = 0x04;
const FRAME_INPUT = 0x05;
const FRAME_RESIZE = 0x06;
const FRAME_PING = 0x07;
const FRAME_PONG = 0x08;

function encodeFrame(type: number, meta: object | null, body: Uint8Array | null): Uint8Array {
  const metaJson = JSON.stringify(meta ?? {});
  const metaBytes = new TextEncoder().encode(metaJson);
  if (metaBytes.length > 0xffff) {
    throw new Error(`meta too large: ${metaBytes.length}`);
  }
  const bodyBytes = body ?? new Uint8Array(0);
  const out = new Uint8Array(3 + metaBytes.length + bodyBytes.length);
  out[0] = type;
  out[1] = (metaBytes.length >> 8) & 0xff;
  out[2] = metaBytes.length & 0xff;
  out.set(metaBytes, 3);
  out.set(bodyBytes, 3 + metaBytes.length);
  return out;
}

interface DecodedFrame {
  type: number;
  meta: Record<string, unknown>;
  body: Uint8Array;
}

function decodeFrame(data: ArrayBuffer): DecodedFrame | null {
  const view = new Uint8Array(data);
  if (view.length < 3) return null;
  const type = view[0];
  const metaLen = (view[1] << 8) | view[2];
  if (3 + metaLen > view.length) return null;
  const metaBytes = view.subarray(3, 3 + metaLen);
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(new TextDecoder().decode(metaBytes));
  } catch {
    return null;
  }
  const body = view.subarray(3 + metaLen);
  return { type, meta, body };
}

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
// On foreground/online we don't blindly reconnect; we send a ping and wait this
// long for any server frame. Long enough to tolerate a slow mobile RTT, short
// enough that a genuinely dead socket recovers quickly.
const PROBE_TIMEOUT_MS = 3_000;

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
    let probePending = false; // awaiting a server frame in response to a foreground liveness probe
    let currentProbeId = 0; // bumped on each probe / reconnect to invalidate stale probe timeouts
    let probeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastSentCols = 0;
    let lastSentRows = 0;
    const encoder = new TextEncoder();

    const startHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      lastMessageAt = Date.now();
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(encodeFrame(FRAME_PING, null, null));
        }
        if (Date.now() - lastMessageAt > HEARTBEAT_TIMEOUT_MS && ws?.readyState === WebSocket.OPEN) {
          // Socket reports OPEN but the server has gone silent (asymmetric
          // failure the server's own pong-timeout can't catch, since our pings
          // still reach it). Flag, then auto-recover instead of waiting for a
          // manual Reconnect click.
          setConnectionDead(true);
          forceReconnect();
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

      sock.onopen = () => {
        reconnectDelay = RECONNECT_INITIAL_MS;
        setConnectionDead(false);
        startHeartbeat();
        try { fitAddonRef.current?.fit(); } catch { /* element detached */ }
        sock.send(encodeFrame(FRAME_RESIZE, { cols: terminal.cols, rows: terminal.rows }, null));
        lastSentCols = terminal.cols;
        lastSentRows = terminal.rows;
      };

      sock.onmessage = (event) => {
        lastMessageAt = Date.now();
        probePending = false; // any server frame proves the socket is alive
        setConnectionDead(false);
        if (!(event.data instanceof ArrayBuffer)) return; // v2: text frames are not used
        const f = decodeFrame(event.data);
        if (!f) return;
        switch (f.type) {
          case FRAME_OUTPUT:
            terminal.write(f.body);
            break;
          case FRAME_SNAPSHOT:
            terminal.reset();
            terminal.write(f.body);
            break;
          case FRAME_EXIT: {
            const code = (f.meta.code as number | undefined) ?? -1;
            terminal.writeln(`\r\n[Process exited with code ${code}]`);
            break;
          }
          case FRAME_ERROR: {
            const message = (f.meta.message as string | undefined) ?? 'unknown';
            terminal.writeln(`\r\n[Error: ${message}]`);
            break;
          }
          case FRAME_PONG:
            // heartbeat ack — lastMessageAt already bumped above
            break;
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

    // Function declaration (not const arrow) so startHeartbeat's interval
    // callback, defined earlier in this scope, can reference it via hoisting.
    function forceReconnect() {
      if (destroyed) return;
      // Invalidate any in-flight probe so its timeout can't reconnect the
      // socket we're about to create.
      probePending = false;
      currentProbeId++;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (probeTimer) clearTimeout(probeTimer);
      reconnectDelay = RECONNECT_INITIAL_MS;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        try { ws.close(); } catch { /* unreachable */ }
      }
      connect();
    }
    reconnectFnRef.current = forceReconnect;

    // On foreground/online, confirm the socket is actually alive before
    // tearing it down. A blind reconnect re-snapshots and terminal.reset()s,
    // losing the user's scroll position on every tab switch. We instead send a
    // ping and only reconnect if no server frame arrives — which also avoids a
    // false positive where a perfectly healthy idle socket merely *looks* stale
    // because background timer throttling stopped our heartbeat pings.
    const probeLiveness = () => {
      if (destroyed) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        forceReconnect();
        return;
      }
      // Reset the heartbeat baseline so the accumulated background time gap
      // doesn't trip the 45s timeout before the probe resolves.
      lastMessageAt = Date.now();
      probePending = true;
      // Capture both the probed socket and a probe id. ws is reassigned by
      // connect(), and overlapping probes can re-arm probePending, so the
      // timeout must verify it's still the latest probe (probeId) on the same
      // socket (probedSock) before reconnecting — otherwise a stale timeout
      // tears down a healthy socket.
      const probedSock = ws;
      const probeId = ++currentProbeId;
      try {
        probedSock.send(encodeFrame(FRAME_PING, null, null));
      } catch {
        forceReconnect();
        return;
      }
      if (probeTimer) clearTimeout(probeTimer);
      probeTimer = setTimeout(() => {
        probeTimer = null;
        if (destroyed || !probePending || probeId !== currentProbeId || ws !== probedSock) return;
        if (probedSock.readyState === WebSocket.OPEN) {
          probePending = false;
          forceReconnect();
        }
      }, PROBE_TIMEOUT_MS);
    };

    const onForeground = () => {
      if (document.visibilityState === 'visible') probeLiveness();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) forceReconnect(); // a bfcache-restored page's socket is always dead
    };
    const onOnline = () => probeLiveness();
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    const sendData = (data: string): boolean => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encodeFrame(FRAME_INPUT, null, encoder.encode(data)));
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
      ws.send(encodeFrame(FRAME_RESIZE, { cols: c, rows: r }, null));
      lastSentCols = c;
      lastSentRows = r;
    };
    sendResizeRef.current = sendResize;

    // ws is reassigned by every connect() call; this closure reads it by
    // reference, so reconnects automatically retarget without re-registering
    // the xterm onData listener.
    dataListenerRef.current = terminal.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encodeFrame(FRAME_INPUT, null, encoder.encode(data)));
      }
    });

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (probeTimer) clearTimeout(probeTimer);
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
