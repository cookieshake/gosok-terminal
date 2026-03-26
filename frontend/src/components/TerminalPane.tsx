import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
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

    // WebGL renderer for better glyph/Nerd Font rendering
    const webglAddon = new WebglAddon();
    webglAddon.onContextLoss(() => webglAddon.dispose());
    terminal.loadAddon(webglAddon);

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

    const connect = () => {
      ws = new WebSocket(fullUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          terminal.write(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'exit') {
              terminal.writeln(`\r\n[Process exited with code ${msg.code}]`);
            } else if (msg.type === 'error') {
              terminal.writeln(`\r\n[Error: ${msg.message}]`);
            }
          } catch { /* ignore */ }
        }
      };

      ws.onclose = () => {
        if (destroyed) return;
        terminal.writeln('\r\n[Connection lost. Reconnecting...]\r\n');
        reconnectTimer = setTimeout(connect, 3000);
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
    const encoder = new TextEncoder();
    const sendData = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    };
    onSendDataReady?.(sendData);

    terminal.onTitleChange((title) => {
      onTitleChange?.(title);
    });

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    let imeComposing = false;
    let pendingChar = '';   // single char (e.g. '.' '?') that triggered compositionend
    let skipNextOnData = false; // Safari: suppress xterm's duplicate onData after manual send

    // Block xterm from consuming IME events. Only block keyCode 229 (the virtual
    // "Process" key sent during composition) and multi-char keys during composition
    // (Enter, Backspace, etc.). Single printable chars like '.' and '?' are saved
    // to pendingChar so we can send them after compositionend — Chrome only fires
    // these once (with isComposing=true) so they'd be lost if fully blocked.
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.keyCode === 229) return false;
      if (event.isComposing) {
        if (event.type === 'keydown' && event.key.length === 1) {
          pendingChar = event.key;
        }
        return false;
      }
      return true;
    });

    const textarea = terminal.textarea;
    if (textarea) {
      textarea.addEventListener('compositionstart', () => {
        imeComposing = true;
        pendingChar = '';
      });

      // capture: true so our handler runs before xterm's compositionend handler.
      // This ensures imeComposing is false when xterm fires onData for the Korean char.
      textarea.addEventListener('compositionend', (e) => {
        imeComposing = false;

        if (isSafari) {
          const text = (e as CompositionEvent).data;
          if (text && ws.readyState === WebSocket.OPEN) {
            skipNextOnData = true;
            ws.send(encoder.encode(text));
          }
        }

        const char = pendingChar;
        pendingChar = '';
        if (char && ws.readyState === WebSocket.OPEN) {
          if (isSafari) {
            ws.send(encoder.encode(char));
          } else {
            // Defer so xterm's onData for the Korean char is sent first
            Promise.resolve().then(() => {
              if (ws.readyState === WebSocket.OPEN) ws.send(encoder.encode(char));
            });
          }
        }
      }, { capture: true });
    }

    terminal.onData((data) => {
      if (imeComposing) return;
      if (isSafari && skipNextOnData) { skipNextOnData = false; return; }
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
    <div
      ref={containerRef}
      className="w-full h-full bg-[#fafafa]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    />
  );
}
