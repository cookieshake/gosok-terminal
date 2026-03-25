import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  wsUrl: string;
  fontSize?: number;
  onSendDataReady?: (fn: (data: string) => void) => void;
}

export default function TerminalPane({ wsUrl, fontSize = 14, onSendDataReady }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Update font size when prop changes (after initial mount)
  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;
    terminal.options.fontSize = fontSize;
    fitAddon.fit();
  }, [fontSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily: 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace',
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

    document.fonts.load('14px MonoplexNerd').then(() => {
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

    // Expose send function for MobileKeybar
    const encoder = new TextEncoder();
    const sendData = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    };
    onSendDataReady?.(sendData);

    // Prevent xterm from consuming key events during IME composition
    // (fixes Korean/CJK input where the last character gets dropped on Enter)
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.isComposing || event.keyCode === 229) {
        return false;
      }
      return true;
    });

    // Safari IME fix: xterm's onData fires during composition on Safari,
    // causing duplicate or dropped characters. Track composition state on
    // the underlying textarea and gate onData + send compositionend text manually.
    let imeComposing = false;
    const textarea = terminal.textarea;
    if (textarea) {
      textarea.addEventListener('compositionstart', () => {
        imeComposing = true;
      });
      textarea.addEventListener('compositionend', (e) => {
        imeComposing = false;
        const text = (e as CompositionEvent).data;
        if (text && ws.readyState === WebSocket.OPEN) {
          ws.send(encoder.encode(text));
        }
      });
    }

    terminal.onData((data) => {
      if (imeComposing) return;
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

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      ws.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] bg-[#fafafa]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    />
  );
}
