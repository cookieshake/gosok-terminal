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

const ACCENTS = ['#89b4fa', '#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7', '#94e2d5', '#fab387', '#89dceb'];

export default function Dashboard({ projects, tabSummary, onSelectProject }: DashboardProps) {
  const isMobile = useIsMobile();
  return (
    <div className="flex flex-col h-full" style={{ background: 'transparent' }}>
      {/* Top bar */}
      <div
        className="shrink-0 flex items-center"
        style={{ height: '52px', borderBottom: '2px solid #5c5470', background: '#eff1f5', paddingLeft: isMobile ? '48px' : '32px' }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#4c4f69', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Dashboard
        </span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: '32px' }}>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pb-24" style={{ textAlign: 'center' }}>
            <div style={{
              padding: '20px 28px', border: '2px solid #5c5470', borderRadius: '4px',
              background: '#eff1f5', boxShadow: '4px 4px 0 #5c5470', marginBottom: '16px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {[0.8, 0.4, 0.4, 0.2].map((op, i) => (
                  <div key={i} style={{ width: '20px', height: '20px', borderRadius: '2px', border: `2px solid rgba(45,155,138,${op})` }} />
                ))}
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#5c5f77', fontWeight: 700 }}>No projects</p>
            <p style={{ fontSize: '0.6875rem', color: '#8c8fa1', marginTop: '4px' }}>Create one from the sidebar to get started</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px', maxWidth: '960px' }}>
            {projects.map((p, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              const summary = tabSummary[p.id];
              const hasRunning = summary && summary.running > 0;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className="text-left transition-all group"
                  style={{
                    display: 'block', padding: '0', borderRadius: '4px',
                    background: '#eff1f5', border: '2px solid #5c5470', cursor: 'pointer',
                    animationDelay: `${i * 40}ms`,
                    boxShadow: '4px 4px 0 #5c5470',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translate(-2px, -2px)';
                    e.currentTarget.style.boxShadow = '6px 6px 0 #5c5470';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translate(0, 0)';
                    e.currentTarget.style.boxShadow = '4px 4px 0 #5c5470';
                  }}
                  onMouseDown={e => {
                    e.currentTarget.style.transform = 'translate(2px, 2px)';
                    e.currentTarget.style.boxShadow = '2px 2px 0 #5c5470';
                  }}
                  onMouseUp={e => {
                    e.currentTarget.style.transform = 'translate(-2px, -2px)';
                    e.currentTarget.style.boxShadow = '6px 6px 0 #5c5470';
                  }}
                >
                  {/* Accent title bar */}
                  <div style={{ height: '8px', background: accent, borderBottom: '2px solid #5c5470' }} />

                  <div style={{ padding: '14px 18px 16px' }}>
                    {/* Name + status */}
                    <div className="flex items-center gap-2 mb-1">
                      {hasRunning && (
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#40a02b', flexShrink: 0 }} />
                      )}
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#4c4f69', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                    </div>

                    {/* Path */}
                    <div style={{ fontSize: '0.6875rem', color: '#8c8fa1', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '8px' }}>
                      {p.path}
                    </div>

                    {/* Tab stats */}
                    {summary && summary.total > 0 && (
                      <div style={{ fontSize: '0.6875rem', color: '#6c6f85' }}>
                        {summary.running > 0
                          ? <><span style={{ color: '#40a02b', fontWeight: 600 }}>{summary.running} running</span> · {summary.total} tab{summary.total !== 1 ? 's' : ''}</>
                          : <>{summary.total} tab{summary.total !== 1 ? 's' : ''}</>
                        }
                      </div>
                    )}

                    {/* Description */}
                    {p.description && (
                      <div style={{ fontSize: '0.75rem', color: '#5c5f77', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginTop: '8px' }}>
                        {p.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
