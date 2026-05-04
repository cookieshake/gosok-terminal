import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from 'react';
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
  onPasteReady?: (fn: () => void) => void;
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
  onPasteReady,
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
  const [pasteMode, setPasteMode] = useState(false);
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom();
  }, []);

  // Clipboard API only works in secure contexts (HTTPS/localhost). On plain-
  // http LAN URLs navigator.clipboard is undefined; we then fall back to a
  // focused textarea overlay where the user does the OS native paste gesture.
  const handlePaste = useCallback(async () => {
    if (navigator.clipboard?.readText) {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          sendDataRef.current?.(text);
          return;
        }
      } catch (err) {
        console.warn('[terminal] clipboard.readText failed, falling back', err);
      }
    }
    setPasteMode(true);
    requestAnimationFrame(() => pasteTextareaRef.current?.focus());
  }, []);

  const handlePasteEvent = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    e.preventDefault();
    setPasteMode(false);
    if (text) sendDataRef.current?.(text);
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

    // Delegate clipboard/find shortcuts to the browser. macOS uses Cmd (so
    // Ctrl+C still sends SIGINT); Linux/Windows follow the common terminal
    // convention of Ctrl+Shift+C / Ctrl+Shift+V.
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;
      const key = event.key.toLowerCase();
      if (event.metaKey && !event.ctrlKey && (key === 'c' || key === 'v' || key === 'a' || key === 'f')) {
        return false;
      }
      if (event.ctrlKey && event.shiftKey && (key === 'c' || key === 'v')) {
        return false;
      }
      return true;
    });

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

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;
    let reconnectDelay = 1000;
    let lastMessageAt = Date.now();
    const encoder = new TextEncoder();

    const forceReconnect = () => {
      if (destroyed) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reconnectDelay = 1000;
      // Detach handlers before close so the stale socket's onclose cannot
      // schedule a parallel reconnect that races with connect() below.
      // Guarded because foreground listeners could in principle fire before
      // the initial connect() assigns ws (today unreachable, but cheap).
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        // close() only throws on invalid code/reason, neither of which we pass.
        try { ws.close(); } catch { /* unreachable */ }
      }
      connect();
    };
    reconnectFnRef.current = forceReconnect;

    // Mobile OS often suspends TCP while the tab is backgrounded; the socket
    // can come back as a zombie (readyState OPEN but no traffic) or surface a
    // close only after a long delay. On foreground/online, drop whatever we
    // have and reconnect immediately instead of riding out the backoff.
    const onForeground = () => {
      if (document.visibilityState === 'visible') forceReconnect();
    };
    // Only bfcache restores — normal loads already connect via the initial
    // connect() call, and the visible case is covered by visibilitychange.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) forceReconnect();
    };
    const onOnline = () => forceReconnect();
    document.addEventListener('visibilitychange', onForeground);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    const startHeartbeat = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      lastMessageAt = Date.now();
      heartbeatTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
        if (Date.now() - lastMessageAt > 45_000 && ws?.readyState === WebSocket.OPEN) {
          setConnectionDead(true);
        }
      }, 15_000);
    };

    // Track last-sent PTY dimensions so we can skip redundant resize messages
    // and detect actual size changes. On alt screen (TUI apps like Claude
    // Code, vim, htop) we also need to force-clear before notifying the
    // server: xterm.js does not reflow the alt buffer on resize, so leftover
    // characters from the old size remain on screen and overlap with the
    // app's redraw after SIGWINCH. Writing CSI 2J + CSI H locally gives the
    // redraw a clean canvas. Declared above connect() so onopen can update
    // them after its initial resize.
    let lastSentCols = 0;
    let lastSentRows = 0;

    const connect = () => {
      let sock: WebSocket;
      try {
        sock = new WebSocket(fullUrl);
      } catch (err) {
        // Constructor throws synchronously on malformed URL, CSP violation,
        // or mixed-content block. Surface the dead state and schedule a retry
        // so we don't land in a permanently-silent UI.
        console.error('[terminal] WebSocket construction failed', err);
        setConnectionDead(true);
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        return;
      }
      ws = sock;
      sock.binaryType = 'arraybuffer';

      // Set when a "snapshot" control message arrives; the next binary message
      // is the snapshot payload and must be applied after a terminal.reset().
      let pendingSnapshotOffset: number | null = null;

      sock.onopen = () => {
        reconnectDelay = 1000;
        setConnectionDead(false);
        startHeartbeat();
        // Fit synchronously before sending hello so the server-side emulator
        // (and the snapshot it generates immediately after) uses the actual
        // post-layout dimensions, not the default 80x24. Without this, a
        // race between WS open and the async font-load → fit chain produces
        // a snapshot at default size that briefly mis-positions a row before
        // a follow-up resize triggers TUI redraw.
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
          if (pendingSnapshotOffset !== null) {
            terminal.reset();
            terminal.write(new Uint8Array(event.data));
            pendingSnapshotOffset = null;
          } else {
            terminal.write(new Uint8Array(event.data));
          }
        } else if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'snapshot') {
              pendingSnapshotOffset = msg.offset ?? 0;
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
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
      };
    };
    connect();

    const sendResize = (cols?: number, rows?: number) => {
      const c = cols ?? terminal.cols;
      const r = rows ?? terminal.rows;
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

    const sendData = (data: string) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(encoder.encode(data));
    };
    sendDataRef.current = sendData;
    onSendDataReady?.(sendData);

    terminal.onTitleChange((title) => onTitleChange?.(title));

    terminal.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    // ── Safari Korean IME shim ──
    // Safari (desktop + iOS) does not fire compositionstart/compositionend for
    // Korean IME the way Chrome/Firefox do, so xterm.js's built-in composition
    // handling never engages and partially-composed jamo leak straight to the
    // PTY. Intercept `input` events on the helper textarea: stream completed
    // syllables to the WS as they finalize, and render the in-progress jamo in
    // xterm's .composition-view overlay positioned at the cursor cell.
    const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
    if (isSafari && terminal.textarea) {
      const ta = terminal.textarea;
      const helpers = ta.parentElement;
      const compView = container.querySelector<HTMLElement>('.composition-view');
      let imeActive = false;
      let preImeValue = '';
      let pendingSent = 0;

      const isKorean = (s: string | null) =>
        s != null && /[ᄀ-ᇿㄱ-ㆎꥠ-꥿가-힯ힰ-퟿]/.test(s);
      const isModifierKey = (kc: number) =>
        kc === 16 || kc === 17 || kc === 18 || kc === 20 || kc === 91 || kc === 93;

      // Reposition the composition overlay after each terminal write so it
      // tracks the cursor as completed jamo flush through the PTY.
      terminal.onWriteParsed(() => {
        if (imeActive && pendingSent > 0) {
          pendingSent = 0;
          if (compView?.textContent) showComp(compView.textContent);
        }
      });

      const showComp = (text: string) => {
        if (!compView) return;
        compView.textContent = text;
        compView.classList.add('active');
        const screen = container.querySelector<HTMLElement>('.xterm-screen');
        if (screen) {
          const cellW = screen.clientWidth / terminal.cols;
          const cellH = screen.clientHeight / terminal.rows;
          const buf = terminal.buffer.active;
          compView.style.left = `${(buf.cursorX + pendingSent * 2) * cellW}px`;
          compView.style.top = `${buf.cursorY * cellH}px`;
          compView.style.height = `${cellH}px`;
          compView.style.lineHeight = `${cellH}px`;
          compView.style.fontSize = `${terminal.options.fontSize}px`;
        }
      };
      const hideComp = () => {
        if (!compView) return;
        compView.textContent = '';
        compView.classList.remove('active');
      };
      const flushCompleted = () => {
        const full = ta.value.slice(preImeValue.length);
        const completed = full.slice(0, -1);
        if (completed && ws?.readyState === WebSocket.OPEN) {
          ws.send(encoder.encode(completed));
          pendingSent += [...completed].length;
          preImeValue += completed;
        }
      };
      const flushIme = () => {
        if (!imeActive) return;
        imeActive = false;
        hideComp();
        const composed = ta.value.slice(preImeValue.length);
        if (composed && ws?.readyState === WebSocket.OPEN) {
          ws.send(encoder.encode(composed));
        }
        ta.value = '';
        preImeValue = '';
        pendingSent = 0;
      };

      const onImeInput = (e: Event) => {
        const ie = e as InputEvent;
        if (ie.inputType === 'insertText' && isKorean(ie.data)) {
          if (!imeActive) {
            imeActive = true;
            preImeValue = ta.value.slice(0, ta.value.length - (ie.data?.length ?? 0));
            pendingSent = 0;
          } else {
            flushCompleted();
          }
          showComp(ie.data ?? '');
          e.stopPropagation();
        } else if (ie.inputType === 'insertReplacementText' && imeActive) {
          showComp(ie.data ?? '');
          e.stopPropagation();
        } else if (imeActive) {
          flushIme();
        }
      };
      const onImeKeydown = (e: KeyboardEvent) => {
        if (imeActive && (e.keyCode === 229 || isModifierKey(e.keyCode))) {
          e.stopPropagation();
        } else if (imeActive) {
          flushIme();
        }
      };

      helpers?.addEventListener('input', onImeInput, true);
      helpers?.addEventListener('keydown', onImeKeydown, true);
    }

    // Asymmetric resize: grow as usual, but on shrink keep xterm oversized
    // and only tell the PTY the smaller size. Shrinking xterm pushes viewport
    // rows into its client-side scrollback; a diff-rendering TUI (Ink /
    // Claude Code) can't reach far enough with \e[J on SIGWINCH to erase
    // them, leaving duplicate content in scrollback after a keyboard cycle.
    // The container's overflow:hidden clips the oversized xterm; scrollTop
    // aligns the bottom of xterm (where the cursor / prompt is) with the
    // bottom of the visible area.
    const alignToBottom = () => {
      const xtermEl = container.querySelector<HTMLElement>('.xterm');
      const clip = container.parentElement;
      if (!xtermEl || !clip) return;
      const excess = xtermEl.offsetHeight - clip.clientHeight;
      clip.scrollTop = excess > 0 ? excess : 0;
    };
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const proposed = fitAddon.proposeDimensions();
        if (!proposed || !proposed.rows || !proposed.cols) return;
        if (proposed.rows < terminal.rows) {
          sendResize(proposed.cols, proposed.rows);
        } else {
          fitAddon.fit();
          sendResize();
        }
        alignToBottom();
      });
    });
    resizeObserver.observe(container);

    // iOS Safari requires focus() to happen inside a user-gesture handler to
    // pop the virtual keyboard. Blur on touchstart so a subsequent scroll
    // gesture can't re-open the keyboard via the still-focused textarea
    // (which iOS does after the user manually dismisses the keyboard);
    // re-focus on touchend only if the finger barely moved (a tap).
    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      terminal.textarea?.blur();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (Math.abs(t.clientX - touchStartX) < 5 && Math.abs(t.clientY - touchStartY) < 5) {
        terminal.textarea?.focus();
      }
    };
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reconnectFnRef.current = null;
      document.removeEventListener('visibilitychange', onForeground);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      resizeObserver.disconnect();
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      ws?.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onSelectModeReady?.(toggleSelectMode);
  }, [toggleSelectMode, onSelectModeReady]);

  useEffect(() => {
    onPasteReady?.(handlePaste);
  }, [handlePaste, onPasteReady]);

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
      {pasteMode && (
        <div className="absolute inset-0 z-20 flex flex-col" style={{ background: '#eff1f5' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#bcc0cc] text-[#5c5f77] text-xs">
            <span>Long-press the area below and tap "Paste".</span>
            <button
              type="button"
              onClick={() => setPasteMode(false)}
              className="px-2 py-0.5 text-xs cursor-pointer hover:underline"
            >
              Cancel
            </button>
          </div>
          <textarea
            ref={pasteTextareaRef}
            autoFocus
            onPaste={handlePasteEvent}
            placeholder="Paste here"
            style={{
              flex: 1, margin: 0,
              padding: '8px',
              fontSize: `${fontSize}px`,
              fontFamily,
              lineHeight: 1.2,
              color: '#4c4f69',
              background: '#eff1f5',
              border: 'none',
              outline: 'none',
              resize: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}
