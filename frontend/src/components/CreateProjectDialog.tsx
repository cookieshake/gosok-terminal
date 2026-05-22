import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronUp, Folder } from 'lucide-react';
import * as api from '../api/client';
import type { DirEntry } from '../api/client';

interface CreateProjectDialogProps {
  open: boolean;
  onSubmit: (data: { name: string; path: string; description: string }) => void;
  onCancel: () => void;
}

function folderName(p: string): string {
  const trimmed = p.replace(/\/+$/, '');
  const last = trimmed.split('/').pop();
  return last || '';
}

export default function CreateProjectDialog({ open, onSubmit, onCancel }: CreateProjectDialogProps) {
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  const [browsing, setBrowsing] = useState(false);
  const [browseDir, setBrowseDir] = useState('');
  const [browseParent, setBrowseParent] = useState('');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPath('');
      setDescription('');
      setBrowsing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const openBrowser = async (dir?: string) => {
    setLoadingDir(true);
    setBrowsing(true);
    try {
      const res = await api.listDirs(dir);
      setBrowseDir(res.path);
      setBrowseParent(res.parent);
      setEntries(res.entries);
    } finally {
      setLoadingDir(false);
    }
  };

  const navigateTo = (dir: string) => openBrowser(dir);

  const selectDir = (selectedPath: string) => {
    setPath(selectedPath);
    setBrowsing(false);
  };

  if (!open) return null;

  const name = folderName(path);
  const canSubmit = path.trim() && name;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ name, path: path.trim(), description: description.trim() });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '7px',
    background: 'var(--ctp-base)', border: '1px solid var(--ctp-surface1)',
    color: 'var(--ctp-text)', fontSize: '0.75rem', outline: 'none',
    fontFamily: 'monospace', transition: 'border-color 0.15s',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: browsing ? '520px' : '420px',
          background: 'var(--surface-raised)',
          border: '1px solid var(--ctp-surface0)',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          overflow: 'hidden',
          transition: 'width 0.15s',
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="create-project-dialog"
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--ctp-mantle)',
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ctp-text)', letterSpacing: '-0.01em' }}>
            New Project
          </span>
          <button
            onClick={onCancel}
            style={{
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '5px', border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'var(--ctp-surface2)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--ctp-mantle)'; e.currentTarget.style.color = 'var(--ctp-subtext0)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ctp-surface2)'; }}
          >
            <X style={{ width: '13px', height: '13px' }} />
          </button>
        </div>

        {browsing ? (
          /* Directory browser */
          <div style={{ display: 'flex', flexDirection: 'column', height: '400px' }}>
            {/* Browser toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 16px', borderBottom: '1px solid var(--ctp-mantle)', flexShrink: 0,
            }}>
              <button
                onClick={() => browseParent && navigateTo(browseParent)}
                disabled={!browseParent}
                style={{
                  width: '26px', height: '26px', borderRadius: '5px', border: '1px solid var(--ctp-surface0)',
                  background: browseParent ? 'var(--surface-raised)' : 'var(--ctp-base)', cursor: browseParent ? 'pointer' : 'default',
                  color: browseParent ? 'var(--ctp-subtext0)' : 'var(--ctp-surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <ChevronUp style={{ width: '13px', height: '13px' }} />
              </button>
              <span style={{
                fontSize: '0.6875rem', fontFamily: 'monospace', color: 'var(--ctp-subtext0)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {browseDir}
              </span>
              <button
                onClick={() => selectDir(browseDir)}
                style={{
                  height: '26px', padding: '0 10px', borderRadius: '5px',
                  border: '1px solid var(--ctp-surface0)', background: 'var(--ctp-base)',
                  color: 'var(--ctp-subtext1)', fontSize: '0.6875rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--ctp-text)'; e.currentTarget.style.color = 'var(--ctp-base)'; e.currentTarget.style.borderColor = 'var(--ctp-text)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--ctp-base)'; e.currentTarget.style.color = 'var(--ctp-subtext1)'; e.currentTarget.style.borderColor = 'var(--ctp-surface0)'; }}
              >
                Select this folder
              </button>
            </div>

            {/* Directory list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingDir ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ctp-overlay0)', fontSize: '0.75rem' }}>
                  Loading…
                </div>
              ) : entries.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ctp-overlay0)', fontSize: '0.75rem' }}>
                  No subdirectories
                </div>
              ) : (
                entries.map(entry => (
                  <div
                    key={entry.path}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '7px 16px', cursor: 'pointer',
                      borderBottom: '1px solid var(--ctp-base)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--ctp-base)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => navigateTo(entry.path)}
                  >
                    <Folder style={{ width: '14px', height: '14px', color: 'var(--ctp-overlay0)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--ctp-subtext1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.name}
                    </span>
                    <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--ctp-surface2)', flexShrink: 0 }} />
                  </div>
                ))
              )}
            </div>

            {/* Browser footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--ctp-mantle)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBrowsing(false)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--ctp-surface1)',
                  background: 'transparent', color: 'var(--ctp-subtext0)', fontSize: '0.75rem', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--ctp-overlay0)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Working Directory
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  ref={inputRef}
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/home/user/project"
                  data-testid="create-project-path"
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--ctp-sky)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--ctp-surface1)'; }}
                />
                <button
                  type="button"
                  onClick={() => openBrowser(path || undefined)}
                  style={{
                    height: '37px', padding: '0 12px', borderRadius: '7px',
                    border: '1px solid var(--ctp-surface1)', background: 'var(--ctp-base)',
                    color: 'var(--ctp-subtext1)', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--ctp-mantle)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--ctp-base)'; }}
                >
                  <Folder style={{ width: '13px', height: '13px' }} />
                  Browse
                </button>
              </div>
              {name && (
                <div style={{ marginTop: '6px', fontSize: '0.6875rem', color: 'var(--ctp-overlay0)' }}>
                  Project name: <span style={{ color: 'var(--ctp-subtext1)', fontWeight: 500 }}>{name}</span>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--ctp-overlay0)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Description <span style={{ color: 'var(--ctp-surface2)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>optional</span>
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project about?"
                data-testid="create-project-desc"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '7px',
                  background: 'var(--ctp-base)', border: '1px solid var(--ctp-surface1)',
                  color: 'var(--ctp-text)', fontSize: '0.8125rem', outline: 'none',
                  fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--ctp-sky)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--ctp-surface1)'; }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '8px 16px', borderRadius: '7px', border: '1px solid var(--ctp-surface1)',
                  background: 'transparent', color: 'var(--ctp-subtext0)', fontSize: '0.8125rem',
                  fontWeight: 500, cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--ctp-base)'; e.currentTarget.style.color = 'var(--ctp-subtext1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ctp-subtext0)'; }}
                data-testid="create-project-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                data-testid="create-project-submit"
                style={{
                  padding: '8px 20px', borderRadius: '7px', border: 'none',
                  background: canSubmit ? 'var(--ctp-blue)' : 'var(--ctp-surface1)',
                  color: canSubmit ? 'var(--on-accent)' : 'var(--ctp-overlay0)',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
