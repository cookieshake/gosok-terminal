import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { ArrowDown, Bug, RefreshCw } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useKeyboardModifier } from '../hooks/useKeyboardModifier';
import { useMobileKeyboard } from '../hooks/useMobileKeyboard';
import { useKoreanIME } from '../hooks/useKoreanIME';
import { useTerminalSocket } from '../hooks/useTerminalSocket';
import { DEFAULT_TERMINAL_THEME_ID, getTerminalTheme, getTerminalThemeMeta } from '../lib/terminalThemes';
import { downloadDebugBundle } from '../lib/debug';

type Modifier = 'ctrl' | 'alt' | 'shift' | null;

interface TerminalPaneProps {
  wsUrl: string;
  tabId?: string;
  fontSize?: number;
  fontFamily?: string;
  themeId?: string;
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
  tabId,
  fontSize = 14,
  fontFamily = DEFAULT_FONT_FAMILY,
  themeId = DEFAULT_TERMINAL_THEME_ID,
  visible,
  onSendDataReady,
  onTitleChange,
  onSelectModeReady,
  onPasteReady,
  activeModifier,
  onModifierUsed,
}: TerminalPaneProps) {
  const themeMeta = getTerminalThemeMeta(themeId);
  const themeBg = themeMeta.theme.background ?? '#eff1f5';
  const themeFg = themeMeta.theme.foreground ?? '#4c4f69';
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sendResizeRef = useRef<(() => void) | null>(null);
  const sendDataRef = useRef<((data: string) => boolean) | null>(null);
  const reconnectFnRef = useRef<(() => void) | null>(null);
  const selectOverlayRef = useRef<HTMLPreElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [connectionDead, setConnectionDead] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectText, setSelectText] = useState('');
  const [pasteMode, setPasteMode] = useState(false);
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    terminalRef.current?.scrollToBottom();
  }, []);

  const [debugBusy, setDebugBusy] = useState(false);
  const handleDownloadDebug = useCallback(async () => {
    if (!tabId || debugBusy) return;
    setDebugBusy(true);
    try {
      await downloadDebugBundle(tabId, terminalRef.current);
    } catch (err) {
      console.error('[terminal] debug bundle download failed', err);
    } finally {
      setDebugBusy(false);
    }
  }, [tabId, debugBusy]);

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
    if (!visible) return;
    const fitAddon = fitAddonRef.current;
    if (!fitAddon) return;
    fitAddon.fit();
    sendResizeRef.current?.();
  }, [visible]);

  const sendDataStable = useCallback((data: string) => {
    sendDataRef.current?.(data);
  }, []);

  const sendForIme = useCallback((data: string) => sendDataRef.current?.(data) ?? false, []);

  useKeyboardModifier({
    terminalRef,
    activeModifier,
    onModifierUsed,
    sendData: sendDataStable,
  });

  useMobileKeyboard({ containerRef, terminalRef });

  useKoreanIME({ containerRef, terminalRef, send: sendForIme });

  useTerminalSocket({
    wsUrl,
    terminalRef,
    fitAddonRef,
    setConnectionDead,
    reconnectFnRef,
    sendDataRef,
    sendResizeRef,
    onSendDataReady,
    ready: socketReady,
  });

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
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.theme = getTerminalTheme(themeId);
  }, [themeId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily,
      vtExtensions: { kittyKeyboard: true },
      theme: getTerminalTheme(themeId),
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

    terminal.onTitleChange((title) => onTitleChange?.(title));

    // Trailing debounce: a window-edge drag fires ResizeObserver per layout
    // tick, and inline TUIs (Ink / Claude Code) leak one frame into
    // scrollback per SIGWINCH because their redraw doesn't reflow at the
    // previous size's wrap points. Wait for the drag (or mobile keyboard
    // animation) to settle, then resize once.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const applyResize = () => {
      fitAddon.fit();
      sendResizeRef.current?.();
    };
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        applyResize();
      }, 80);
    });
    resizeObserver.observe(container);

    // Intentional: flips the gate that lets useTerminalSocket's effect run
    // after the Terminal instance is fully created. The hook bails out
    // early when ready=false, so this is the React-idiomatic way to sequence
    // "create xterm" then "open WS" without a second component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocketReady(true);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      setSocketReady(false);
    };
  }, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onSelectModeReady?.(toggleSelectMode);
  }, [toggleSelectMode, onSelectModeReady]);

  useEffect(() => {
    onPasteReady?.(handlePaste);
  }, [handlePaste, onPasteReady]);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: themeBg }}
      data-testid="terminal-pane"
    >
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
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--ctp-red)]/90 text-[var(--on-accent)] text-xs font-medium shadow-lg backdrop-blur-sm hover:bg-[var(--ctp-red)] transition-colors cursor-pointer"
        >
          <RefreshCw size={13} />
          <span>Reconnect</span>
        </button>
      )}
      {tabId && !selectMode && !pasteMode && (
        <button
          type="button"
          onClick={handleDownloadDebug}
          disabled={debugBusy}
          data-testid="terminal-debug"
          title="Download debug bundle"
          aria-label="Download debug bundle"
          className={`absolute z-10 flex items-center justify-center w-7 h-7 rounded-full bg-[var(--ctp-surface1)]/70 text-[var(--ctp-subtext0)] shadow backdrop-blur-sm hover:bg-[var(--ctp-surface2)] hover:text-[var(--ctp-text)] transition-colors cursor-pointer disabled:opacity-50 ${connectionDead ? 'top-3 right-32' : 'top-3 right-3'}`}
        >
          <Bug size={13} />
        </button>
      )}
      {showScrollDown && !selectMode && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[var(--ctp-surface2)]/80 text-[var(--ctp-text)] text-xs shadow-lg backdrop-blur-sm hover:bg-[var(--ctp-surface2)] transition-opacity cursor-pointer"
        >
          <ArrowDown size={14} />
          <span>Bottom</span>
        </button>
      )}
      {selectMode && (
        <div className="absolute inset-0 z-20 flex flex-col" style={{ background: themeBg }}>
          <pre
            ref={selectOverlayRef}
            style={{
              flex: 1, overflow: 'auto', margin: 0,
              padding: '4px 8px',
              fontSize: `${fontSize}px`,
              fontFamily,
              lineHeight: 1.2,
              color: themeFg,
              background: themeBg,
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
        <div className="absolute inset-0 z-20 flex flex-col" style={{ background: themeBg }}>
          <div
            className="flex items-center justify-between px-3 py-2 border-b text-xs"
            style={{ borderColor: themeFg + '33', color: themeFg }}
          >
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
              color: themeFg,
              background: themeBg,
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
