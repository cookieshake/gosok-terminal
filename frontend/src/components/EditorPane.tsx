import { useCallback, useEffect, useRef, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import * as api from '../api/client';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Save } from 'lucide-react';

const EXT_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust', rb: 'ruby', java: 'java',
  c: 'c', cpp: 'cpp', h: 'cpp', cs: 'csharp', swift: 'swift', kt: 'kotlin',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'ini',
  md: 'markdown', sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', graphql: 'graphql', xml: 'xml', dockerfile: 'dockerfile',
  tf: 'hcl', mod: 'go', sum: 'go',
};

function getLang(path: string): string {
  const name = path.split('/').pop() ?? '';
  if (name.toLowerCase() === 'dockerfile') return 'dockerfile';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANG[ext] ?? 'plaintext';
}

interface TreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: TreeNode[];
  expanded?: boolean;
  loaded?: boolean;
}

interface EditorPaneProps {
  rootPath: string;
  fontSize?: number;
  fontFamily?: string;
}

export default function EditorPane({ rootPath, fontSize = 14, fontFamily = 'MonoplexNerd, Menlo, Monaco, "Courier New", monospace' }: EditorPaneProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [openFiles, setOpenFiles] = useState<{ path: string; content: string; dirty: boolean }[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<unknown>(null);
  const [fileTreeWidth, setFileTreeWidth] = useState(220);
  const isResizingTree = useRef(false);

  const handleTreeResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = fileTreeWidth;
    isResizingTree.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizingTree.current) return;
      setFileTreeWidth(Math.min(480, Math.max(120, startWidth + ev.clientX - startX)));
    };
    const onMouseUp = () => {
      isResizingTree.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [fileTreeWidth]);

  // Load root — if path is '~' fall back to fs/dirs default (home dir)
  useEffect(() => {
    const load = rootPath === '~'
      ? api.listDirs().then(r => r.entries.map(e => ({ ...e, is_dir: true })))
      : api.listFiles(rootPath);
    load.then(entries => {
      setTree(entries.map(e => ({ ...e, expanded: false, loaded: false })));
    });
  }, [rootPath]);

  const toggleDir = useCallback(async (node: TreeNode, path: TreeNode[]) => {
    if (!node.is_dir) return;

    const updateNode = (nodes: TreeNode[], targetPath: TreeNode[]): TreeNode[] => {
      if (targetPath.length === 0) return nodes;
      return nodes.map(n => {
        if (n.path !== targetPath[0].path) return n;
        if (targetPath.length === 1) {
          const expanded = !n.expanded;
          return { ...n, expanded };
        }
        return { ...n, children: updateNode(n.children ?? [], targetPath.slice(1)) };
      });
    };

    if (!node.loaded) {
      const entries = await api.listFiles(node.path);
      const children: TreeNode[] = entries.map(e => ({ ...e, expanded: false, loaded: false }));
      const setLoaded = (nodes: TreeNode[], targetPath: TreeNode[]): TreeNode[] => {
        if (targetPath.length === 0) return nodes;
        return nodes.map(n => {
          if (n.path !== targetPath[0].path) return n;
          if (targetPath.length === 1) return { ...n, expanded: true, loaded: true, children };
          return { ...n, children: setLoaded(n.children ?? [], targetPath.slice(1)) };
        });
      };
      setTree(prev => setLoaded(prev, path));
    } else {
      setTree(prev => updateNode(prev, path));
    }
  }, []);

  const openFile = useCallback(async (path: string) => {
    const existing = openFiles.find(f => f.path === path);
    if (existing) {
      setActiveFile(path);
      return;
    }
    const result = await api.readFile(path);
    setOpenFiles(prev => [...prev, { path, content: result.content, dirty: false }]);
    setActiveFile(path);
  }, [openFiles]);

  const closeFile = (path: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== path));
    setActiveFile(prev => {
      if (prev !== path) return prev;
      const remaining = openFiles.filter(f => f.path !== path);
      return remaining[remaining.length - 1]?.path ?? null;
    });
  };

  const handleChange = (value: string | undefined) => {
    if (value === undefined || !activeFile) return;
    setOpenFiles(prev => prev.map(f => f.path === activeFile ? { ...f, content: value, dirty: true } : f));
  };

  const save = useCallback(async () => {
    const file = openFiles.find(f => f.path === activeFile);
    if (!file || !file.dirty) return;
    setSaving(true);
    try {
      await api.writeFile(file.path, file.content);
      setOpenFiles(prev => prev.map(f => f.path === activeFile ? { ...f, dirty: false } : f));
    } finally {
      setSaving(false);
    }
  }, [openFiles, activeFile]);

  // Cmd+S / Ctrl+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const activeFileData = openFiles.find(f => f.path === activeFile);

  const renderTree = (nodes: TreeNode[], nodePath: TreeNode[] = []) =>
    nodes.map(node => {
      const currentPath = [...nodePath, node];
      const isActive = activeFile === node.path;
      return (
        <div key={node.path}>
          <div
            onClick={() => node.is_dir ? toggleDir(node, currentPath) : openFile(node.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: `3px 8px 3px ${8 + nodePath.length * 14}px`,
              cursor: 'pointer', userSelect: 'none',
              background: isActive ? '#e8f0fe' : 'transparent',
              color: isActive ? '#1a73e8' : '#374151',
              fontSize: '0.75rem',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            {node.is_dir ? (
              <>
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>
                  {node.expanded
                    ? <ChevronDown style={{ width: '11px', height: '11px' }} />
                    : <ChevronRight style={{ width: '11px', height: '11px' }} />}
                </span>
                {node.expanded
                  ? <FolderOpen style={{ width: '13px', height: '13px', color: '#fbbf24', flexShrink: 0 }} />
                  : <Folder style={{ width: '13px', height: '13px', color: '#fbbf24', flexShrink: 0 }} />}
              </>
            ) : (
              <>
                <span style={{ width: '11px', flexShrink: 0 }} />
                <FileText style={{ width: '13px', height: '13px', color: '#9ca3af', flexShrink: 0 }} />
              </>
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.name}
            </span>
          </div>
          {node.is_dir && node.expanded && node.children && renderTree(node.children, currentPath)}
        </div>
      );
    });

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* File tree */}
      <div style={{
        width: `${fileTreeWidth}px`, flexShrink: 0, borderRight: '1px solid #e3e5e8',
        background: '#f8f9fb', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 10px 6px', fontSize: '0.625rem', fontWeight: 700,
          letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase',
          borderBottom: '1px solid #e3e5e8', flexShrink: 0,
        }}>
          {rootPath.split('/').pop()}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {renderTree(tree)}
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleTreeResizeStart}
        style={{
          width: '6px', cursor: 'col-resize', background: 'transparent',
          flexShrink: 0, marginLeft: '-3px', marginRight: '-3px',
          position: 'relative', zIndex: 10,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,115,232,0.2)'; }}
        onMouseLeave={e => { if (!isResizingTree.current) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* Editor area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* File tabs */}
        {openFiles.length > 0 && (
          <div style={{
            display: 'flex', borderBottom: '1px solid #e3e5e8',
            background: '#f8f9fb', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0,
          }}>
            {openFiles.map(f => {
              const name = f.path.split('/').pop() ?? f.path;
              const isActive = f.path === activeFile;
              return (
                <div
                  key={f.path}
                  onClick={() => setActiveFile(f.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '0 12px', height: '32px', flexShrink: 0,
                    cursor: 'pointer', userSelect: 'none',
                    background: isActive ? '#ffffff' : 'transparent',
                    borderRight: '1px solid #e3e5e8',
                    borderTop: `2px solid ${isActive ? '#1a73e8' : 'transparent'}`,
                    color: isActive ? '#111827' : '#6b7280',
                    fontSize: '0.75rem',
                  }}
                >
                  <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.dirty ? '● ' : ''}{name}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); closeFile(f.path); }}
                    style={{
                      width: '14px', height: '14px', borderRadius: '2px', border: 'none',
                      background: 'transparent', cursor: 'pointer', color: '#9ca3af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: '0.75rem',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#374151'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
                  >×</button>
                </div>
              );
            })}
            {activeFileData?.dirty && (
              <button
                onClick={save}
                disabled={saving}
                style={{
                  marginLeft: 'auto', marginRight: '8px', alignSelf: 'center',
                  height: '22px', padding: '0 8px', borderRadius: '4px',
                  border: '1px solid #e3e5e8', background: '#ffffff',
                  color: '#374151', fontSize: '0.6875rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                }}
              >
                <Save style={{ width: '11px', height: '11px' }} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        )}

        {/* Monaco editor */}
        {activeFileData ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MonacoEditor
              height="100%"
              language={getLang(activeFileData.path)}
              value={activeFileData.content}
              theme="vs"
              onChange={handleChange}
              onMount={(editor) => { editorRef.current = editor; }}
              options={{
                fontSize,
                fontFamily,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderWhitespace: 'none',
                wordWrap: 'off',
                tabSize: 2,
                automaticLayout: true,
              }}
            />
          </div>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#9ca3af', fontSize: '0.8125rem',
          }}>
            <FileText style={{ width: '36px', height: '36px', marginBottom: '12px', color: '#e5e7eb' }} />
            파일을 선택하세요
          </div>
        )}
      </div>
    </div>
  );
}
