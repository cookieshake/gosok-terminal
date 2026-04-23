import { useIsMobile } from '../hooks/useIsMobile';
import type { Project } from '../api/types';

interface TabSummary {
  total: number;
  running: number;
  active: number;
}

interface DashboardProps {
  projects: Project[];
  tabSummary: Record<string, TabSummary>;
  onSelectProject: (id: string) => void;
}

function hashHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function initials(name: string): string {
  const words = name.trim().split(/[\s\-_]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  const cleaned = name.replace(/[^\p{L}\p{N}]/gu, '');
  if (cleaned.length === 0) return '?';
  return cleaned.slice(0, 2).toUpperCase();
}

export default function Dashboard({ projects, tabSummary, onSelectProject }: DashboardProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col h-full" style={{ background: 'transparent' }}>
      <div
        className="shrink-0 flex items-center"
        style={{
          height: '52px',
          borderBottom: '1px solid #e0e0e8',
          background: '#eff1f5',
          paddingLeft: isMobile ? '48px' : '32px',
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: '#4c4f69',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Dashboard
        </span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: isMobile ? '16px' : '32px' }}>
        {projects.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full pb-24"
            style={{ textAlign: 'center' }}
            data-testid="dashboard-empty"
          >
            <p style={{ fontSize: '0.875rem', color: '#4c4f69', fontWeight: 600 }}>No projects</p>
            <p style={{ fontSize: '0.75rem', color: '#8c8fa1', marginTop: '6px' }}>
              Create one from the sidebar to get started
            </p>
          </div>
        ) : (
          <div
            style={{
              maxWidth: '800px',
              background: '#ffffff',
              border: '1px solid #e9e9ef',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {projects.map((p, i) => {
              const s = tabSummary[p.id];
              const hue = hashHue(p.name);
              const badgeBg = `hsl(${hue}, 55%, 85%)`;
              const badgeFg = `hsl(${hue}, 45%, 35%)`;
              const tabCount = s?.total ?? 0;
              const runningCount = s?.running ?? 0;
              const hasTabs = tabCount > 0;
              const hasRunning = runningCount > 0;

              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  data-testid={`project-card-${p.id}`}
                  aria-label={
                    hasTabs
                      ? `${p.name}, ${tabCount} tab${tabCount !== 1 ? 's' : ''}${
                          hasRunning ? `, ${runningCount} running` : ''
                        }`
                      : p.name
                  }
                  className="w-full flex items-center gap-3 h-12 px-4 bg-transparent border-0 cursor-pointer text-left transition-colors duration-150 hover:bg-[#f7f7fb] active:bg-[#eef0f6] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#89b4fa]"
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid #f0f0f4',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: badgeBg,
                      color: badgeFg,
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {initials(p.name)}
                  </div>

                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#4c4f69',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: '0 1 auto',
                      minWidth: 0,
                    }}
                  >
                    {p.name}
                  </div>

                  {hasTabs && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6c6f85',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexShrink: 0,
                      }}
                    >
                      {hasRunning && (
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#40a02b',
                            display: 'inline-block',
                          }}
                        />
                      )}
                      {hasRunning ? (
                        <span>
                          {runningCount} running · {tabCount} tab
                          {tabCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span>
                          {tabCount} tab{tabCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ flex: '1 1 auto' }} />

                  {!isMobile && (
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#9ca0b0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '40%',
                        flexShrink: 1,
                        textAlign: 'right',
                      }}
                    >
                      {p.path}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
