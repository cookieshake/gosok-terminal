import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';
import * as api from '../api/client';
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
  M: { label: 'M', color: '#d97706' },
  A: { label: 'A', color: '#16a34a' },
  D: { label: 'D', color: '#dc2626' },
  R: { label: 'R', color: '#2563eb' },
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
  const [mode, setMode] = useState<Mode>('unstaged');
  const [files, setFiles] = useState<{ path: string; status: string }[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<{ original: string; modified: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [selectedSha, setSelectedSha] = useState<string | null>(null);
  const isResizing = useRef(false);

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
    setLoading(true);
    try {
      if (mode === 'commits') {
        const list = await api.listCommits(projectId, 100);
        setCommits(list);
        setSelectedSha(list[0]?.sha ?? null);
      } else {
        const list = await api.listDiffFiles(projectId, mode === 'staged');
        setFiles(list);
        setSelectedPath(list[0]?.path ?? null);
      }
    } finally {
      setLoading(false);
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
    if (mode === 'commits') {
      if (!selectedSha) { setDiffContent(null); return; }
      api.getDiffFile(projectId, selectedPath, { ref: selectedSha }).then(setDiffContent);
    } else {
      api.getDiffFile(projectId, selectedPath, { staged: mode === 'staged' }).then(setDiffContent);
    }
  }, [projectId, selectedPath, mode, selectedSha]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{
        width: `${filePanelWidth}px`, flexShrink: 0, borderRight: '1px solid #e3e5e8',
        background: '#f8f9fb', display: 'flex', flexDirection: 'column',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px', borderBottom: '1px solid #e3e5e8', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', background: '#f1f2f5', borderRadius: '5px', padding: '2px', gap: '2px' }}>
            {(['unstaged', 'staged', 'commits'] as const).map(m => {
              const active = m === mode;
              return (
                <button key={m} onClick={() => setMode(m)} style={{
                  height: '20px', padding: '0 8px', borderRadius: '3px', border: 'none',
                  cursor: 'pointer', fontSize: '0.625rem', fontWeight: active ? 600 : 400,
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#111827' : '#6b7280',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}>{m}</button>
              );
            })}
          </div>
          <button onClick={refresh} disabled={loading} style={{
            marginLeft: 'auto', width: '22px', height: '22px', borderRadius: '4px',
            border: '1px solid #e3e5e8', background: '#ffffff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280',
          }}>
            <RefreshCw style={{ width: '11px', height: '11px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Commits list (commits mode only) */}
        {mode === 'commits' && (
          <div style={{
            flex: '0 0 40%', overflowY: 'auto', borderBottom: '1px solid #e3e5e8',
            background: '#ffffff',
          }}>
            {commits.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
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
                    background: isActive ? '#e8f0fe' : 'transparent',
                    borderBottom: '1px solid #f1f2f5',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    fontSize: '0.75rem', color: isActive ? '#1a73e8' : '#111827',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{c.subject}</div>
                  <div style={{
                    fontSize: '0.625rem', color: '#9ca3af', marginTop: '2px',
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
            <div style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem' }}>
              {mode === 'commits' && !selectedSha ? 'Select a commit' : 'No changes'}
            </div>
          ) : files.map(f => {
            const s = STATUS_LABEL[f.status[0]] ?? { label: f.status[0], color: '#6b7280' };
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
                  background: isActive ? '#e8f0fe' : 'transparent',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: s.color, width: '12px', flexShrink: 0 }}>{s.label}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: isActive ? '#1a73e8' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  {dir && <div style={{ fontSize: '0.625rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dir}</div>}
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
            theme="vs"
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
            color: '#9ca3af', fontSize: '0.8125rem',
          }}>
            {files.length === 0 ? 'No changes' : 'Select a file'}
          </div>
        )}
      </div>
    </div>
  );
}
