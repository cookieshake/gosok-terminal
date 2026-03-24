import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';

interface TerminalPaneProps {
  wsUrl: string;
}

export default function TerminalPane({ wsUrl }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
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

    const ws = new WebSocket(fullUrl);
    ws.binaryType = 'arraybuffer';

    const sendResize = () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
      }
    };

    ws.onopen = () => sendResize();

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

    ws.onclose = () => terminal.writeln('\r\n[Connection closed]');

    const encoder = new TextEncoder();
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

    return () => {
      resizeObserver.disconnect();
      ws.close();
      terminal.dispose();
    };
  }, [wsUrl]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] bg-[#fafafa]" />
  );
}
