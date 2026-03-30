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
  visible?: boolean;
  onSendDataReady?: (fn: (data: string) => void) => void;
  onTitleChange?: (title: string) => void;
}

const DEFAULT_FONT_FAMILY = 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace';

export default function TerminalPane({ wsUrl, fontSize = 14, fontFamily = DEFAULT_FONT_FAMILY, visible, onSendDataReady, onTitleChange }: TerminalPaneProps) {
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

    // [0] 빈 조합 삭제 (Chrome/Firefox) — 위 표 참조
    // Chrome: keydown(Backspace, isComposing=true) → CompositionHelper가 즉시 조합 종료
    //   → 같은 keydown이 일반 backspace로 처리되어 이전 글자 삭제
    //   해결: capture 단계에서 조합 중 backspace의 전파를 차단.
    // Firefox: compositionend(data="") 후 isComposing=false인 keydown(Backspace)가 옴
    //   → compositionend가 먼저 발생하므로 isComposing 체크에 안 걸림
    //   해결: compositionend(data="") 직후의 backspace도 차단.
    if (terminal.textarea) {
      // Chrome/Firefox 모두 compositionend↔keydown 순서가 비결정적.
      // 타이밍 대신 플래그를 사용: compositionend(empty)에서 set, 다음 keydown(any)에서 clear.
      let pendingEmptyComp = false;
      let clearTimer: ReturnType<typeof setTimeout> | undefined;

      terminal.textarea.addEventListener('compositionend', (e) => {
        if (!(e as CompositionEvent).data) {
          terminal.textarea!.value = '';
          pendingEmptyComp = true;
          clearTimeout(clearTimer);
          // Fallback: 포커스 이탈 등으로 keydown 없이 끝나는 경우 대비
          clearTimer = setTimeout(() => { pendingEmptyComp = false; }, 200);
        }
      }, { capture: true });

      terminal.textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && (e.isComposing || pendingEmptyComp)) {
          e.stopImmediatePropagation();
        }
        // ANY keydown clears the flag — 다음 키 입력은 정상 처리
        pendingEmptyComp = false;
        clearTimeout(clearTimer);
      }, { capture: true });
    }

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

    // ── Korean IME workarounds ──
    //
    // xterm.js의 CompositionHelper는 브라우저별 IME 차이를 완벽히 처리하지 못함.
    // 아래 workaround들은 각 브라우저의 고유한 문제를 보정한다.
    //
    // ┌─────────────┬────────────────────────────────────────────────────────────┐
    // │ Workaround  │ 대상 브라우저 / 증상 / 원인                              │
    // ├─────────────┼────────────────────────────────────────────────────────────┤
    // │ [0] 빈 조합 │ Chrome: backspace로 조합 완전 삭제 시 이전 글자까지 삭제  │
    // │    삭제     │   → compositionend(data="") 후 backspace가 일반키로 처리  │
    // │             │ Firefox: 같은 상황에서 의문의 공백 1개 남음               │
    // │             │   → compositionend 후 textarea에 잔여값이 공백으로 해석   │
    // ├─────────────┼────────────────────────────────────────────────────────────┤
    // │ [1] Echo    │ Chrome, Firefox: 연속 한글 입력 시 글자가 겹쳐 보임       │
    // │    지연보정 │   → 제거됨: 예측 오차로 조합창이 앞으로 튀는 부작용       │
    // ├─────────────┼────────────────────────────────────────────────────────────┤
    // │ [2] 특수문자│ Firefox: 조합 중 특수문자(., !) 입력 시 유실              │
    // │    유실     │   → keydown 없이 input(insertText)만 발생하여 xterm 무시  │
    // ├─────────────┼────────────────────────────────────────────────────────────┤
    // │ [3] Safari  │ Safari: 한글 입력 전체가 작동하지 않음                    │
    // │    전체 IME │   → composition 이벤트 미발생, isComposing 항상 false     │
    // │             │   → insertText/insertReplacementText만으로 직접 처리      │
    // └─────────────┴────────────────────────────────────────────────────────────┘

    const textarea = terminal.textarea;
    const compositionView = container.querySelector<HTMLElement>('.composition-view');
    const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);

    // [1] Echo 지연 보정 — 제거됨 (48f5de6에서 도입)
    // compositionend마다 글자 폭만큼 composition-view를 translateX로 밀어
    // echo 도착 전 겹침을 방지했으나, 예측 오차로 조합창이 앞으로 튀는 부작용.
    // 로컬 RTT에서는 불필요하고, 원격에서도 겹침보다 튐이 더 혼란스러워 제거.

    // [2] 특수문자 유실 (Firefox) — 위 표 참조
    // compositionend 직후 insertText를 감지해서 직접 WebSocket으로 전송.
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

    // [3] Safari 전체 IME (Safari) — 위 표 참조
    // .xterm-helpers에서 input/keydown을 가로채 조합을 직접 관리하고 WebSocket으로 전송.
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

    const onTouchEnd = () => {
      // Tap (not scroll) → focus textarea to bring up mobile keyboard
      if (!isVerticalScroll && terminal.textarea) {
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
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
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
        className="w-full h-full bg-[#eff1f5]"
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
