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

export default function TerminalPane({ wsUrl, fontSize = 14, fontFamily = DEFAULT_FONT_FAMILY, visible, onSendDataReady, onTitleChange, onSelectModeReady, activeModifier, onModifierUsed }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sendResizeRef = useRef<(() => void) | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [connectionDead, setConnectionDead] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectText, setSelectText] = useState('');
  const selectOverlayRef = useRef<HTMLPreElement>(null);
  const reconnectFnRef = useRef<(() => void) | null>(null);
  const sendDataRef = useRef<((data: string) => void) | null>(null);

  const scrollToBottom = useCallback(() => {
    const terminal = terminalRef.current;
    if (terminal) {
      terminal.scrollToBottom();
    }
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
    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    setSelectText(lines.join('\n'));
    setSelectMode(true);
    // Scroll overlay to match terminal viewport position
    requestAnimationFrame(() => {
      const el = selectOverlayRef.current;
      if (!el) return;
      const lineHeight = fontSize * 1.2;
      el.scrollTop = buf.viewportY * lineHeight;
    });
  }, [fontSize, selectMode]);

  // Intercept keyboard input when Ctrl/Alt modifier is active
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

      let data: string;
      if (activeModifier === 'ctrl') {
        data = String.fromCharCode(key.charCodeAt(0) - 96); // a=1, b=2, ..., z=26
      } else {
        data = '\x1b' + key; // Alt = ESC prefix
      }

      sendDataRef.current?.(data);
      onModifierUsed?.();
    };

    textarea.addEventListener('keydown', handler, { capture: true });
    return () => textarea.removeEventListener('keydown', handler, { capture: true });
  }, [activeModifier, onModifierUsed]);

  // Re-fit when tab becomes visible (opacity 0→1 doesn't trigger ResizeObserver)
  useEffect(() => {
    if (!visible) return;
    const fitAddon = fitAddonRef.current;
    if (!fitAddon) return;
    fitAddon.fit();
    sendResizeRef.current?.();
  }, [visible]);


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

    const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.platform);

    // Flag shared with IME workaround below — must be declared before attachCustomKeyEventHandler.
    let compositionJustEndedForBackspace = false;

    terminal.attachCustomKeyEventHandler((event) => {
      // Block ghost backspace that Chrome fires after cancelling Korean composition.
      // compositionend fires first (sets flag), then keydown(Backspace) follows in the same tick.
      // Using attachCustomKeyEventHandler (not a DOM listener) ensures xterm never sees the event.
      if (compositionJustEndedForBackspace && event.type === 'keydown' && event.key === 'Backspace') {
        compositionJustEndedForBackspace = false;
        return false;
      }

      if (event.type === 'keydown' && (event.metaKey || event.ctrlKey)) {
        const key = event.key.toLowerCase();
        // macOS: Cmd+A/V/F → browser (select-all / paste / find). Ctrl+* goes to terminal.
        if (event.metaKey && !event.ctrlKey && (key === 'a' || key === 'v' || key === 'f')) {
          return false;
        }
        // Windows/Linux: Ctrl+V (paste) and Ctrl+F (find) → browser; Ctrl+A → terminal (readline).
        if (!isMac && event.ctrlKey && !event.metaKey && (key === 'v' || key === 'f')) {
          return false;
        }
        // Ctrl+C / Cmd+C: only let browser handle copy when text is selected
        if (key === 'c' && terminal.hasSelection()) {
          return false;
        }
      }
      return true;
    });

    // WebGL renderer for better glyph/Nerd Font rendering (fallback to canvas if unsupported)
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => webglAddon.dispose());
      terminal.loadAddon(webglAddon);
    } catch {
      // WebGL2 unavailable — xterm falls back to canvas renderer automatically
    }

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
    let pendingReplayBytes = 0; // bytes of replay following a sync; skipped from serverOffset accounting
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
        // Setting the UI flag is not enough — half-open sockets never fire `onclose`
        // on their own. Close the socket so the reconnect path actually runs.
        if (silent > 45_000 && ws.readyState === WebSocket.OPEN) {
          setConnectionDead(true);
          try { ws.close(); } catch { /* ignore */ }
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
          const bytes = event.data.byteLength;
          if (pendingReplayBytes > 0) {
            // Replay data following a sync. Server already set the final offset via sync,
            // so don't double-count.
            const consumed = Math.min(pendingReplayBytes, bytes);
            pendingReplayBytes -= consumed;
            serverOffset += bytes - consumed; // count only the live portion (if any)
          } else {
            serverOffset += bytes;
          }
          terminal.write(new Uint8Array(event.data));
        } else if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'sync') {
              // Server tells us the authoritative current offset, how many replay
              // bytes follow, and whether this is a full replay (client must reset)
              // or an incremental delta (client must append without resetting).
              pendingReplayBytes = (msg.replaySize as number | undefined) ?? 0;
              serverOffset = msg.offset;
              if (msg.fullReplay) {
                // Inject clear-screen + home-cursor + clear-scrollback into
                // xterm's write queue. Using inline ANSI guarantees strict
                // ordering vs. both prior stale writes and subsequent live
                // writes — no callback-based race. Previously queued bytes
                // flush, the clear wipes them, the replay lands on a clean
                // canvas, and any live data arriving afterwards queues behind
                // the replay as expected.
                terminal.write('\x1b[H\x1b[2J\x1b[3J');
              }
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
    sendDataRef.current = sendData;
    onSendDataReady?.(sendData);

    terminal.onTitleChange((title) => {
      onTitleChange?.(title);
    });

    // ── Korean IME workarounds ──

    const textarea = terminal.textarea;
    const compositionView = container.querySelector<HTMLElement>('.composition-view');
    const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);

    // [0] Ghost backspace after composition cancel (Chrome/Firefox)
    // When backspace cancels a Korean composition, Chrome fires:
    //   compositionend(data="ㅎ") → keydown(Backspace, keyCode=8) in the same tick.
    // xterm.js sends the jamo to PTY, then the ghost backspace sends \x7f,
    // which in raw-mode apps (e.g. Claude Code) deletes the previous character.
    // Fix: set flag on compositionend; attachCustomKeyEventHandler (above) intercepts
    // the ghost backspace before xterm.js ever sees it.
    if (textarea) {
      textarea.addEventListener('compositionend', () => {
        compositionJustEndedForBackspace = true;
        setTimeout(() => { compositionJustEndedForBackspace = false; }, 0);
      }, { capture: true });
    }

    // [2] Special character loss (Firefox)
    // Detect insertText immediately after compositionend and send directly via WebSocket.
    const isFirefox = /Firefox/i.test(navigator.userAgent);
    if (isFirefox && textarea) {
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

    // [3] Safari full IME
    // Safari does not fire composition events, so intercept input/keydown to handle directly.
    if (isSafari && textarea) {
      const ta = textarea;
      const helpers = ta.parentElement!;
      const compView = compositionView;
      let imeActive = false;
      let preImeValue = '';
      let pendingSent = 0;

      const isKorean = (s: string | null) =>
        s != null && /[\u1100-\u11FF\u3131-\u318E\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF]/.test(s);
      const isModifier = (kc: number) =>
        kc === 16 || kc === 17 || kc === 18 || kc === 20 || kc === 91 || kc === 93;

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
        if (completed && ws.readyState === WebSocket.OPEN) {
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
        if (composed && ws.readyState === WebSocket.OPEN) {
          ws.send(encoder.encode(composed));
        }
        ta.value = '';
        preImeValue = '';
        pendingSent = 0;
      };

      helpers.addEventListener('input', (e) => {
        const ie = e as InputEvent;
        if (ie.inputType === 'insertText' && isKorean(ie.data)) {
          if (!imeActive) {
            imeActive = true;
            preImeValue = ta.value.slice(0, ta.value.length - ie.data!.length);
            pendingSent = 0;
          } else {
            flushCompleted();
          }
          showComp(ie.data!);
          e.stopPropagation();
        } else if (ie.inputType === 'insertReplacementText' && imeActive) {
          showComp(ie.data ?? '');
          e.stopPropagation();
        } else if (imeActive) {
          flushIme();
        }
      }, true);

      helpers.addEventListener('keydown', (e) => {
        if (imeActive && (e.keyCode === 229 || isModifier(e.keyCode))) {
          e.stopPropagation();
        } else if (imeActive) {
          flushIme();
        }
      }, true);
    }

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoder.encode(data));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      // Delay fit until after layout completes (needed when parent transitions from display:none)
      requestAnimationFrame(() => {
        fitAddon.fit();
        sendResize();
      });
    });
    resizeObserver.observe(container);

    // Handle virtual keyboard resize on mobile
    const onViewportResize = () => {
      fitAddon.fit();
      sendResize();
      // When virtual keyboard closes, browser may leave the page scrolled up
      window.scrollTo(0, 0);
    };
    window.visualViewport?.addEventListener('resize', onViewportResize);

    // Re-render when returning from background (mobile browsers may discard GPU textures).
    // Also force a reconnect: after a long background, the OS may have killed the TCP
    // connection silently (half-open WS). Without this, the user sees "[Connection lost.
    // Reconnecting…]" and has to wait out the exponential backoff — or forever, if the
    // socket's onclose never fires.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      requestAnimationFrame(() => fitAddon.fit());
      const stale = Date.now() - lastMessageAt > 45_000;
      if (ws.readyState !== WebSocket.OPEN || stale) {
        reconnectDelay = 1000;
        forceReconnect();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Touch scroll: translate vertical drag into terminal scroll
    let touchLastY = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let isVerticalScroll = false;
    let touchMoved = false; // true if finger moved >5px in any direction (distinguishes tap from scroll)
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
      touchMoved = false;
      scrollAccum = 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isContentTouch) return;

      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const dx = Math.abs(x - touchStartX);
      const dy = Math.abs(y - touchStartY);

      // Mark as a gesture (not a tap) once the finger has moved past the noise threshold.
      if (!touchMoved && (dx > 5 || dy > 5)) touchMoved = true;

      if (!isVerticalScroll) {
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

    const onTouchEnd = () => {
      // Only focus (show keyboard) for a tap — not when the user scrolled or swiped.
      if (!touchMoved && terminal.textarea) {
        terminal.textarea.focus();
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      reconnectFnRef.current = null;
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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
              fontFamily: fontFamily,
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
