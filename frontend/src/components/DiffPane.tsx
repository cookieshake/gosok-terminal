import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';
import * as api from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import type { CommitEntry } from '../api/client';

interface DiffPaneProps {
  projectId: string;
  fontSize?: number;
  fontFamily?: string;
  filePanelWidth: number;
  onFilePanelWidthChange: (width: number) => void;
}

type Mode = 'unstaged' | 'staged' | 'commits';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  M: { label: 'M', color: 'var(--ctp-peach)' },
  A: { label: 'A', color: 'var(--ctp-green)' },
  D: { label: 'D', color: 'var(--ctp-red)' },
  R: { label: 'R', color: 'var(--ctp-blue)' },
};

function getLang(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', go: 'go', rs: 'rust', rb: 'ruby', java: 'java',
    html: 'html', css: 'css', json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', sh: 'shell', sql: 'sql', tf: 'hcl',
  };
  return map[ext] ?? 'plaintext';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function DiffPane({ projectId, fontSize = 13, fontFamily = 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace', filePanelWidth, onFilePanelWidthChange }: DiffPaneProps) {
  const { resolvedUiTheme } = useTheme();
  const monacoTheme = resolvedUiTheme === 'dark' ? 'vs-dark' : 'vs';
  const [mode, setMode] = useState<Mode>('unstaged');
  const [files, setFiles] = useState<{ path: string; status: string }[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<{ original: string; modified: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const isResizing = useRef(false);
  const refreshSeq = useRef(0);
  const diffSeq = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = filePanelWidth;
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      onFilePanelWidthChange(Math.min(480, Math.max(120, startWidth + ev.clientX - startX)));
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [filePanelWidth, onFilePanelWidthChange]);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    setLoading(true);
    try {
      if (mode === 'commits') {
        const list = await api.listCommits(projectId, 100);
        if (seq !== refreshSeq.current) return;
        setCommits(list);
        setSelectedSha(list[0]?.sha ?? null);
      } else {
        const list = await api.listDiffFiles(projectId, mode === 'staged');
        if (seq !== refreshSeq.current) return;
        setFiles(list);
        setSelectedPath(list[0]?.path ?? null);
      }
    } finally {
      if (seq === refreshSeq.current) setLoading(false);
    }
  }, [projectId, mode]);

  useEffect(() => { refresh(); }, [refresh]);

  // Load files for the selected commit
  useEffect(() => {
    if (mode !== 'commits' || !selectedSha) {
      if (mode === 'commits') { setFiles([]); setSelectedPath(null); }
      return;
    }
    let cancelled = false;
    api.listCommitFiles(projectId, selectedSha).then(list => {
      if (cancelled) return;
      setFiles(list);
      setSelectedPath(list[0]?.path ?? null);
    });
    return () => { cancelled = true; };
  }, [mode, projectId, selectedSha]);

  // Load diff content for the selected file
  useEffect(() => {
    if (!selectedPath) { setDiffContent(null); return; }
    if (mode === 'commits' && !selectedSha) { setDiffContent(null); return; }
    const seq = ++diffSeq.current;
    const opts = mode === 'commits'
      ? { ref: selectedSha! }
      : { staged: mode === 'staged' };
    api.getDiffFile(projectId, selectedPath, opts).then(content => {
      if (seq === diffSeq.current) setDiffContent(content);
    });
  }, [projectId, selectedPath, mode, selectedSha]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{
        width: `${filePanelWidth}px`, flexShrink: 0, borderRight: '1px solid var(--ctp-surface0)',
        background: 'var(--ctp-base)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px', borderBottom: '1px solid var(--ctp-surface0)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', background: 'var(--ctp-base)', borderRadius: '5px', padding: '2px', gap: '2px' }}>
            {(['unstaged', 'staged', 'commits'] as const).map(m => {
              const active = m === mode;
              return (
                <button key={m} onClick={() => setMode(m)} style={{
                  height: '20px', padding: '0 8px', borderRadius: '3px', border: 'none',
                  cursor: 'pointer', fontSize: '0.625rem', fontWeight: active ? 600 : 400,
                  background: active ? 'var(--surface-raised)' : 'transparent',
                  color: active ? 'var(--ctp-text)' : 'var(--ctp-subtext0)',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}>{m}</button>
              );
            })}
          </div>
          <button onClick={refresh} disabled={loading} style={{
            marginLeft: 'auto', width: '22px', height: '22px', borderRadius: '4px',
            border: '1px solid var(--ctp-surface0)', background: 'var(--surface-raised)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ctp-subtext0)',
          }}>
            <RefreshCw style={{ width: '11px', height: '11px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Commits list (commits mode only) */}
        {mode === 'commits' && (
          <div style={{
            flex: '0 0 40%', overflowY: 'auto', borderBottom: '1px solid var(--ctp-surface0)',
            background: 'var(--surface-raised)',
          }}>
            {commits.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ctp-overlay0)', fontSize: '0.75rem' }}>
                No commits
              </div>
            ) : commits.map(c => {
              const isActive = c.sha === selectedSha;
              return (
                <div
                  key={c.sha}
                  onClick={() => setSelectedSha(c.sha)}
                  style={{
                    padding: '6px 10px', cursor: 'pointer',
                    background: isActive ? 'var(--tint-blue)' : 'transparent',
                    borderBottom: '1px solid var(--ctp-base)',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--ctp-mantle)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    fontSize: '0.75rem', color: isActive ? 'var(--ctp-blue)' : 'var(--ctp-text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.subject}</div>
                  <div style={{
                    fontSize: '0.625rem', color: 'var(--ctp-overlay0)', marginTop: '2px',
                    display: 'flex', gap: '6px',
                  }}>
                    <span style={{ fontFamily: 'monospace' }}>{c.short_sha}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.author}</span>
                    <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{formatTime(c.time)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Files list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', minHeight: 0 }}>
          {files.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ctp-overlay0)', fontSize: '0.75rem' }}>
              {mode === 'commits' && !selectedSha ? 'Select a commit' : 'No changes'}
            </div>
          ) : files.map(f => {
            const s = STATUS_LABEL[f.status[0]] ?? { label: f.status[0], color: 'var(--ctp-subtext0)' };
            const name = f.path.split('/').pop() ?? f.path;
            const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
            const isActive = f.path === selectedPath;
            return (
              <div
                key={f.path}
                onClick={() => setSelectedPath(f.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', cursor: 'pointer',
                  background: isActive ? 'var(--tint-blue)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--ctp-mantle)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: s.color, width: '12px', flexShrink: 0 }}>{s.label}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: isActive ? 'var(--ctp-blue)' : 'var(--ctp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  {dir && <div style={{ fontSize: '0.625rem', color: 'var(--ctp-overlay0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dir}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        style={{
          width: '6px', cursor: 'col-resize', background: 'transparent',
          flexShrink: 0, marginLeft: '-3px', marginRight: '-3px',
          position: 'relative', zIndex: 10,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,115,232,0.2)'; }}
        onMouseLeave={e => { if (!isResizing.current) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Monaco DiffEditor */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {diffContent ? (
          <DiffEditor
            height="100%"
            language={getLang(selectedPath ?? '')}
            original={diffContent.original}
            modified={diffContent.modified}
            theme={monacoTheme}
            options={{
              fontSize,
              fontFamily,
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              renderSideBySide: true,
              automaticLayout: true,
            }}
          />
        ) : (
          <div style={{
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ctp-overlay0)', fontSize: '0.8125rem',
          }}>
            {files.length === 0 ? 'No changes' : 'Select a file'}
          </div>
        )}
      </div>
    </div>
  );
}
