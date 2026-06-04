import type { Terminal } from '@xterm/xterm';

interface ServerSession {
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
}

interface ServerDebugResponse {
  generated_at: string;
  server: { go_version: string; goos: string; goarch: string };
  tab: Record<string, unknown>;
  status: Record<string, unknown>;
  session?: ServerSession;
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
  const sbBase = buf.baseY;
  const lines = (start: number, end: number) => {
    const out: string[] = [];
    for (let i = start; i < end; i++) {
      const line = buf.getLine(i);
      out.push(line ? line.translateToString(true).replace(/\s+$/, '') : '');
    }
    return out.join('\n');
  };
  const vv = window.visualViewport;
  return {
    cols: terminal.cols,
    rows: terminal.rows,
    bufferType: buf.type,
    viewportY: buf.viewportY,
    cursorX: buf.cursorX,
    cursorY: buf.cursorY,
    scrollbackText: lines(0, sbBase),
    screenText: lines(sbBase, sbBase + terminal.rows),
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

// Bytes outside printable ASCII become \xNN; ESC is shown as \e; backslash is
// doubled so the encoding is lossless; backtick is escaped so it can't break
// the enclosing fence. CR/LF/TAB pass through to keep multi-line shape.
function escapeBytes(b64: string): string {
  const bin = atob(b64);
  let out = '';
  for (let i = 0; i < bin.length; i++) {
    const c = bin.charCodeAt(i);
    if (c === 0x1b) out += '\\e';
    else if (c === 0x5c) out += '\\\\';
    else if (c === 0x0a || c === 0x0d || c === 0x09) out += bin[i];
    else if (c === 0x60) out += '\\x60';
    else if (c >= 0x20 && c < 0x7f) out += bin[i];
    else out += '\\x' + c.toString(16).padStart(2, '0');
  }
  return out;
}

const fenceSafe = (s: string) => s.replace(/`/g, '\u200b`');
const jsonBlock = (h: string, v: unknown) => `## ${h}\n\`\`\`json\n${JSON.stringify(v, null, 2)}\n\`\`\``;
const textBlock = (h: string, v: string) => `## ${h}\n\`\`\`\n${fenceSafe(v)}\n\`\`\``;

function buildMarkdown(server: ServerDebugResponse, client: ClientState, tabId: string): string {
  const sections: string[] = [
    `# Gosok Debug Bundle`,
    ``,
    `Generated (client): ${new Date().toISOString()}`,
    `Generated (server): ${server.generated_at}`,
    `Tab ID: ${tabId}`,
    ``,
    jsonBlock('Server', server.server),
    jsonBlock('Tab + Status', { tab: server.tab, status: server.status }),
  ];

  const s = server.session;
  if (s) {
    sections.push(jsonBlock('Server: PTY Session State', {
      cols: s.cols, rows: s.rows,
      cursor: { x: s.cursor_x, y: s.cursor_y, visible: s.cursor_visible },
      title: s.title, cwd: s.cwd,
      alt_screen: s.alt_screen,
      dec_modes: s.dec_modes, ansi_modes: s.ansi_modes,
      bytes_written: s.bytes_written,
      last_activity: s.last_activity,
      subscribers: s.subscribers,
      exited: s.exited, exit_code: s.exit_code,
    }));
    sections.push(textBlock('Server: Scrollback (plain text)', s.scrollback_text));
    sections.push(textBlock('Server: Active Screen (plain text)', s.screen_text));
    sections.push(`## Server: Raw PTY Tail (last 64KB, ESC=\\e, non-printable=\\xNN)\n\`\`\`\n${escapeBytes(s.raw_tail)}\n\`\`\``);
  } else {
    sections.push(`## Server: PTY Session State\n_no live session (tab not running)_`);
  }

  sections.push(jsonBlock('Client: Browser & Viewport', client.browser));
  sections.push(jsonBlock('Client: xterm State', {
    cols: client.cols, rows: client.rows,
    bufferType: client.bufferType, viewportY: client.viewportY,
    cursor: { x: client.cursorX, y: client.cursorY },
  }));
  sections.push(textBlock('Client: xterm Scrollback (plain text)', client.scrollbackText));
  sections.push(textBlock('Client: xterm Active Screen (plain text)', client.screenText));

  return sections.join('\n\n') + '\n';
}

export async function downloadDebugBundle(tabId: string, terminal: Terminal): Promise<void> {
  const res = await fetch(`/api/v1/tabs/${tabId}/debug`);
  if (!res.ok) throw new Error(`debug fetch failed: ${res.status}`);
  const server: ServerDebugResponse = await res.json();
  const md = buildMarkdown(server, collectClient(terminal), tabId);

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
