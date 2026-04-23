import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { ArrowDown, RefreshCw } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

type Modifier = 'ctrl' | 'alt' | 'shift' | null;

interface TerminalPaneProps {
  wsUrl: string;
  fontSize?: number;
  fontFamily?: string;
  visible?: boolean;
  onSendDataReady?: (fn: (data: string) => void) => void;
  onTitleChange?: (title: string) => void;
  onSelectModeReady?: (fn: () => void) => void;
  activeModifier?: Modifier;
  onModifierUsed?: () => void;
}

const DEFAULT_FONT_FAMILY = 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace';

export default function TerminalPane({
  wsUrl,
  fontSize = 14,
  fontFamily = DEFAULT_FONT_FAMILY,
  visible,
  onSendDataReady,
  onTitleChange,
  onSelectModeReady,
  activeModifier,
  onModifierUsed,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sendResizeRef = useRef<(() => void) | null>(null);
  const sendDataRef = useRef<((data: string) => void) | null>(null);
  const reconnectFnRef = useRef<(() => void) | null>(null);
  const selectOverlayRef = useRef<HTMLPreElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [connectionDead, setConnectionDead] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectText, setSelectText] = useState('');

  const scrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom();
  }, []);

  const toggleSelectMode = useCallback(() => {
    if (selectMode) {
      setSelectMode(false);
      return;
    }
    const terminal = terminalRef.current;
    if (!terminal) return;
    const buf = terminal.buffer.active;
    const lines: string[] = [];
    const maxLines = Math.min(buf.length, 5000);
    for (let i = 0; i < maxLines; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    setSelectText(lines.join('\n'));
    setSelectMode(true);
    requestAnimationFrame(() => {
      const el = selectOverlayRef.current;
      if (!el) return;
      el.scrollTop = buf.viewportY * fontSize * 1.2;
    });
  }, [fontSize, selectMode]);

  useEffect(() => {
    if (!activeModifier || activeModifier === 'shift') return;
    const textarea = terminalRef.current?.textarea;
    if (!textarea) return;

    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const key = e.key.toLowerCase();
      if (key.length !== 1 || key < 'a' || key > 'z') return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const data = activeModifier === 'ctrl'
        ? String.fromCharCode(key.charCodeAt(0) - 96)
        : '\x1b' + key;

      sendDataRef.current?.(data);
      onModifierUsed?.();
    };

    textarea.addEventListener('keydown', handler, { capture: true });
    return () => textarea.removeEventListener('keydown', handler, { capture: true });
  }, [activeModifier, onModifierUsed]);

  useEffect(() => {
    if (!visible) return;
    const fitAddon = fitAddonRef.current;
    if (!fitAddon) return;
    fitAddon.fit();
    sendResizeRef.current?.();
  }, [visible]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;
    terminal.options.fontSize = fontSize;
    terminal.options.fontFamily = fontFamily;
    fitAddon.fit();
    sendResizeRef.current?.();
  }, [fontSize, fontFamily]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily,
      vtExtensions: { kittyKeyboard: true },
      theme: {
        background: '#eff1f5',
        foreground: '#4c4f69',
        cursor: '#dc8a78',
        selectionBackground: '#acb0be',
        black: '#5c5f77',
        red: '#d20f39',
        green: '#40a02b',
        yellow: '#df8e1d',
        blue: '#1e66f5',
        magenta: '#8839ef',
        cyan: '#179299',
        white: '#acb0be',
        brightBlack: '#6c6f85',
        brightRed: '#d20f39',
        brightGreen: '#40a02b',
        brightYellow: '#df8e1d',
        brightBlue: '#1e66f5',
        brightMagenta: '#8839ef',
        brightCyan: '#179299',
        brightWhite: '#4c4f69',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    (window as unknown as { __GOSOK_TERMINAL__?: Terminal }).__GOSOK_TERMINAL__ = terminal;

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      terminal.loadAddon(webglAddon);
    } catch {
      // WebGL2 unavailable — xterm falls back to canvas renderer automatically
    }

    const updateScrollState = () => {
      const buffer = terminal.buffer.active;
      setShowScrollDown(buffer.viewportY < buffer.baseY);
    };
    terminal.onScroll(updateScrollState);
    terminal.onWriteParsed(updateScrollState);

    document.fonts.load(`${fontSize}px MonoplexNerd`).then(() => fitAddon.fit());

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fullUrl = wsUrl.startsWith('ws')
      ? wsUrl
      : `${protocol}//${window.location.host}${wsUrl}`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;
    let reconnectDelay = 1000;
    let serverOffset = 0;
    let lastMessageAt = Date.now();
    const encoder = new TextEncoder();

    const forceReconnect = () => {
      if (destroyed) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      setConnectionDead(false);
      try { ws.close(); } catch { /* ignore */ }
      connect();
    };
    reconnectFnRef.current = forceReconnect;

    const startHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      lastMessageAt = Date.now();
      heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
        if (Date.now() - lastMessageAt > 45_000 && ws.readyState === WebSocket.OPEN) {
          setConnectionDead(true);
        }
      }, 15_000);
    };

    const connect = () => {
      ws = new WebSocket(fullUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        reconnectDelay = 1000;
        setConnectionDead(false);
        startHeartbeat();
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
          offset: serverOffset,
        }));
      };

      ws.onmessage = (event) => {
        lastMessageAt = Date.now();
        setConnectionDead(false);
        if (event.data instanceof ArrayBuffer) {
          serverOffset += event.data.byteLength;
          terminal.write(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'sync') {
              if (serverOffset > 0 && msg.offset !== serverOffset) {
                terminal.reset();
              }
              serverOffset = msg.offset;
            } else if (msg.type === 'exit') {
              terminal.writeln(`\r\n[Process exited with code ${msg.code}]`);
            } else if (msg.type === 'error') {
              terminal.writeln(`\r\n[Error: ${msg.message}]`);
            }
          } catch { /* ignore */ }
        }
      };

      ws.onclose = () => {
        if (destroyed) return;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        setConnectionDead(false);
        terminal.writeln('\r\n[Connection lost. Reconnecting...]');
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      };
    };
    connect();

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
      }
    };
    sendResizeRef.current = sendResize;

    const sendData = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(encoder.encode(data));
    };
    sendDataRef.current = sendData;
    onSendDataReady?.(sendData);

    terminal.onTitleChange((title) => onTitleChange?.(title));

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
        sendResize();
      });
    });
    resizeObserver.observe(container);

    // iOS Safari requires focus() to happen inside a user-gesture handler to
    // pop the virtual keyboard. Synthesize that from touchend on a tap (no
    // significant finger movement).
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchMoved = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      if (dx > 5 || dy > 5) touchMoved = true;
    };
    const onTouchEnd = () => {
      if (!touchMoved) terminal.textarea?.focus();
    };
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reconnectFnRef.current = null;
      resizeObserver.disconnect();
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      ws.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onSelectModeReady?.(toggleSelectMode);
  }, [toggleSelectMode, onSelectModeReady]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#eff1f5]" data-testid="terminal-pane">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      />
      {connectionDead && (
        <button
          type="button"
          onClick={() => reconnectFnRef.current?.()}
          data-testid="terminal-reconnect"
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-medium shadow-lg backdrop-blur-sm hover:bg-red-700 transition-colors cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Reconnect</span>
        </button>
      )}
      {showScrollDown && !selectMode && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-800/80 text-white text-xs shadow-lg backdrop-blur-sm hover:bg-gray-800 transition-opacity cursor-pointer"
        >
          <ArrowDown size={14} />
          <span>Bottom</span>
        </button>
      )}
      {selectMode && (
        <div className="absolute inset-0 z-20 flex flex-col" style={{ background: '#eff1f5' }}>
          <pre
            ref={selectOverlayRef}
            style={{
              flex: 1, overflow: 'auto', margin: 0,
              padding: '4px 8px',
              fontSize: `${fontSize}px`,
              fontFamily,
              lineHeight: 1.2,
              color: '#4c4f69',
              background: '#eff1f5',
              whiteSpace: 'pre',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              wordBreak: 'break-all',
            }}
          >
            {selectText}
          </pre>
        </div>
      )}
    </div>
  );
}
