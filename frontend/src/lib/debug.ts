import type { Terminal } from '@xterm/xterm';

interface ServerDebugResponse {
  generated_at: string;
  server: { go_version: string; goos: string; goarch: string };
  tab: Record<string, unknown> | null;
  status: Record<string, unknown>;
  session?: {
    cols: number;
    rows: number;
    cursor_x: number;
    cursor_y: number;
    cursor_visible: boolean;
    title: string;
    cwd: string;
    alt_screen: boolean;
    dec_modes: number[];
    ansi_modes: number[];
    bytes_written: number;
    last_activity?: string;
    scrollback_text: string;
    screen_text: string;
    raw_tail: string; // base64
    subscribers: number;
    exited: boolean;
    exit_code: number;
    sub_drop_flags?: boolean[];
  };
}

interface ClientState {
  cols: number;
  rows: number;
  bufferType: 'normal' | 'alternate';
  viewportY: number;
  cursorX: number;
  cursorY: number;
  scrollbackText: string;
  screenText: string;
  browser: {
    userAgent: string;
    language: string;
    platform: string;
    devicePixelRatio: number;
    viewport: { innerWidth: number; innerHeight: number };
    visualViewport: { width: number; height: number; scale: number; offsetTop: number } | null;
    online: boolean;
    visibilityState: string;
    pageUrl: string;
  };
}

function collectClient(terminal: Terminal): ClientState {
  const buf = terminal.buffer.active;
  const sbBase = buf.baseY; // scrollback lines above active screen
  const lines = (start: number, end: number) => {
    const out: string[] = [];
    for (let i = start; i < end; i++) {
      const line = buf.getLine(i);
      out.push(line ? line.translateToString(true).replace(/\s+$/, '') : '');
    }
    return out.join('\n');
  };
  const scrollback = lines(0, sbBase);
  const screen = lines(sbBase, sbBase + terminal.rows);

  const vv = window.visualViewport;
  return {
    cols: terminal.cols,
    rows: terminal.rows,
    bufferType: buf.type,
    viewportY: buf.viewportY,
    cursorX: buf.cursorX,
    cursorY: buf.cursorY,
    scrollbackText: scrollback,
    screenText: screen,
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
      visualViewport: vv
        ? { width: vv.width, height: vv.height, scale: vv.scale, offsetTop: vv.offsetTop }
        : null,
      online: navigator.onLine,
      visibilityState: document.visibilityState,
      pageUrl: window.location.href,
    },
  };
}

// Render a byte string with printable ASCII kept as-is and non-printables as
// \xNN escapes. ESC (0x1b) is shown as \e for readability; CR/LF/TAB pass
// through literally so multi-line sequences stay visually structured.
function escapeBytes(b64: string | null | undefined): string {
  if (!b64) return '';
  const bin = atob(b64);
  let out = '';
  for (let i = 0; i < bin.length; i++) {
    const c = bin.charCodeAt(i);
    if (c === 0x1b) out += '\\e';
    else if (c === 0x0a || c === 0x0d || c === 0x09) out += bin[i];
    else if (c === 0x60) out += '\\x60'; // backtick would break the enclosing ``` fence
    else if (c >= 0x20 && c < 0x7f) out += bin[i];
    else out += '\\x' + c.toString(16).padStart(2, '0');
  }
  return out;
}

function buildMarkdown(server: ServerDebugResponse, client: ClientState, tabId: string): string {
  const parts: string[] = [];
  parts.push(`# Gosok Debug Bundle`);
  parts.push('');
  parts.push(`Generated (client): ${new Date().toISOString()}`);
  parts.push(`Generated (server): ${server.generated_at}`);
  parts.push(`Tab ID: ${tabId}`);
  parts.push('');

  parts.push('## Server');
  parts.push('```json');
  parts.push(JSON.stringify(server.server, null, 2));
  parts.push('```');
  parts.push('');

  parts.push('## Tab + Status');
  parts.push('```json');
  parts.push(JSON.stringify({ tab: server.tab, status: server.status }, null, 2));
  parts.push('```');
  parts.push('');

  if (server.session) {
    const s = server.session;
    parts.push('## Server: PTY Session State');
    parts.push('```json');
    parts.push(JSON.stringify({
      cols: s.cols, rows: s.rows,
      cursor: { x: s.cursor_x, y: s.cursor_y, visible: s.cursor_visible },
      title: s.title, cwd: s.cwd,
      alt_screen: s.alt_screen,
      dec_modes: s.dec_modes, ansi_modes: s.ansi_modes,
      bytes_written: s.bytes_written,
      last_activity: s.last_activity,
      subscribers: s.subscribers,
      sub_drop_flags: s.sub_drop_flags,
      exited: s.exited, exit_code: s.exit_code,
    }, null, 2));
    parts.push('```');
    parts.push('');

    parts.push('## Server: Scrollback (plain text)');
    parts.push('```');
    parts.push(s.scrollback_text.replace(/`/g, '​`'));
    parts.push('```');
    parts.push('');

    parts.push('## Server: Active Screen (plain text)');
    parts.push('```');
    parts.push(s.screen_text.replace(/`/g, '​`'));
    parts.push('```');
    parts.push('');

    parts.push('## Server: Raw PTY Tail (last 64KB, ESC=\\e, non-printable=\\xNN)');
    parts.push('```');
    parts.push(escapeBytes(s.raw_tail));
    parts.push('```');
    parts.push('');
  } else {
    parts.push('## Server: PTY Session State');
    parts.push('_no live session (tab not running)_');
    parts.push('');
  }

  parts.push('## Client: Browser & Viewport');
  parts.push('```json');
  parts.push(JSON.stringify(client.browser, null, 2));
  parts.push('```');
  parts.push('');

  parts.push('## Client: xterm State');
  parts.push('```json');
  parts.push(JSON.stringify({
    cols: client.cols, rows: client.rows,
    bufferType: client.bufferType, viewportY: client.viewportY,
    cursor: { x: client.cursorX, y: client.cursorY },
  }, null, 2));
  parts.push('```');
  parts.push('');

  parts.push('## Client: xterm Scrollback (plain text)');
  parts.push('```');
  parts.push(client.scrollbackText.replace(/`/g, '​`'));
  parts.push('```');
  parts.push('');

  parts.push('## Client: xterm Active Screen (plain text)');
  parts.push('```');
  parts.push(client.screenText.replace(/`/g, '​`'));
  parts.push('```');
  parts.push('');

  return parts.join('\n');
}

export async function downloadDebugBundle(tabId: string, terminal: Terminal | null): Promise<void> {
  const res = await fetch(`/api/v1/tabs/${tabId}/debug`);
  if (!res.ok) throw new Error(`debug fetch failed: ${res.status}`);
  const server: ServerDebugResponse = await res.json();
  const client: ClientState = terminal
    ? collectClient(terminal)
    : {
        cols: 0, rows: 0, bufferType: 'normal', viewportY: 0, cursorX: 0, cursorY: 0,
        scrollbackText: '', screenText: '',
        browser: {
          userAgent: navigator.userAgent, language: navigator.language,
          platform: navigator.platform, devicePixelRatio: window.devicePixelRatio,
          viewport: { innerWidth: window.innerWidth, innerHeight: window.innerHeight },
          visualViewport: null, online: navigator.onLine,
          visibilityState: document.visibilityState, pageUrl: window.location.href,
        },
      };

  const md = buildMarkdown(server, client, tabId);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `gosok-debug-${tabId}-${ts}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
