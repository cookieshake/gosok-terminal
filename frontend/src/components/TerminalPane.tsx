import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { ArrowDown, RefreshCw } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  wsUrl: string;
  fontSize?: number;
  fontFamily?: string;
  onSendDataReady?: (fn: (data: string) => void) => void;
  onTitleChange?: (title: string) => void;
}

const DEFAULT_FONT_FAMILY = 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace';

export default function TerminalPane({ wsUrl, fontSize = 14, fontFamily = DEFAULT_FONT_FAMILY, onSendDataReady, onTitleChange }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sendResizeRef = useRef<(() => void) | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [connectionDead, setConnectionDead] = useState(false);
  const reconnectFnRef = useRef<(() => void) | null>(null);

  const scrollToBottom = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.scrollToBottom();
    }
  }, []);

  // Update font size/family when props change — also send resize to PTY
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
        background: '#fafafa',
        foreground: '#1f2937',
        cursor: '#374151',
        selectionBackground: '#bfdbfe',
        black: '#1f2937',
        red: '#dc2626',
        green: '#16a34a',
        yellow: '#d97706',
        blue: '#2563eb',
        magenta: '#7c3aed',
        cyan: '#0d9488',
        white: '#6b7280',
        brightBlack: '#4b5563',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#f59e0b',
        brightBlue: '#3b82f6',
        brightMagenta: '#8b5cf6',
        brightCyan: '#14b8a6',
        brightWhite: '#111827',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Let the browser handle Cmd+key (macOS) / Ctrl+key (others) shortcuts
    // so that Cmd+V paste, Cmd+C copy, etc. work natively.
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type === 'keydown' && (event.metaKey || event.ctrlKey)) {
        const key = event.key.toLowerCase();
        if (key === 'v' || key === 'a' || key === 'f') {
          return false; // let browser handle paste/select-all/find
        }
        // Ctrl+C / Cmd+C: only let browser handle copy when text is selected
        if (key === 'c' && terminal.hasSelection()) {
          return false;
        }
      }
      return true;
    });

    // WebGL renderer for better glyph/Nerd Font rendering
    const webglAddon = new WebglAddon();
    webglAddon.onContextLoss(() => webglAddon.dispose());
    terminal.loadAddon(webglAddon);

    // Track scroll position to show/hide "scroll to bottom" button
    const updateScrollState = () => {
      const buffer = terminal.buffer.active;
      const isAtBottom = buffer.viewportY >= buffer.baseY;
      setShowScrollDown(!isAtBottom);
    };
    terminal.onScroll(updateScrollState);
    terminal.onWriteParsed(updateScrollState);

    document.fonts.load(`${fontSize}px MonoplexNerd`).then(() => {
      fitAddon.fit();
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fullUrl = wsUrl.startsWith('ws')
      ? wsUrl
      : `${protocol}//${window.location.host}${wsUrl}`;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;
    let reconnectDelay = 1000;
    let serverOffset = 0; // cumulative byte offset from server
    let lastMessageAt = Date.now();
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
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
        // Send app-level ping so we get a pong back (JS can't see WS-level pong).
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
        const silent = Date.now() - lastMessageAt;
        // If no message for 45s and WS thinks it's open, connection is likely dead.
        if (silent > 45_000 && ws.readyState === WebSocket.OPEN) {
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
        // Send resize + last known offset so server sends only the delta.
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
              // Server tells us the current offset.
              // If offset jumped (full replay), reset terminal first.
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

    // Expose send function for MobileKeybar
    const sendData = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    };
    onSendDataReady?.(sendData);

    terminal.onTitleChange((title) => {
      onTitleChange?.(title);
    });

    // --- IME (Korean) input handling ---
    // xterm의 CompositionHelper가 조합/특수문자를 네이티브로 처리.
    // ghost + transform으로 조합 중 이전 글자 위치/가시성만 보정.
    const textarea = terminal.textarea;
    const compositionView = container.querySelector<HTMLElement>('.composition-view');

    let pendingOffsetPx = 0; // echo 미도착 글자들의 누적 오프셋
    const pendingWidths: number[] = []; // 개별 조합 글자의 폭 큐

    if (textarea && compositionView) {
      textarea.addEventListener('compositionend', (e) => {
        const text = (e as CompositionEvent).data || '';
        if (!text) return;

        const screen = container.querySelector<HTMLElement>('.xterm-screen');
        const cellWidth = screen ? screen.clientWidth / terminal.cols : 8;
        const charPx = [...text].length * 2 * cellWidth;

        // 이전 미도착분 + 현재 글자 폭을 누적
        pendingWidths.push(charPx);
        pendingOffsetPx += charPx;

        // 다음 조합 위치를 누적 오프셋만큼 밀어줌
        compositionView.style.transform = `translateX(${pendingOffsetPx}px)`;
        textarea.style.transform = `translateX(${pendingOffsetPx}px)`;

        // 이전 글자 잔상: echo 올 때까지 보여줌
        const ghost = compositionView.cloneNode(true) as HTMLElement;
        ghost.style.transform = '';
        compositionView.parentElement?.appendChild(ghost);
        const disp = terminal.onWriteParsed(() => { ghost.remove(); disp.dispose(); });
      }, { capture: true });
    }

    // Echo 도착 시 가장 오래된 pending 글자 폭만큼 오프셋 감소
    terminal.onWriteParsed(() => {
      if (pendingWidths.length > 0) {
        pendingOffsetPx -= pendingWidths.shift()!;
        if (pendingOffsetPx <= 0) pendingOffsetPx = 0;
        if (compositionView) compositionView.style.transform = pendingOffsetPx > 0 ? `translateX(${pendingOffsetPx}px)` : '';
        if (textarea) textarea.style.transform = pendingOffsetPx > 0 ? `translateX(${pendingOffsetPx}px)` : '';
      }
    });

    // Firefox: compositionend 직후 특수문자(., !, ? 등)를 누르면 별도 keydown 없이
    // input(insertText)로만 들어옴. xterm의 _inputEvent가 _keyDownSeen 체크로 이를
    // 무시하므로 문자가 유실됨. compositionend 직후 insertText를 감지해서 직접 전송.
    if (textarea) {
      let compositionJustEnded = false;
      let compositionEndTimer: ReturnType<typeof setTimeout> | undefined;
      textarea.addEventListener('compositionend', () => {
        compositionJustEnded = true;
        clearTimeout(compositionEndTimer);
        compositionEndTimer = setTimeout(() => { compositionJustEnded = false; }, 100);
      });
      textarea.addEventListener('input', (e) => {
        if (!compositionJustEnded) return;
        const ie = e as InputEvent;
        if (ie.inputType === 'insertText' && ie.data) {
          compositionJustEnded = false;
          clearTimeout(compositionEndTimer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(encoder.encode(ie.data));
          }
        }
      });
    }

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize();
    });
    resizeObserver.observe(container);

    // Handle virtual keyboard resize on mobile
    const onViewportResize = () => {
      fitAddon.fit();
      sendResize();
    };
    window.visualViewport?.addEventListener('resize', onViewportResize);

    // Touch scroll: translate vertical drag into terminal scroll
    let touchLastY = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let isVerticalScroll = false;
    let scrollAccum = 0;
    let isContentTouch = false;

    const onTouchStart = (e: TouchEvent) => {
      const rect = container.getBoundingClientRect();
      // Scrollbar is at the right edge (~20px) — let native handling take over
      if (e.touches[0].clientX > rect.right - 20) {
        isContentTouch = false;
        return;
      }
      isContentTouch = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchLastY = touchStartY;
      isVerticalScroll = false;
      scrollAccum = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isContentTouch) return;

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;

      if (!isVerticalScroll) {
        const dx = Math.abs(x - touchStartX);
        const dy = Math.abs(y - touchStartY);
        if (dx < 5 && dy < 5) return;
        isVerticalScroll = dy >= dx;
        if (!isVerticalScroll) return;
      }

      const deltaY = touchLastY - y;
      touchLastY = y;
      const lineHeight = (terminal.options.fontSize ?? 14) * (terminal.options.lineHeight ?? 1.2);
      scrollAccum += deltaY / lineHeight;
      const lines = Math.trunc(scrollAccum);
      if (lines !== 0) {
        terminal.scrollLines(lines);
        scrollAccum -= lines;
      }
      e.preventDefault();
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reconnectFnRef.current = null;
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      ws.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full bg-[#fafafa]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      />
      {connectionDead && (
        <button
          type="button"
          onClick={() => reconnectFnRef.current?.()}
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/90 text-white text-xs font-medium shadow-lg backdrop-blur-sm hover:bg-red-700 transition-colors cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Reconnect</span>
        </button>
      )}
      {showScrollDown && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gray-800/80 text-white text-xs shadow-lg backdrop-blur-sm hover:bg-gray-800 transition-opacity cursor-pointer"
        >
          <ArrowDown size={14} />
          <span>Bottom</span>
        </button>
      )}
    </div>
  );
}
